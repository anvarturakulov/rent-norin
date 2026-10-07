import { Maindata } from '@/app/context/app.context.interfaces'
import { DocTableItem, DocumentModel, DocumentType, OptionsForDocument } from '@/app/interfaces/document.interface'
import { ReferenceModel, TypeReference, TypeSECTION } from '@/app/interfaces/reference.interface'
import { User, UserRoles } from '@/app/interfaces/user.interface'

export const getLabelForAnalitic = (currentDocument: DocumentModel, options: OptionsForDocument): string => {
  
  // For ServicesFromPartners, keep analytic label from options (CHARGES)
  if (
    currentDocument?.documentType === DocumentType.ServicesFromPartners ||
    currentDocument?.documentType === DocumentType.ServicesToClients
  ) {
    return options.analiticLabel
  }

  let {isPartner, isClient, isWorker, isMediator, isDeliverer, isDepartment} = currentDocument?.docValues || {}

  if (currentDocument && isPartner) {
    return 'Таъминотчи'
  }
  if (currentDocument && isClient) {
    return 'Клиент'
  }
  if (currentDocument && isWorker) {
    return 'Ходим'
  }
  if (currentDocument && isMediator) {
    return 'Воситачи'
  }
  if (currentDocument && isDeliverer) {
    return 'Доставщик'
  }
  if (currentDocument && isDepartment) {
    return 'Ички корхона'
  }
  
  return options.analiticLabel
}

export const getTypeReferenceForAnalitic = (currentDocument: DocumentModel, options: OptionsForDocument) => {
  // For ServicesFromPartners, keep analytic type from options (CHARGES)
  if (
    currentDocument?.documentType === DocumentType.ServicesFromPartners ||
    currentDocument?.documentType === DocumentType.ServicesToClients
  ) {
    return options.analiticType
  }

  let {isPartner, isClient, isWorker, isMediator, isDeliverer, isDepartment} = currentDocument?.docValues || {}

  if (currentDocument && isPartner) {
    return TypeReference.PARTNERS
  }
  if (currentDocument && isClient) {
    return TypeReference.PARTNERS
  }
  if (currentDocument && isWorker) {
    return TypeReference.WORKERS
  }
  if (currentDocument && isMediator) {
    return TypeReference.PARTNERS
  }
  if (currentDocument && isDeliverer) {
    return TypeReference.DELIVERERS
  }
  if (currentDocument && isDepartment) {
    return TypeReference.PARTNERS
  }
  
  return options.analiticType
}

export const getLabelForReceiver = (
  currentDocument: DocumentModel,
  options: OptionsForDocument,
): string => {
  if (currentDocument?.documentType === DocumentType.SaleMaterial) {
    if (currentDocument.docValues?.isWorker) {
      return 'Ходим';
    }
    if (currentDocument.docValues?.isPartner) {
      return 'Таъминотчи';
    }
    return 'Мижоз';
  }
  return options.receiverLabel;
};

export const getTypeReferenceForReceiver = (
  currentDocument: DocumentModel,
  options: OptionsForDocument,
): TypeReference => {
  if (currentDocument?.documentType === DocumentType.SaleMaterial) {
    if (currentDocument.docValues?.isWorker) {
      return TypeReference.WORKERS;
    }
    return TypeReference.PARTNERS;
  }
  if (currentDocument?.docValues?.isDepartment) {
    return TypeReference.STORAGES;
  }
  return options.receiverType;
};


export const saveItemId = (storageId: number | undefined, type: 'reciever' | 'sender', mainData: Maindata, setMainData: Function | undefined,) => {
  let currentItem = { ...mainData.document.currentDocument };
  
  if (currentItem.docValues) {
    if (storageId && type == 'reciever') currentItem.docValues.receiverId = storageId
    if (storageId && type == 'sender') currentItem.docValues.senderId = storageId
  }

  if (setMainData) {
    setMainData('currentDocument', { ...currentItem })
  }
}

export const getDefinedItemIdForReceiver = (role: UserRoles | undefined, storageIdFromUser: number | undefined, contentName: string) => {
  // if (role && role == UserRoles.GLBUX && contentName == DocumentType.ZpCalculate) return 0
  
  if (role == UserRoles.ADMINGLOBAL) return 0
  
  // if (contentName == DocumentType.ComeMaterial) return storageIdFromUser
  
  // if (role && contentName == DocumentType.ComeHalfstuff) {
  //   return storageIdFromUser
  // }
  
  // if (
  //     storageIdFromUser &&
  //     role && (role == UserRoles.GLAVBUX || role == UserRoles.HEADCOMPANY) &&
  //     (
  //       contentName == DocumentType.ComeCashFromClients
  //   )
  // ) return storageIdFromUser
  

  return 0
}

const isSaleTovarSenderOption = (
  item: ReferenceModel,
  enterpriseId: number | null | undefined,
  allowedStorageIds?: number[] | null,
): boolean => {
  if (item.typeReference !== TypeReference.STORAGES) return false;
  if (item.isFolder) return false;
  if (item.refValues?.typeSection !== TypeSECTION.COMMON) return false;
  if (item.id == null) return false;

  if (Array.isArray(allowedStorageIds) && allowedStorageIds.length > 0) {
    return allowedStorageIds.includes(item.id);
  }

  return item.enterpriseId === enterpriseId;
};

export const getDefinedItemIdForSender = (
  role: UserRoles | undefined,
  storageIdFromUser: number | undefined,
  contentName: string,
  references?: ReferenceModel[],
  enterpriseId?: number | null,
  allowedStorageIds?: number[] | null,
) => {
  if (
    (contentName === DocumentType.SaleTovar ||
      contentName === DocumentType.SaleTools ||
      contentName === DocumentType.LeaveTovar) &&
    references?.length &&
    enterpriseId != null
  ) {
    const selectable = references.filter((item) =>
      isSaleTovarSenderOption(item, enterpriseId, allowedStorageIds),
    );
    const mainWarehouse = selectable.find(
      (item) => item.refValues?.isMainWarehouse === true,
    );
    if (mainWarehouse?.id) {
      return mainWarehouse.id;
    }
  }

  return 0
}

export const getDefinedItemIdForAnalitic = (role: UserRoles | undefined, storageIdFromUser: number | undefined, contentName: string) => {
  
  if (
    storageIdFromUser &&
    role && (role == UserRoles.GLAVBUX || role == UserRoles.HEADCOMPANY) &&
    contentName == DocumentType.SaleProd
  ) return storageIdFromUser

  return 0
}

export const addItems = (setMainData: Function | undefined, mainData: Maindata, newItem: DocTableItem) => {

  let newObj = { ...mainData.document.currentDocument };
  newObj.docTableItems?.push(newItem)

  if (setMainData) {
    setMainData('currentDocument', { ...newObj })
  }
}