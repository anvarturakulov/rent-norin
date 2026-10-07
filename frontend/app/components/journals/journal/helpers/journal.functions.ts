import { Maindata } from '@/app/context/app.context.interfaces';
import { DocSTATUS, DocumentModel, DocumentType } from '@/app/interfaces/document.interface';
import { ReferenceModel, TypeSECTION } from '@/app/interfaces/reference.interface';
import { UserRoles } from '@/app/interfaces/user.interface';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { deleteComeProducts } from '@/app/service/documents/deleteComeProducts';
import { getDocumentById, fetchDocumentById } from '@/app/service/documents/getDocumentById';
import { markToDeleteDocument } from '@/app/service/documents/markToDeleteDocument';
import { setProvodkaToDocument } from '@/app/service/documents/setProvodkaToDocument';
import { getDateBanEditingValue, isDocumentDateBanned, DATE_BAN_EDITING_MESSAGE } from '@/app/service/settings/dateBanEditing';
import { canZavskladEditDocument } from '@/app/service/common/users';
import { saveReportScrollBeforeDocument } from '@/app/service/common/reportScrollPreservation';

export const getDocument = async (
  id: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined,
  mainData?: Maindata,
  currentContentName?: string
) => {
  if (id) {
    // Сохраняем позицию в отчёте до открытия документа (скролл + якорь строки)
    saveReportScrollBeforeDocument(id);
    // Сохраняем current contentName перед открытием документа
    // Используем currentContentName если передан, иначе берем из mainData
    const previousContentName = currentContentName !== undefined ? currentContentName : (mainData?.document?.contentName);
    // Сохраняем previousContentName всегда, даже если undefined, чтобы можно было восстановить
    if (setMainData) {
      setMainData('document.previousContentName', previousContentName);
    }
    const reference = await getDocumentById(id, setMainData, token, true, mainData);
  }
}

export const getUserName = (id: number, mainData: Maindata): string => {
  const { usersName } = mainData.users
  if (usersName && usersName.length > 0) {
    return usersName.filter((item) => item?.id == id)[0]?.name
  }
  
  return 'Аникланмади'
}

export const deleteItemDocument = async (
  id: number | undefined,
  docDate: number| undefined,
  token: string | undefined,
  setMainData: Function | undefined,
  mainData: Maindata,
  setIsDisabled : Function,
  options?: { reopen?: boolean },
) => {
  const { user } = mainData.users
  const { contentName, currentDocument } = mainData.document
  
  // Получаем userId и тип документа
  let docUserId: number | undefined;
  let docType: DocumentType | string | undefined;
  let documentStatus: DocSTATUS | undefined;
  if (id === currentDocument?.id) {
    docUserId = currentDocument?.userId;
    docType = currentDocument?.documentType;
    documentStatus = currentDocument?.docStatus;
  } else if (id && token) {
    const document = await fetchDocumentById(id, token);
    docUserId = document?.userId;
    docType = document?.documentType;
    documentStatus = document?.docStatus;
  }

  // Проверяем дату запрета редактирования для ВСЕХ пользователей
  const dateBanEditing =
    mainData.settings?.dateBanEditing ??
    (await getDateBanEditingValue(token));
  if (isDocumentDateBanned(docDate, dateBanEditing)) {
    alert(DATE_BAN_EDITING_MESSAGE)
    return
  }

  const zavskladOk = canZavskladEditDocument(user, docType);

  // Для документов со статусом PROVEDEN — уполномоченные роли или ZAVSKLAD для своих типов
  if (documentStatus === DocSTATUS.PROVEDEN) {
    if (!canDeleteProvedenDocument(user?.role) && !zavskladOk) {
      alert('Узр. Хисоботларга кушилган хужжат рахбар ёки бухгалтер томонидан учирилиши мумкин');
      return;
    }
    // Форма документа уже спрашивает confirm перед reopen
    if (!options?.reopen) {
      if (!confirm('Проводкани бекор қилиб, хужжатни таҳрирлаш учун очасизми?')) {
        return;
      }
    }
  }

  // Проверяем права на удаление (соответствует правам в бэкенде)
  if (
    user?.role == UserRoles.ADMINGLOBAL || 
    user?.role == UserRoles.HEADCOMPANY ||
    user?.role == UserRoles.GLAVBUX ||
    user?.role == UserRoles.HEADGLOBAL ||
    user?.id == docUserId ||
    zavskladOk
  ) {
    markToDeleteDocument(id, setMainData, token, mainData, options?.reopen)
  } else {
    alert('Узр. Факат админлар учириш хукукига эга')
  }
}

/** Роли, которым разрешена отмена проводки / reopen проведённого внутреннего документа. */
export const canDeleteProvedenDocument = (role?: UserRoles): boolean =>
  role === UserRoles.HEADCOMPANY ||
  role === UserRoles.GLAVBUX ||
  role === UserRoles.HEADGLOBAL ||
  role === UserRoles.ADMINGLOBAL;

/** Показ кнопки отмены проводки (как showTrashButton в журнале для PROVEDEN). */
export const canReopenProvedenDocument = (
  document: DocumentModel,
  user: Maindata['users']['user'],
  references?: ReferenceModel[],
): boolean => {
  if (document.docStatus !== DocSTATUS.PROVEDEN) {
    return false;
  }

  if (document.isInterEnterprise) {
    return user?.role === UserRoles.ADMINGLOBAL;
  }

  // Внутренний PROVEDEN: isLocked не всегда true (setProvodka не блокирует документ)
  return (
    canDeleteProvedenDocument(user?.role) ||
    canZavskladEditDocument(user, document.documentType)
  );
}

export const setProvodkaToDoc = async (id: number | undefined, docDate: number| undefined, token: string | undefined, docStatus: DocSTATUS, setMainData: Function | undefined, mainData: Maindata, receiverId: number | undefined, senderId: number | undefined, setIsDisabled: Function) => {

  const dateBanEditing =
    mainData.settings?.dateBanEditing ??
    (await getDateBanEditingValue(token));
  if (isDocumentDateBanned(docDate, dateBanEditing)) {
    alert(DATE_BAN_EDITING_MESSAGE)
    return
  }

  // OPEN — проводка через setProvodka. PENDING — по умолчанию только approve HEADGLOBAL;
  // исключения: MoveCash+hasBuxgalter (получатель), либо immediateProvodka (single / AVTO).
  const { user } = mainData.users
  const { currentDocument } = mainData.document
  const allReferences = mainData.reference?.allReferences;

  const immediateProvodka =
    (mainData?.settings?.singleEnterpriseMode ?? false) ||
    (mainData?.settings?.avtoProvodkaInManyEnterpriseMode ?? false);

  let isReceiverForBuxgalter = false;
  let isMoveCash = false;
  let receiverHasBuxgalter = false;
  if ((docStatus === DocSTATUS.PENDING || docStatus === DocSTATUS.OPEN) && receiverId && allReferences && Array.isArray(allReferences)) {
    const receiverReference = allReferences.find((ref: any) => ref.id === receiverId);
    receiverHasBuxgalter = receiverReference?.refValues?.hasBuxgalter === true;
    const userEnterpriseId = user?.enterpriseId;

    if (id && token) {
      const document = await fetchDocumentById(id, token);
      isMoveCash = document?.documentType === DocumentType.MoveCash;
      isReceiverForBuxgalter = !!(isMoveCash &&
                                  receiverHasBuxgalter &&
                                  userEnterpriseId &&
                                  receiverReference?.enterpriseId === userEnterpriseId);
    }
  }

  const pendingAllowSetProvodka =
    docStatus === DocSTATUS.PENDING &&
    (isReceiverForBuxgalter ||
      (immediateProvodka && !(isMoveCash && receiverHasBuxgalter)));

  if (docStatus == DocSTATUS.OPEN || pendingAllowSetProvodka) {
    let yes = confirm('Хужжатга проводка берамизми')
    
    let docUserId: number | undefined;
    let docType: DocumentType | string | undefined;
    if (id === currentDocument?.id) {
      docUserId = currentDocument?.userId;
      docType = currentDocument?.documentType;
    } else if (id && token) {
      const document = await fetchDocumentById(id, token);
      docUserId = document?.userId;
      docType = document?.documentType;
    }

    const zavskladCanProve = canZavskladEditDocument(user, docType);
    const advanceCanProve =
      docType === DocumentType.Advance &&
      (user?.role == UserRoles.ADMINGLOBAL ||
        user?.role == UserRoles.HEADCOMPANY ||
        user?.role == UserRoles.GLAVBUX ||
        user?.role == UserRoles.KASSIRGLOBAL ||
        user?.role == UserRoles.KASSIR);

    if (
        yes && 
        ( user?.role == UserRoles.ADMINGLOBAL || 
          user?.role == UserRoles.HEADCOMPANY ||
          user?.id == docUserId ||
          isReceiverForBuxgalter ||
          zavskladCanProve ||
          advanceCanProve
        )
    ){
      setIsDisabled(true)
      try {
        await setProvodkaToDocument(id, setMainData, mainData)
      } finally {
        setIsDisabled(false)
      }
    } else {
      alert('Узр. Сиз ушбу хужжатга проводка бера олмайсиз')
    }
  } else if (docStatus === DocSTATUS.PENDING) {
    alert(
      'Бу хужжат тасдиклашни кутмокда. Проводка фақат HEADGLOBAL томонидан тасдиклаш орқали берилади.',
    );
  } else {
    alert('Аввал, хужжат холатини узгартиринг');
  }
}

export const getTotalValueForDocument = (document: DocumentModel): number => {
  return document.docValues.total;
}

export const cleanDocs = (dateStart: number, dateEnd: number, token: string | undefined, setMainData: Function | undefined,) =>{
  const nowInString = dateNumberToString(Date.now())
  const dateEndInString = dateNumberToString(dateEnd)
  
  if (nowInString == dateEndInString) {
      if (confirm('Хужжатларни тозалашга бугунги кунги хужжатлар ха кираяпти. Сиз розимизсиз?')) {
        deleteComeProducts(dateStart, dateEnd, token, setMainData)
      }
  } else {
    deleteComeProducts(dateStart, dateEnd, token, setMainData)
  }
}


export const getNameReference = (references: any, id: number | undefined | null | string): string => {
  if (references && references.length > 0) {
    return references.filter((item: ReferenceModel) => item.id == id)[0]?.name
  }
  return 'Аникланмади'
}

export const getPhoneReference = (references: any, id: number | undefined | null): string => {
  if (references && references.length > 0) {
    return references.filter((item: ReferenceModel) => item.id == id)[0]?.refValues?.phone
  }
  return '-'
}

export const getAddressReference = (references: any, id: number | undefined | null): string => {
  if (references && references.length > 0) {
    return references.filter((item: ReferenceModel) => item.id == id)[0]?.refValues?.address
  }
  return '-'
}

export const getInnReference = (references: any, id: number | undefined | null): string => {
  if (references && references.length > 0) {
    return references.filter((item: ReferenceModel) => item.id == id)[0]?.refValues?.inn
  }
  return '-'
}

export const getUnitReference = (references: any, id: number | undefined | null): string => {
  if (references && references.length > 0) {
    return references.filter((item: ReferenceModel) => item.id == id)[0]?.refValues?.unit
  }
  return 'шт'
}


export const isFounder = (references: any, id: number | undefined | null): boolean => {
  if (references && references.length > 0) {
    let item = references.filter((item: ReferenceModel) => item.id == id)[0]
    return item?.refValues?.typeSection == TypeSECTION.FOUNDER
  }
  return false
}

export const getNameEnterprise = (enterprises: any, id: number | undefined | null): string => {
  if (enterprises && enterprises.length > 0) {
    const enterprise = enterprises.find((item: any) => item.id == id);
    return enterprise?.name || 'Аникланмади';
  }
  return 'Аникланмади';
}

export const getTypeSectionByReferenceId = (references: ReferenceModel[] | undefined, id: number | undefined | null): TypeSECTION | null => {
  if (!references || !id) return null;
  const ref = references.find((item: ReferenceModel) => item.id == id);
  return ref?.refValues?.typeSection || null;
}

export const getIsForeignByReferenceId = (references: ReferenceModel[] | undefined, id: number | undefined | null): boolean | null => {
  if (!references || !id) return null;
  const ref = references.find((item: ReferenceModel) => item.id == id);
  return ref?.refValues?.isForeign ?? null;
}