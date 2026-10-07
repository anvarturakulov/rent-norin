'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { DocProps } from './doc.props';
import styles from './doc.module.css';
import { Button, DocValues, Info } from '@/app/components';
import { useAppContext } from '@/app/context/app.context';
import { cancelSubmit, saveUser } from './helpers/doc.functions';
import { canUserEditOrProveDocument } from '@/app/service/common/users';
import { DocSTATUS, DocumentModel, DocumentType, RentTariffType } from '@/app/interfaces/document.interface';
import { Maindata } from '@/app/context/app.context.interfaces';
import { getFilledDocTableItems, getValidateBodyError } from '@/app/service/documents/validateBody';
import { filterAdvanceLines } from '@/app/service/documents/advanceLines';
import { showMessage } from '@/app/service/common/showMessage';
import { updateCreateDocument } from '@/app/service/documents/updateCreateDocument';
import { WindowControls } from '@/app/components/common/windowControls/windowControls';
import { minimizeDocument } from '@/app/service/common/minimizeWindow';
import { getDateBanEditingValue, isDocumentDateBanned, DATE_BAN_EDITING_MESSAGE } from '@/app/service/settings/dateBanEditing';
import { UserRoles } from '@/app/interfaces/user.interface';
import { recalculateSaleProdCosts } from '@/app/service/documents/recalculateSaleProdCosts';
import useSWR, { mutate as globalMutate } from 'swr';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { focusNextFocusable, focusPreviousFocusable } from '@/app/utils/focusNextFocusable';
import { importInitialMaterialsRemain } from '@/app/service/documents/importInitialMaterialsRemain';
import {
    formatOsRemainsImportMessage,
    importInitialOsRemain,
} from '@/app/service/documents/importInitialOsRemain';
import {
    formatMaterialAttrsImportMessage,
    importMaterialAttributesFromXlsx,
} from '@/app/service/documents/importMaterialAttributesFromXlsx';
import { getReferenceById } from '@/app/service/references/getReferenceById';
import {
    canReopenProvedenDocument,
    deleteItemDocument,
} from '@/app/components/journals/journal/helpers/journal.functions';
import { cancelInterEnterpriseProvodka } from '@/app/service/documents/interEnterpriseActions';
import IcoTrash from '@/app/components/journals/journal/ico/trash.svg';
import { useTransferToolsPrint } from '../docValues/components/transferToolsPrintSection/transferToolsPrintSection';
import { useReceiveToolsPrint } from '../docValues/components/receiveToolsPrintSection/receiveToolsPrintSection';
import {
    isReceiveToolsPaymentFilled,
    isReceiveToolsPaymentGatePassed,
} from '@/app/service/documents/optionalPaymentFields';
import { fetchClientS40Balance } from '@/app/service/documents/fetchClientS40Balance';
import { getBalanceTargetDate } from '../docValues/components/clientBalanceInfo/clientBalanceCalculations';
import PaymentNotFilledModal from '../docValues/components/paymentNotFilledModal/paymentNotFilledModal';
import { createTransferFromRentalOrder } from '@/app/service/documents/rentalOrdersApi';
import { getDocumentById } from '@/app/service/documents/getDocumentById';

function formatImportProgressLabel(progress: { processed: number; total: number } | null): string {
    if (!progress) return 'Юкланмокда...';
    return `Юкланмокда... ${progress.processed}/${progress.total}`;
}

export const Doc = ({className, ...props }: DocProps) :JSX.Element => {
    
    const {mainData, setMainData} = useAppContext();
    const { contentTitle, isNewDocument, contentName, isDuplicateDraft } = mainData.document;
    const { user } = mainData.users
    const targetEnterpriseId = mainData.report?.selectedEnterpriseId ?? user?.enterpriseId ?? null;
    const { currentDocument } = mainData.document;
    const [disabled, setDisabled] = useState<boolean>(false)
    const savingRef = useRef(false)
    const [isRecalculating, setIsRecalculating] = useState<boolean>(false)
    const [isImportingRemains, setIsImportingRemains] = useState<boolean>(false)
    const [importRemainsProgress, setImportRemainsProgress] = useState<{ processed: number; total: number } | null>(null)
    const remainsFileInputRef = useRef<HTMLInputElement>(null)
    const [isImportingAttrs, setIsImportingAttrs] = useState<boolean>(false)
    const [importAttrsProgress, setImportAttrsProgress] = useState<{ processed: number; total: number } | null>(null)
    const attrsFileInputRef = useRef<HTMLInputElement>(null)
    const [isImportingOsRemains, setIsImportingOsRemains] = useState<boolean>(false)
    const [importOsRemainsProgress, setImportOsRemainsProgress] = useState<{ processed: number; total: number } | null>(null)
    const osRemainsFileInputRef = useRef<HTMLInputElement>(null)
    const [showPaymentNotFilledModal, setShowPaymentNotFilledModal] = useState(false)
    const [creatingTransfer, setCreatingTransfer] = useState(false)

    const { handlePrint: handleTransferToolsPrint, PrintContent: transferToolsPrintContent } = useTransferToolsPrint();
    const { handlePrint: handleReceiveToolsPrint, PrintContent: receiveToolsPrintContent } = useReceiveToolsPrint();

    const REFERENCES_ALL_KEY = `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/all/`

    // Загружаем все справочники для проверки isOffice у receiver
    const { data: allReferences } = useSWR(
        user?.token ? REFERENCES_ALL_KEY : null,
        (url) => getDataForSwr(url, user?.token)
    );

    useSWR(
        user?.token ? 'dateBanEditing' : null,
        () => getDateBanEditingValue(user?.token),
        {
            onSuccess: (value) => {
                if (setMainData) {
                    setMainData('settings.dateBanEditing', value ?? null);
                }
            },
            revalidateOnFocus: true,
        }
    );

    useEffect(() => {
        if (!currentDocument.userId) {
            saveUser(setMainData, mainData)
        }
    },[])

    
    useEffect(() => {
        if (isNewDocument && !isDuplicateDraft) {
            const isSaleMaterial =
                mainData.document.contentName === DocumentType.SaleMaterial;
            const newDocument: DocumentModel= {
                ...currentDocument,
                date: currentDocument.date,
                userId: mainData.users.user?.id ? mainData.users.user?.id : 0,
                documentType: mainData.document.contentName as DocumentType,
                docValues: {
                    ...currentDocument.docValues,
                    analiticId: 0,
                    productForChargeId: 0,
                    comment : '',
                    ...(isSaleMaterial
                        ? {
                            isClient: true,
                            isWorker: false,
                            isPartner: false,
                          }
                        : {}),
                }
            };
            if (setMainData) {
                setMainData('currentDocument', newDocument);
            }

        }
    }, [isNewDocument, isDuplicateDraft]);

    
    const releaseSaving = () => {
        savingRef.current = false
        setDisabled(false)
    }

    const onSubmit = async ( mainData: Maindata, setMainData: Function| undefined, saveOnly = false ) => {
        if (savingRef.current) {
            return
        }
        savingRef.current = true
        setDisabled(true)

        const {currentDocument, contentName} = mainData.document;
        const {user} = mainData.users

        try {
        const dateBanEditing = mainData.settings?.dateBanEditing ?? await getDateBanEditingValue(user?.token)
        let body: DocumentModel = {
            ...currentDocument
        }
        if (isDocumentDateBanned(body.date, dateBanEditing)) {
            alert(DATE_BAN_EDITING_MESSAGE)
            releaseSaving()
            return false
        }

        if (body.date == undefined) body.date = 0
        const oneDay = (24 * 60 * 60 * 1000)
        const now = Date.now()
        const remainTime = now % oneDay
        const oneDayAgo = ( now - remainTime ) - oneDay
        const twoDaysAgo = oneDayAgo - oneDay
        const threeDaysAgo = twoDaysAgo - oneDay
        const fiveDaysAgo = threeDaysAgo - oneDay - oneDay

        const leftDays = new Date().getDay() === 1 ? fiveDaysAgo : oneDayAgo 
        
        // if (user?.role != UserRoles.ADMINGLOBAL) {
        //     if (body.date < leftDays) {
        //         alert('Сана хато киритилди')
        //         return false
        //     }
        // }
        
        // HEADGLOBAL и GUEST могут только просматривать
        if (user?.role == UserRoles.HEADGLOBAL || user?.role == UserRoles.GUEST) {
            alert('Узр. Сиз факат кўриш хукукига эгасиз')
            releaseSaving()
            return false
        }

        if (user?.id) body.userId = user.id
        
        // Проверка: senderId и receiverId не должны быть одинаковыми (кроме ZpCalculate)
        if (
            (
                body.documentType !== DocumentType.ZpCalculate 
                && body.documentType !== DocumentType.GateIncome
                && body.documentType !== DocumentType.LeaveMaterial
                && body.documentType !== DocumentType.LeaveOnlyOneMaterial
                && body.documentType !== DocumentType.AmortizasiyaOS
                && body.documentType !== DocumentType.Advance
            ) && 
            body.docValues?.senderId && 
            body.docValues?.receiverId && 
            body.docValues.senderId === body.docValues.receiverId) {
            showMessage('Олувчи ва жунатувчи бир хил бўлмайди', 'error', setMainData);
            releaseSaving()
            return false
        }

        if (body.documentType === DocumentType.LeaveOnlyOneMaterial) {
            const countValue = Number(body.docValues?.count || 0);
            const remainCount = Number(body.docValues?.remainCount || 0);
            if (countValue > remainCount) {
                showMessage(`Количество не может быть больше остатка (${remainCount})`, 'error', setMainData);
                releaseSaving();
                return false;
            }
        }


        // ComeProduct: шапочный документ, таблицы нет
        body = {
            ...body,
            docTableItems: body.documentType === DocumentType.Advance
                ? filterAdvanceLines(body.docTableItems)
                : getFilledDocTableItems(body.docTableItems),
        };

        if (body.documentType === DocumentType.TransferToolsToClient) {
            const settlementDate = Number(body.docValues?.settlementDate || 0);
            const rentTariffType =
                body.docValues?.rentTariffType === RentTariffType.TRANSFER
                    ? RentTariffType.TRANSFER
                    : RentTariffType.CASH;
            body = {
                ...body,
                docValues: {
                    ...body.docValues,
                    settlementDate: settlementDate > 0 ? settlementDate : Date.now(),
                    rentTariffType,
                },
            };
        }

        if (body.documentType === DocumentType.OrderToolsToClient) {
            const rentTariffType =
                body.docValues?.rentTariffType === RentTariffType.TRANSFER
                    ? RentTariffType.TRANSFER
                    : RentTariffType.CASH;
            body = {
                ...body,
                docValues: {
                    ...body.docValues,
                    rentTariffType,
                },
            };
        }

        const validationError = getValidateBodyError(body);
        if (validationError) {
            showMessage(validationError, 'error', setMainData);
            releaseSaving()
            return
        }

        if (!saveOnly && (body.documentType === DocumentType.ReceiveToolsFromClient || body.documentType === DocumentType.ReceiveSubleaseToolsFromClient)) {
            const clientId = Number(body.docValues?.senderId || 0);
            let paymentGatePassed = false;

            if (clientId > 0 && user?.token) {
                try {
                    const beforeS40 = await fetchClientS40Balance({
                        clientId,
                        endDate: getBalanceTargetDate(body.date),
                        token: user.token,
                        enterpriseId: body.enterpriseId ?? user.enterpriseId,
                    });
                    paymentGatePassed = isReceiveToolsPaymentGatePassed(
                        body.docValues,
                        body.docTableItems,
                        beforeS40,
                    );
                } catch {
                    // Баланс недоступен — строгое поведение: требуем заполненную оплату
                    paymentGatePassed = isReceiveToolsPaymentFilled(body.docValues);
                }
            } else {
                paymentGatePassed = isReceiveToolsPaymentFilled(body.docValues);
            }

            if (!paymentGatePassed) {
                setShowPaymentNotFilledModal(true);
                releaseSaving();
                return;
            }
        }

        const saved = await updateCreateDocument(mainData, setMainData, saveOnly);
        if (!saved || saveOnly) {
            releaseSaving()
        }
        } catch {
            releaseSaving()
        }
    }
    // Определяем, можно ли редактировать документ
    const canEditDocument = () => {
        // Новые документы всегда можно редактировать (дату можно сменить на открытый период)
        if (isNewDocument) {
            return true;
        }

        if (isDocumentDateBanned(currentDocument.date, mainData.settings?.dateBanEditing)) {
            return false;
        }

        // Проверка прав пользователя (в т.ч. ZAVSKLAD для складских списаний)
        if (!canUserEditOrProveDocument(user, currentDocument.documentType)) {
            return false;
        }

        // Проверка статуса DELETED - удаленные документы нельзя редактировать
        if (currentDocument.docStatus === DocSTATUS.DELETED) {
            return false;
        }

        // Проверка статуса
        if (currentDocument.docStatus === DocSTATUS.PROVEDEN) {
            return false;
        }

        // Для межпредприятийных документов - специальная логика
        if (currentDocument.isInterEnterprise) {
            const userEnterpriseId = user?.enterpriseId;
            
            // Если статус PENDING - документ отправлен, редактировать нельзя
            if (currentDocument.docStatus === DocSTATUS.PENDING) {
                return false;
            }
            
            // Если статус OPEN - проверяем специальные случаи
            if (currentDocument.docStatus === DocSTATUS.OPEN) {
                // Специальный случай: для ComeCashFromClients с офисной кассой принимающая сторона может редактировать
                if (currentDocument.documentType === DocumentType.ComeCashFromClients) {
                    const receiverId = currentDocument.docValues?.receiverId;
                    if (receiverId && Array.isArray(allReferences)) {
                        const receiver = allReferences.find((ref: ReferenceModel) => ref.id === receiverId);
                        const isOffice = receiver?.refValues?.isOffice === true;
                        const isReceiver = currentDocument.targetEnterpriseId === userEnterpriseId;
                        
                        // Если receiver является офисной кассой и пользователь - принимающая сторона, разрешаем редактирование
                        if (isOffice && isReceiver) {
                            // Проверяем, что документ не заблокирован
                            if (currentDocument.isLocked === true) {
                                return false;
                            }
                            return true;
                        }
                    }
                }
                
                // Стандартная логика: только отправитель может редактировать
                return currentDocument.sourceEnterpriseId === userEnterpriseId;
            }
            
            // Если статус REJECTED - только отправитель может вернуть в работу (редактировать)
            if (currentDocument.docStatus === DocSTATUS.REJECTED) {
                return currentDocument.sourceEnterpriseId === userEnterpriseId;
            }
            
            // Для других статусов межпредприятийных документов - нельзя редактировать
            return false;
        }

        // Для обычных документов - стандартная логика
        return true;
    };

    const showReopenProvedenButton = useMemo(() => {
        if (isNewDocument || !currentDocument?.id) {
            return false;
        }
        return canReopenProvedenDocument(
            currentDocument,
            user,
            allReferences as ReferenceModel[] | undefined,
        );
    }, [isNewDocument, currentDocument, user, allReferences]);

    const handleReopenProveden = () => {
        if (!currentDocument?.id || !setMainData) {
            return;
        }

        if (
            currentDocument.isInterEnterprise &&
            currentDocument.docStatus === DocSTATUS.PROVEDEN
        ) {
            if (
                confirm(
                    'Проводкани бекор килишни хохлайсизми? Барча проводкалар, stocks ва oborots бекор килинади.',
                )
            ) {
                cancelInterEnterpriseProvodka(currentDocument.id, setMainData, mainData);
            }
            return;
        }

        if (
            confirm('Проводкани бекор қилиб, хужжатни таҳрирлаш учун очасизми?')
        ) {
            deleteItemDocument(
                currentDocument.id,
                currentDocument.date,
                user?.token,
                setMainData,
                mainData,
                setDisabled,
                { reopen: true },
            );
        }
    };

    const handleCreateTransferFromOrder = async () => {
        const orderId = Number(currentDocument?.id) || 0;
        if (!orderId || !user?.token || !setMainData) return;
        setCreatingTransfer(true);
        try {
            const created = await createTransferFromRentalOrder(orderId, user.token);
            if (created?.id) {
                setMainData('contentName', DocumentType.TransferToolsToClient);
                setMainData('contentTitle', 'Топшириш');
                getDocumentById(created.id, setMainData, user.token, true, mainData);
            }
        } catch (error: any) {
            const raw =
                error?.response?.data?.message ||
                error?.message ||
                'Топшириш яратишда хатолик';
            const message = Array.isArray(raw) ? raw.join('; ') : String(raw);
            showMessage(message, 'error', setMainData);
        } finally {
            setCreatingTransfer(false);
        }
    };

    // Функция обработки пересчета себестоимости
    const handleRecalculateCosts = async () => {
        if (!currentDocument.id || !user?.token) return;
        
        console.log('\n🔄 [FRONTEND] ========== НАЧАЛО ПЕРЕСЧЕТА СЕБЕСТОИМОСТИ (КНОПКА) ==========');
        console.log('📋 [FRONTEND] ID документа:', currentDocument.id);
        console.log('📋 [FRONTEND] Тип документа:', currentDocument.documentType);
        console.log('📅 [FRONTEND] Дата документа:', currentDocument.date);
        console.log('🏪 [FRONTEND] Склад отправителя (senderId):', currentDocument.docValues?.senderId);
        console.log('📦 [FRONTEND] Элементы документа перед пересчетом:', currentDocument.docTableItems?.map((item, idx) => ({
          индекс: idx,
          analiticId: item.analiticId,
          count: item.count,
          costPrice: item.costPrice,
          costTotal: item.costTotal
        })));
        
        setIsRecalculating(true);
        try {
            const updatedDocument = await recalculateSaleProdCosts(
                currentDocument.id,
                user.token
            );
            
            console.log('\n✅ [FRONTEND] Получен обновленный документ с бэкенда:');
            console.log('📦 [FRONTEND] Элементы документа после пересчета:', updatedDocument.docTableItems?.map((item, idx) => ({
              индекс: idx,
              analiticId: item.analiticId,
              count: item.count,
              costPrice: item.costPrice,
              costTotal: item.costTotal,
              изменение_costPrice: currentDocument.docTableItems?.[idx]?.costPrice !== item.costPrice ? 
                `${currentDocument.docTableItems[idx]?.costPrice || 0} → ${item.costPrice}` : 'без изменений',
              изменение_costTotal: currentDocument.docTableItems?.[idx]?.costTotal !== item.costTotal ? 
                `${currentDocument.docTableItems[idx]?.costTotal || 0} → ${item.costTotal}` : 'без изменений'
            })));
            
            // Преобразуем date из string/bigint в number, если необходимо
            // Sequelize возвращает bigint как строку при JSON сериализации
            if (updatedDocument.date) {
                if (typeof updatedDocument.date === 'string') {
                    updatedDocument.date = parseInt(updatedDocument.date, 10);
                } else if (typeof updatedDocument.date === 'bigint') {
                    updatedDocument.date = Number(updatedDocument.date);
                }
            }
            
            // Обновляем документ в контексте
            if (setMainData) {
                setMainData('currentDocument', updatedDocument);
                showMessage('Таннарх успешно кайта хисобланди', 'success', setMainData);
            }
            
            console.log('✅ [FRONTEND] ========== ЗАВЕРШЕНИЕ ПЕРЕСЧЕТА СЕБЕСТОИМОСТИ ==========\n');
        } catch (error: any) {
            console.error('❌ [FRONTEND] Ошибка пересчета себестоимости:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Ошибка при пересчете себестоимости';
            showMessage(errorMessage, 'error', setMainData);
        } finally {
            setIsRecalculating(false);
        }
    };

    const handleImportRemainsClick = () => {
        remainsFileInputRef.current?.click()
    }

    const handleImportRemainsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!user?.token) {
            showMessage('Нет токена пользователя', 'error', setMainData)
            return
        }
        if (!Array.isArray(allReferences)) {
            showMessage('Справочники ещё не загружены, попробуйте чуть позже', 'warm', setMainData)
            if (remainsFileInputRef.current) remainsFileInputRef.current.value = ''
            return
        }

        const senderId = currentDocument?.docValues?.senderId
        const receiverId = currentDocument?.docValues?.receiverId
        if (!senderId || !receiverId) {
            const proceed = window.confirm(
                'Жунатувчи (sender) ва/ёки олувчи (receiver) танланмаган. Импортни давом эттирамизми? Хужжатни саклашдан олдин уларни киритинг.'
            )
            if (!proceed) {
                if (remainsFileInputRef.current) remainsFileInputRef.current.value = ''
                return
            }
        }

        setIsImportingRemains(true)
        setImportRemainsProgress({ processed: 0, total: 0 })
        try {
            const result = await importInitialMaterialsRemain({
                file,
                token: user.token,
                allReferences: allReferences as ReferenceModel[],
                onProgress: (processed, total) => setImportRemainsProgress({ processed, total }),
            })

            const targetDate = new Date(2024, 11, 30).getTime()

            if (setMainData) {
                setMainData('currentDocument', {
                    ...currentDocument,
                    date: targetDate,
                    docTableItems: [
                        ...((currentDocument.docTableItems) || []),
                        ...result.newItems,
                    ],
                })
            }

            // Обновляем кэш справочников, чтобы новые позиции отрисовались
            globalMutate(
                (key) => typeof key === 'string' && key.includes('/api/references/'),
                undefined,
                { revalidate: true },
            )

            const summary = `Импорт остатков: создано материалов ${result.createdMaterials}, групп ${result.createdGroups}, обновлено ${result.updatedMaterials}; периодика (firstPrice) ${result.createdPereodics}; добавлено в документ ${result.newItems.length} строк${result.skipped ? `; пропущено ${result.skipped}` : ''}${result.errors.length ? `; ошибок ${result.errors.length}` : ''}`
            showMessage(summary, result.errors.length ? 'warm' : 'success', setMainData)
            if (result.errors.length) {
                console.warn('Импорт остатков — ошибки:', result.errors)
            }
        } catch (err: any) {
            console.error('Ошибка импорта остатков:', err)
            const msg = err?.response?.data?.message || err?.message || 'Ошибка импорта файла'
            showMessage(msg, 'error', setMainData)
        } finally {
            setIsImportingRemains(false)
            setImportRemainsProgress(null)
            if (remainsFileInputRef.current) remainsFileInputRef.current.value = ''
        }
    }

    const handleImportOsRemainsClick = () => {
        osRemainsFileInputRef.current?.click()
    }

    const handleImportOsRemainsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!user?.token) {
            showMessage('Нет токена пользователя', 'error', setMainData)
            return
        }
        if (!Array.isArray(allReferences)) {
            showMessage('Справочники ещё не загружены, попробуйте чуть позже', 'warm', setMainData)
            if (osRemainsFileInputRef.current) osRemainsFileInputRef.current.value = ''
            return
        }

        const senderId = currentDocument?.docValues?.senderId
        const receiverId = currentDocument?.docValues?.receiverId
        if (!senderId || !receiverId) {
            const proceed = window.confirm(
                'Жунатувчи (sender) ва/ёки олувчи (receiver) танланмаган. Импортни давом эттирамизми? Хужжатни саклашдан олдин уларни киритинг.'
            )
            if (!proceed) {
                if (osRemainsFileInputRef.current) osRemainsFileInputRef.current.value = ''
                return
            }
        }

        setIsImportingOsRemains(true)
        setImportOsRemainsProgress({ processed: 0, total: 0 })
        try {
            const result = await importInitialOsRemain({
                file,
                token: user.token,
                allReferences: allReferences as ReferenceModel[],
                onProgress: (processed, total) => setImportOsRemainsProgress({ processed, total }),
            })

            const targetDate = new Date(2026, 4, 1).getTime()

            if (setMainData) {
                setMainData('currentDocument', {
                    ...currentDocument,
                    date: targetDate,
                    docTableItems: [
                        ...((currentDocument.docTableItems) || []),
                        ...result.newItems,
                    ],
                })
            }

            globalMutate(
                (key) => typeof key === 'string' && key.includes('/api/references/'),
                undefined,
                { revalidate: true },
            )

            const summary = formatOsRemainsImportMessage(result)
            const hasIssues = result.skipped > 0 || result.errors.length > 0
            showMessage(summary, hasIssues ? 'warm' : 'success', setMainData)
            if (hasIssues) {
                console.warn('Импорт остатков ОС — пропущено:', result.skippedItems, 'ошибки:', result.errors)
            }
        } catch (err: any) {
            console.error('Ошибка импорта остатков ОС:', err)
            const msg = err?.response?.data?.message || err?.message || 'Ошибка импорта файла'
            showMessage(msg, 'error', setMainData)
        } finally {
            setIsImportingOsRemains(false)
            setImportOsRemainsProgress(null)
            if (osRemainsFileInputRef.current) osRemainsFileInputRef.current.value = ''
        }
    }

    const handleImportAttrsClick = () => {
        attrsFileInputRef.current?.click()
    }

    const handleImportAttrsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!user?.token) {
            showMessage('Нет токена пользователя', 'error', setMainData)
            return
        }
        if (!Array.isArray(allReferences)) {
            showMessage('Справочники ещё не загружены, попробуйте чуть позже', 'warm', setMainData)
            if (attrsFileInputRef.current) attrsFileInputRef.current.value = ''
            return
        }

        setIsImportingAttrs(true)
        setImportAttrsProgress({ processed: 0, total: 0 })
        try {
            const result = await importMaterialAttributesFromXlsx({
                file,
                token: user.token,
                allReferences: allReferences as ReferenceModel[],
                enterpriseId: targetEnterpriseId,
                onProgress: (processed, total) => setImportAttrsProgress({ processed, total }),
            })

            globalMutate(
                (key) => typeof key === 'string' && key.includes('/api/references/'),
                undefined,
                { revalidate: true },
            )

            const openRefId = mainData.reference?.currentReference?.id
            if (
                openRefId != null &&
                result.updatedIds.includes(openRefId) &&
                mainData.reference?.showReferenceWindow
            ) {
                getReferenceById(openRefId, setMainData, user.token)
            }

            const summary = formatMaterialAttrsImportMessage(result)
            showMessage(summary, result.skipped > 0 ? 'warm' : 'success', setMainData)
            if (result.errors.length) {
                console.warn('Импорт характеристик — ошибки:', result.errors)
            }
        } catch (err: any) {
            console.error('Ошибка импорта характеристик:', err)
            const msg = err?.response?.data?.message || err?.message || 'Ошибка импорта файла'
            showMessage(msg, 'error', setMainData)
        } finally {
            setIsImportingAttrs(false)
            setImportAttrsProgress(null)
            if (attrsFileInputRef.current) attrsFileInputRef.current.value = ''
        }
    }

    const BtnBox = (
        <div className={styles.boxBtn} data-doc-actions>
            {
                canEditDocument() &&
                <>
                    {/* Кнопка пересчета себестоимости только для SaleProd */}
                    {currentDocument.documentType === DocumentType.SaleProd && (
                        <button
                            type="button"
                            className={styles.button}
                            disabled={disabled || isRecalculating}
                            onClick={handleRecalculateCosts}
                            title="Таннархни кайта хисоблаш"
                        >
                            {isRecalculating ? 'Кайта хисобланмокда...' : '💰 Таннархни кайта хисоблаш'}
                        </button>
                    )}

                    {/* Временная кнопка ввода остатков — скрыта */}
                    {false && currentDocument.documentType === DocumentType.ComeMaterial && (
                        <>
                            <input
                                ref={remainsFileInputRef}
                                type="file"
                                accept=".xlsx"
                                style={{ display: 'none' }}
                                onChange={handleImportRemainsFile}
                            />
                            <button
                                type="button"
                                className={styles.button}
                                disabled={disabled || isImportingRemains}
                                onClick={handleImportRemainsClick}
                                title="Колдикларни xlsx файлдан киритиш (вакт.)"
                            >
                                {isImportingRemains
                                    ? formatImportProgressLabel(importRemainsProgress)
                                    : 'Ввод остатков (xlsx)'}
                            </button>
                        </>
                    )}

                    {/* Импорт характеристик из xlsx — временно скрыт */}
                    {false && currentDocument.documentType === DocumentType.ComeMaterial && (
                        <>
                            <input
                                ref={attrsFileInputRef}
                                type="file"
                                accept=".xlsx"
                                style={{ display: 'none' }}
                                onChange={handleImportAttrsFile}
                            />
                            <a
                                href="/data/yangiMat.xlsx"
                                download="yangiMat.xlsx"
                                className={styles.button}
                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                title="Образец файла для импорта характеристик материалов"
                            >
                                Скачать образец
                            </a>
                            <button
                                type="button"
                                className={styles.button}
                                disabled={disabled || isImportingAttrs}
                                onClick={handleImportAttrsClick}
                                title="Ўлчам, ранг ва ишлаб чиқарувчи xlsx файлдан янгилаш"
                            >
                                {isImportingAttrs
                                    ? formatImportProgressLabel(importAttrsProgress)
                                    : 'Импорт ўлчам/ранг (xlsx)'}
                            </button>
                        </>
                    )}

                    {currentDocument.documentType === DocumentType.ComeOS && (
                        <>
                            <input
                                ref={osRemainsFileInputRef}
                                type="file"
                                accept=".xlsx"
                                style={{ display: 'none' }}
                                onChange={handleImportOsRemainsFile}
                            />
                            <button
                                type="button"
                                className={styles.button}
                                disabled={disabled || isImportingOsRemains}
                                onClick={handleImportOsRemainsClick}
                                title="Асосий воситалар колдигини xlsx файлдан киритиш"
                            >
                                {isImportingOsRemains
                                    ? formatImportProgressLabel(importOsRemainsProgress)
                                    : 'Ввод остатков (xlsx)'}
                            </button>
                        </>
                    )}

                    <button 
                        type="button"
                        className={styles.button}
                        disabled = {disabled || isRecalculating || isImportingRemains || isImportingAttrs || isImportingOsRemains} 
                        onClick={() => onSubmit(mainData, setMainData, true)}
                        data-document-save
                        title="Сақлаш (проводкасиз)"
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight') {
                                if (docBoxRef.current && focusNextFocusable(docBoxRef.current, e.currentTarget)) {
                                    e.preventDefault();
                                }
                            }
                        }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            Саклаш
                    </button>

                    <button 
                        type="button"
                        className={styles.buttonOk}
                        disabled = {disabled || isRecalculating || isImportingRemains || isImportingAttrs || isImportingOsRemains} 
                        onClick={() => onSubmit(mainData, setMainData, false)}
                        title="Сақлаш ва ўтказиш"
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowLeft') {
                                if (docBoxRef.current && focusPreviousFocusable(docBoxRef.current, e.currentTarget)) {
                                    e.preventDefault();
                                }
                            }
                        }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            {disabled ? 'Сақланмоқда...' : 'OK'}
                    </button>
                    
                    <button
                        type="button"
                        className={styles.buttonCancel}
                        disabled={disabled}
                        onClick={() => {
                            if (savingRef.current) return;
                            cancelSubmit(setMainData, mainData);
                        }}
                        title="Бекор қилиш"
                    >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            Бекор килиш
                    </button>
                </>
            }
            {currentDocument.documentType === DocumentType.OrderToolsToClient &&
                currentDocument.docStatus === DocSTATUS.PROVEDEN &&
                !Number(currentDocument.docValues?.fulfilledByTransferDocId) && (
                <button
                    type="button"
                    className={styles.button}
                    disabled={creatingTransfer}
                    onClick={handleCreateTransferFromOrder}
                    title="Топшириш яратиш"
                >
                    {creatingTransfer ? 'Яратилмоқда...' : 'Топшириш яратиш'}
                </button>
            )}
            {currentDocument.documentType === DocumentType.TransferToolsToClient && (
                <button
                    type="button"
                    className={styles.button}
                    onClick={() => handleTransferToolsPrint()}
                    title="Чоп этиш"
                >
                    🖨️ Чоп этиш
                </button>
            )}
            {currentDocument.documentType === DocumentType.ReceiveToolsFromClient && (
                <button
                    type="button"
                    className={styles.button}
                    onClick={() => handleReceiveToolsPrint()}
                    title="Чоп этиш"
                >
                    Чоп этиш
                </button>
            )}
        </div>
    )

    const docBoxRef = useRef<HTMLDivElement>(null);

    const handleEnterFocusNext = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.defaultPrevented) return;
        const container = docBoxRef.current;
        if (!container) return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (!container.contains(target)) return;
        if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') {
            return;
        }
        if (focusNextFocusable(container, target, { preferDocumentSaveInActionBar: true })) {
            e.preventDefault();
        }
    }, []);

    const handleClose = () => {
        if (!setMainData || savingRef.current) return
        const previousContentName = mainData.document.previousContentName;
        if (previousContentName) {
            setMainData('contentName', previousContentName);
        }
        setMainData('document.previousContentName', undefined);
        setMainData('document.keepHostPageOnClose', false);
        setMainData('clearControlElements', true);
        setMainData('showDocumentWindow', false )
        setMainData('isNewDocument', false )
        setMainData('document.isDuplicateDraft', false)
    }

    const handleMinimize = () => {
        if (!setMainData || savingRef.current) return;
        minimizeDocument(mainData, setMainData);
    };

    return (
        <div
            ref={docBoxRef}
            className={styles.docBox}
            data-doc-form
            onKeyDown={handleEnterFocusNext}
        >
            <DocValues/>
            {currentDocument.documentType === DocumentType.TransferToolsToClient && transferToolsPrintContent}
            {currentDocument.documentType === DocumentType.ReceiveToolsFromClient && receiveToolsPrintContent}
            {BtnBox}
            {showReopenProvedenButton && (
                <div className={styles.boxBtnReopen} data-doc-reopen-actions>
                    <button
                        type="button"
                        className={styles.buttonReopen}
                        disabled={disabled}
                        onClick={handleReopenProveden}
                        title="Проводкани бекор қилиш ва таҳрирлаш учун очиш"
                    >
                        <IcoTrash className={styles.icoTrashReopen} aria-hidden />
                        Проводкани бекор қилиш
                    </button>
                </div>
            )}
            <WindowControls onMinimize={handleMinimize} onClose={handleClose} disabled={disabled} />
            <PaymentNotFilledModal
                open={showPaymentNotFilledModal}
                onClose={() => setShowPaymentNotFilledModal(false)}
            />
        </div>   
    )
} 