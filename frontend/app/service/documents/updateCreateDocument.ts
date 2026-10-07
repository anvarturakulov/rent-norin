import axios from 'axios';
import { showMessage } from '../common/showMessage';
import { Maindata } from '@/app/context/app.context.interfaces';
import { DocSTATUS, DocumentModel, DocumentType } from '@/app/interfaces/document.interface';
import { workersUsersList } from '@/app/interfaces/user.interface';
import { defaultDocument, defaultDocumentTableItem, defaultDocValue } from '@/app/context/app.context.helpers.constants';
import { getDateBanEditingValue, isDocumentDateBanned, DATE_BAN_EDITING_MESSAGE } from '../settings/dateBanEditing';
import { checkInterEnterprise } from './checkInterEnterprise';
import { getSettingByKeyFromDB } from '../settings/getSettingByKeyFromDB';
import { getFilledDocTableItems } from './validateBody';
import { filterAdvanceLines } from './advanceLines';
import { normalizeOptionalPaymentFieldsOnSave, normalizeOptionalPaymentFieldsOnLoad } from './optionalPaymentFields';
import { maybeAlertReadyRentalOrders } from './maybeAlertReadyRentalOrders';

const extractDocumentSaveError = (error: any, fallback: string): string => {
  if (error?.response) {
    const data = error.response.data;
    if (typeof data === 'string' && data) return data;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    return `Ошибка сервера: ${error.response.status} ${error.response.statusText}`;
  }
  if (error?.request) {
    return 'Сервер не отвечает. Проверьте подключение к интернету.';
  }
  if (typeof error?.message === 'string' && error.message.includes('Unexpected end of JSON input')) {
    return 'Сервер вернул пустой ответ. Проверьте логи сервера.';
  }
  return error?.message || fallback;
};

export const updateCreateDocument = async (
  mainData: Maindata,
  setMainData: Function | undefined,
  saveOnly = false,
  onSaveOnlyDone?: () => void
): Promise<boolean> => {
  const { user } = mainData.users
  const targetEnterpriseId = mainData.report?.selectedEnterpriseId ?? user?.enterpriseId ?? null;
  const { currentDocument } = mainData.document
  const { isNewDocument, contentName } = mainData.document

  /** Сразу PROVEDEN на бэкенде: SINGLE_ENTERPRISE_MODE или AVTO_PROVODKA_IN_MANY_ENTERPRISE_MODE */
  const immediateProvodka =
    Boolean(mainData.settings?.singleEnterpriseMode) ||
    Boolean(mainData.settings?.avtoProvodkaInManyEnterpriseMode);

  let body: DocumentModel = normalizeOptionalPaymentFieldsOnSave({
    ...currentDocument,
  })

  if (body.docValues) {
    const toIntOrNull = (value: unknown): number | null => {
      if (value == null || value === '') return null;
      const n = Math.trunc(Number(value));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    body.docValues = {
      ...body.docValues,
      clientContractId: toIntOrNull(body.docValues.clientContractId),
      clientContractLineId: toIntOrNull(body.docValues.clientContractLineId),
    };
  }

  const sessionUserId = Number(user?.id) || 0;
  if (!sessionUserId) {
    if (setMainData) {
      showMessage('Сессия недействительна. Қайта киринг.', 'error', setMainData);
    }
    onSaveOnlyDone?.();
    return false;
  }
  body.userId = sessionUserId;

  const dateBanEditing =
    mainData.settings?.dateBanEditing ??
    (await getDateBanEditingValue(user?.token));
  if (isDocumentDateBanned(body.date, dateBanEditing)) {
    if (setMainData) {
      showMessage(DATE_BAN_EDITING_MESSAGE, 'error', setMainData);
    }
    onSaveOnlyDone?.();
    return false;
  }

  if (!body.docTableItems || !Array.isArray(body.docTableItems)) {
    body.docTableItems = [];
  } else if (body.documentType === DocumentType.Advance) {
    body.docTableItems = filterAdvanceLines(body.docTableItems);
    if (body.docValues && !body.docValues.receiverId) {
      body.docValues.receiverId = 0;
    }
  } else {
    body.docTableItems = getFilledDocTableItems(body.docTableItems);
  }

  // Проверка: senderId и receiverId не должны быть одинаковыми (кроме ZpCalculate, где это допустимо)
  if (
      (body.documentType !== DocumentType.ZpCalculate 
      && body.documentType !== DocumentType.GateIncome
      && body.documentType !== DocumentType.LeaveMaterial
      && body.documentType !== DocumentType.LeaveOnlyOneMaterial
      && body.documentType !== DocumentType.AmortizasiyaOS
      && body.documentType !== DocumentType.Advance
    ) && 
      body.docValues?.senderId && 
      body.docValues?.receiverId && 
      body.docValues.senderId === body.docValues.receiverId) {
    if (setMainData) {
      showMessage('Олувчи ва жунатувчибир хил бўлмайди', 'error', setMainData);
    }
    onSaveOnlyDone?.();
    return false;
  }
  
  const docsForNoProveden: Array<string> = [];
  delete body.id;

  if (body.docValues?.senderId == 0) {
    let newDocValues = {...body.docValues}
    body = {
      ...body,
      docValues: {
        ...newDocValues,
        senderId: newDocValues.receiverId
      }
    }
  }

  if (body.documentType === DocumentType.AmortizasiyaOS && body.docValues?.senderId) {
    body = {
      ...body,
      docValues: {
        ...body.docValues,
        receiverId: body.docValues.senderId,
      },
    };
  }

  // Проверяем, должен ли документ быть межпредприятийным
  const checkInterEnterpriseStatus = async () => {
    if (body.docValues?.receiverId) {
      try {
        const interEnterpriseCheck = await checkInterEnterprise(
          body.docValues.receiverId,
          body.documentType,
          user?.enterpriseId,
          user?.token,
          mainData.settings?.singleEnterpriseMode
        );

        // Если документ должен быть межпредприятийным, устанавливаем статус OPEN (не PROVEDEN)
        if (interEnterpriseCheck.isInterEnterprise) {
          body.isInterEnterprise = true;
          body.targetEnterpriseId = interEnterpriseCheck.targetEnterpriseId;
          body.sourceEnterpriseId = user?.enterpriseId ?? null;
          // Для межпредприятийных документов статус будет установлен на бэкенде как PENDING
          // Но если это новый документ и не в списке docsForNoProveden, оставляем OPEN
          if (isNewDocument) {
            if (docsForNoProveden.includes(contentName)) {
              body.docStatus = DocSTATUS.OPEN;
            } else {
              // Для межпредприятийных документов не устанавливаем PROVEDEN
              body.docStatus = DocSTATUS.OPEN;
            }
          }
          return true;
        }
      } catch (error) {
        console.error('Error checking inter-enterprise status:', error);
      }
    }
    return false;
  };

  if (isNewDocument) {
    // Проверяем межпредприятийность перед установкой статуса
    const isInterEnterpriseDoc = await checkInterEnterpriseStatus();
    
    if (!isInterEnterpriseDoc) {
      // Если документ не межпредприятийный, используем стандартную логику
      // GateIncome всегда создается со статусом OPEN (как раньше)
      if (body.documentType === DocumentType.GateIncome) {
        body.docStatus = DocSTATUS.OPEN;
      } else if (docsForNoProveden.includes(contentName)) {
        // Документы из списка docsForNoProveden остаются OPEN и проводятся вручную
        body.docStatus = DocSTATUS.OPEN;
      } else if (saveOnly) {
        // Предварительное сохранение (кнопка «Саклаш»): OPEN — черновик, без проводки
        body.docStatus = DocSTATUS.OPEN;
      } else if (
        body.documentType === DocumentType.ComeProduct ||
        body.documentType === DocumentType.ComeMaterial ||
        body.documentType === DocumentType.ComeTools ||
        body.documentType === DocumentType.ComeTovar ||
        body.documentType === DocumentType.ComeOS
      ) {
        // ComeProduct, ComeMaterial, ComeOS — сразу PROVEDEN и автопроводка
        body.docStatus = DocSTATUS.PROVEDEN;
      } else {
        // При единственной организации или AVTO_PROVODKA — сразу PROVEDEN (автопроводка без HEADGLOBAL).
        // Иначе PENDING для утверждения HEADGLOBAL или проведения через setProvodka.
        body.docStatus = immediateProvodka ? DocSTATUS.PROVEDEN : DocSTATUS.PENDING;
      }
    }
  } else {
    // Для существующих документов также проверяем межпредприятийность
    await checkInterEnterpriseStatus();
  } 

  const config = {
    headers: { Authorization: `Bearer ${user?.token}` }
  };

  const markLastActedInJournal = (docId: number | undefined) => {
    // Черновик нового документа имеет id: -1 — не запускаем навигацию по нему
    if (setMainData && docId != null && docId > 0) {
      setMainData('journal.lastActedDocumentId', docId);
      setMainData('journal.navigateToLastActedDocument', true);
    }
  };

  const actionWithMainData = (mes: string, createdDoc?: DocumentModel) => {
    if (setMainData) {
      markLastActedInJournal(createdDoc?.id ?? currentDocument.id);
      showMessage(`${mes}`, 'success', setMainData)
      setMainData('clearControlElements', true);
      setMainData('showDocumentWindow', false);
      setMainData('isNewDocument', false);
      setMainData('document.isDuplicateDraft', false);
      setMainData('updateDataForDocumentJournal', true);
      const defValue:DocumentModel = {
        ...defaultDocument,
        docValues: {...defaultDocValue},
        docTableItems: [defaultDocumentTableItem]
      }
      setMainData('currentDocument', { ...defValue });
      setMainData('docValues', { ...defaultDocValue });

      if (user && workersUsersList.includes(user?.role)) {
        setMainData('mainPage', true);
      }
    }
  }

  // Сохранение без проводки: окно не закрывается, обновляем только id при создании нового документа.
  // Намеренно мержим с currentDocument, чтобы не потерять documentType, docValues и другие поля,
  // которые могут отсутствовать в ответе сервера.
  const actionSaveOnly = (mes: string, createdDoc?: DocumentModel) => {
    if (setMainData) {
      markLastActedInJournal(createdDoc?.id ?? currentDocument.id);
      showMessage(mes, 'success', setMainData);
      const savedDraft = normalizeOptionalPaymentFieldsOnLoad({
        ...body,
        id: createdDoc?.id ?? currentDocument.id,
      });
      setMainData('currentDocument', savedDraft);
      if (createdDoc?.id && isNewDocument) {
        setMainData('isNewDocument', false);
      }
    }
    onSaveOnlyDone?.();
  }

  const uriPost = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/create';
  const uriPatch = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/update/' + currentDocument.id;
  
  if (isNewDocument && body.documentType == DocumentType.ZpCalculate && body.docValues?.senderId == 0) {
    let finalDocValues: any = {...body.docValues}
    finalDocValues.senderId = finalDocValues.receiverId
    body.docValues = finalDocValues
  }
  

  // Для GateIncome устанавливаем дефолтные значения senderId и receiverId
  if (body.documentType === DocumentType.GateIncome && body.docValues) {
    // Используем commonStorageId из настроек или дефолтное значение
    const commonStorageId = await getSettingByKeyFromDB('commonStorageId', user?.token, targetEnterpriseId);
    // Дефолтное хранилище (можно использовать из настроек или константу)
    const defaultStorageId = commonStorageId ? Number(commonStorageId) : (user?.sectionId || 20125);
    
    if (!body.docValues.senderId || body.docValues.senderId === 0) {
      body.docValues.senderId = defaultStorageId;
    }
    if (!body.docValues.receiverId || body.docValues.receiverId === 0) {
      body.docValues.receiverId = defaultStorageId;
    }
    // Для GateIncome total не обязателен, устанавливаем 0 если не указан
    if (!body.docValues.total) {
      body.docValues.total = 0;
    }
  }
  
  if (isNewDocument) {
    const postBody = saveOnly ? { ...body, saveOnly: true } : body;
    try {
      const response = await axios.post(uriPost, postBody, config);
      if (saveOnly) {
        actionSaveOnly('хужжат сақланди', response.data);
      } else {
        actionWithMainData('янги хужжати киритилди', response.data);
        await maybeAlertReadyRentalOrders(mainData, setMainData, body.documentType);
      }
      return true;
    } catch (error: any) {
      if (setMainData) {
        showMessage(
          extractDocumentSaveError(error, 'Ошибка при создании документа'),
          'error',
          setMainData,
        );
      }
      onSaveOnlyDone?.();
      return false;
    }
  }

  if (!currentDocument.id) {
    onSaveOnlyDone?.();
    return false;
  }

  if (
    body.documentType === DocumentType.ComeCashFromClients &&
    body.isInterEnterprise &&
    body.docStatus === DocSTATUS.OPEN &&
    body.docValues?.receiverId &&
    user?.token
  ) {
    try {
      const receiverUri = process.env.NEXT_PUBLIC_DOMAIN + '/api/references/' + body.docValues.receiverId;
      const receiverResponse = await axios.get(receiverUri, config);
      const receiver = receiverResponse.data;
      const isOffice = receiver?.refValues?.isOffice === true;
      const userEnterpriseId = user?.enterpriseId;
      const isReceiver = body.targetEnterpriseId === userEnterpriseId;

      if (isOffice && isReceiver) {
        body.docStatus = DocSTATUS.PENDING;
      }
    } catch (error) {
      console.warn('⚠️ [updateCreateDocument] Не удалось проверить isOffice для receiver:', error);
    }
  }

  if (
    !saveOnly &&
    !immediateProvodka &&
    !body.isInterEnterprise &&
    body.docStatus === DocSTATUS.OPEN &&
    body.documentType !== DocumentType.GateIncome &&
    !docsForNoProveden.includes(contentName) &&
    body.documentType !== DocumentType.ComeProduct &&
    body.documentType !== DocumentType.ComeMaterial &&
    body.documentType !== DocumentType.Advance
  ) {
    body.docStatus = DocSTATUS.PENDING;
  }

  const patchBody = saveOnly ? { ...body, saveOnly: true } : body;
  const shouldSendInterEnterpriseAfterSave =
    !saveOnly &&
    body.isInterEnterprise &&
    body.docStatus === DocSTATUS.OPEN &&
    user?.enterpriseId != null &&
    body.sourceEnterpriseId === user.enterpriseId;

  try {
    await axios.patch(uriPatch, patchBody, config);
    if (shouldSendInterEnterpriseAfterSave && currentDocument.id) {
      const sendUri =
        process.env.NEXT_PUBLIC_DOMAIN +
        '/api/documents/' +
        currentDocument.id +
        '/send';
      try {
        await axios.post(sendUri, { enterpriseId: user.enterpriseId }, config);
        actionWithMainData('хужжат сақланди ва жўнатилди');
        return true;
      } catch (sendError: any) {
        if (setMainData) {
          const sendMsg =
            sendError.response?.data?.message ||
            sendError.message ||
            'Ошибка при отправке документа';
          showMessage(
            `Хужжат сақланди, лекин жўнатишда хато: ${sendMsg}`,
            'error',
            setMainData,
          );
          markLastActedInJournal(currentDocument.id);
          setMainData('updateDataForDocumentJournal', true);
        }
        onSaveOnlyDone?.();
        return false;
      }
    }
    if (saveOnly) {
      actionSaveOnly('хужжат янгиланди');
    } else {
      actionWithMainData('хужжат янгиланди');
      await maybeAlertReadyRentalOrders(mainData, setMainData, body.documentType);
    }
    return true;
  } catch (error: any) {
    if (setMainData) {
      showMessage(
        extractDocumentSaveError(error, 'Ошибка при обновлении документа'),
        'error',
        setMainData,
      );
    }
    onSaveOnlyDone?.();
    return false;
  }
}