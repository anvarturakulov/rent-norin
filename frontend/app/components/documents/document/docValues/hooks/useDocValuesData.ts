import { useMemo } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { getOptionOfDocumentElements } from '@/app/service/documents/getOptionOfDocumentElements';
import { getDefinedItemIdForAnalitic, getDefinedItemIdForReceiver, getDefinedItemIdForSender } from '../doc.values.functions';
import { DOCUMENT_TYPE_CHECKS } from '../constants/docValues.constants';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { ReferenceModel } from '@/app/interfaces/reference.interface';

export const useDocValuesData = () => {
  const { mainData } = useAppContext();
  const { contentName } = mainData.document;
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const role = user?.role;
  const storageIdFromUser = user?.sectionId;
  const token = user?.token;
  const { data: references } = useAllReferences(token);

  // Мемоизируем опции документа
  const options = useMemo(() => {
    return getOptionOfDocumentElements(contentName, currentDocument?.date);
  }, [contentName, currentDocument?.date]);

  // Мемоизируем проверки для чекбоксов
  const checkboxStates = useMemo(() => {
    return {
      hasWorkers: DOCUMENT_TYPE_CHECKS.HAS_WORKERS(contentName),
      hasMediators: DOCUMENT_TYPE_CHECKS.HAS_MEDIATORS(contentName),
      hasDeliverers: DOCUMENT_TYPE_CHECKS.HAS_DELIVERERS(contentName),
      hasPartners: DOCUMENT_TYPE_CHECKS.HAS_PARTNERS(contentName),
      hasClients: DOCUMENT_TYPE_CHECKS.HAS_CLIENTS(contentName),
      hasFounders: DOCUMENT_TYPE_CHECKS.HAS_FOUNDERS(contentName),
      hasDepartments: DOCUMENT_TYPE_CHECKS.HAS_DEPARTMENTS(contentName)
    };
  }, [contentName]);

  // Мемоизируем определенные ID
  const definedIds = useMemo(() => {
    return {
      receiver: getDefinedItemIdForReceiver(role, storageIdFromUser, contentName),
      sender: getDefinedItemIdForSender(
        role,
        storageIdFromUser,
        contentName,
        references as ReferenceModel[] | undefined,
        user?.enterpriseId,
        user?.allowedStorageIds,
      ),
      analitic: getDefinedItemIdForAnalitic(role, storageIdFromUser, contentName)
    };
  }, [role, storageIdFromUser, contentName, references, user?.enterpriseId, user?.allowedStorageIds]);

  // Мемоизируем текущие значения документа
  const currentValues = useMemo(() => {
    return {
      receiverId: currentDocument?.docValues?.receiverId,
      senderId: currentDocument?.docValues?.senderId,
      analiticId: currentDocument?.docValues?.analiticId,
      productForChargeId: currentDocument?.docValues?.productForChargeId,
      count: currentDocument?.docValues?.count,
      price: currentDocument?.docValues?.price,
      total: currentDocument?.docValues?.total,
      cashFromPartner: currentDocument?.docValues?.cashFromPartner,
      comment: currentDocument?.docValues?.comment,
      isPartner: currentDocument?.docValues?.isPartner,
      isClient: currentDocument?.docValues?.isClient,
      isDepartment: currentDocument?.docValues?.isDepartment,
      isWorker: currentDocument?.docValues?.isWorker,
      finPerson: currentDocument?.docValues?.finPerson,
      driver: currentDocument?.docValues?.driver,
      senderPersonId: currentDocument?.docValues?.senderPersonId,
      carId: currentDocument?.docValues?.carId,
      orderId: currentDocument?.docValues?.orderId,
      workId: currentDocument?.docValues?.workId,
      deadlineDate: currentDocument?.docValues?.deadlineDate,
      materialResponsiblePersonId: currentDocument?.docValues?.materialResponsiblePersonId,
      invoiceImagePath: currentDocument?.docValues?.invoiceImagePath,
      invoiceImagePath2: currentDocument?.docValues?.invoiceImagePath2,
      invoiceImagePath3: currentDocument?.docValues?.invoiceImagePath3,
    };
  }, [currentDocument]);

  return {
    options,
    checkboxStates,
    definedIds,
    currentValues,
    user,
    role,
    storageIdFromUser,
    contentName,
    currentDocument
  };
}; 