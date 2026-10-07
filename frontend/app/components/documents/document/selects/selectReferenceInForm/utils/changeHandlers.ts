import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Maindata } from '@/app/context/app.context.interfaces';
import { UserRoles } from '@/app/interfaces/user.interface';
import { getPropertySubconto } from '@/app/service/reports/getPropertySubconto';
import { docsDependentToBalance, docsDependentToMiddlePrice } from '../../../doc/helpers/documentTypes';
import { SELECT_TYPES } from '../constants/select.constants';
import { getStockByItem } from '@/app/service/stocks/getStockByItem';
import { getSchetForDocumentType } from '@/app/interfaces/document.interface';
import { showMessage } from '@/app/service/common/showMessage';

interface ChangeHandlerParams {
  e: React.FormEvent<HTMLSelectElement> | { target: { value: string; dataset: { type: string | null; id: string | null | undefined } } };
  setMainData: Function | undefined;
  mainData: Maindata;
  type: string;
  maydaSavdo: boolean | undefined;
  data: ReferenceModel[];
}

const partnerIdFromStorage = (
  storageId: number,
  data: ReferenceModel[],
): number | undefined => {
  if (!storageId) return undefined;
  const storage = data.find((item) => Number(item.id) === Number(storageId));
  const partnerId = Number(storage?.refValues?.partnerId) || 0;
  return partnerId > 0 ? partnerId : undefined;
};

const syncSubleasePartnerId = (
  currentItem: any,
  contentName: string,
  data: ReferenceModel[],
) => {
  if (contentName === DocumentType.TransferSubleaseToolsToClient) {
    currentItem.docValues.partnerId = partnerIdFromStorage(
      Number(currentItem.docValues.senderId) || 0,
      data,
    );
  } else if (contentName === DocumentType.ReceiveSubleaseToolsFromClient) {
    currentItem.docValues.partnerId = partnerIdFromStorage(
      Number(currentItem.docValues.receiverId) || 0,
      data,
    );
  }
};

// Обработчик для sender
const handleSenderChange = (
  currentItem: any,
  id: number,
  contentName: string,
  data: ReferenceModel[],
) => {
  currentItem.docValues.senderId = id;
  
  // balance больше не используется в docValues, он есть только в docTableItems
  if (docsDependentToMiddlePrice.includes(contentName)) {
    currentItem.docValues.price = 0;
  }

  if (currentItem.documentType === DocumentType.LeaveOnlyOneMaterial) {
    currentItem.docValues.remainCount = 0;
    currentItem.docValues.price = 0;
    currentItem.docValues.total = 0;
  }

  if (contentName === DocumentType.TransferSubleaseToolsToClient) {
    syncSubleasePartnerId(currentItem, contentName, data);
  }
};

// Обработчик для receiver
const handleReceiverChange = (
  currentItem: any,
  id: number,
  contentName: string,
  data: ReferenceModel[],
) => {
  currentItem.docValues.receiverId = id;
  if (contentName === DocumentType.ReceiveSubleaseToolsFromClient) {
    syncSubleasePartnerId(currentItem, contentName, data);
  }
};

// Обработчик для productForCharge
const handleProductForChargeChange = async (currentItem: any, id: number, mainData: Maindata, setMainData: Function | undefined) => {
  currentItem.docValues.productForChargeId = id;

  if (currentItem.documentType !== DocumentType.LeaveOnlyOneMaterial) return;

  const senderId = Number(currentItem.docValues.senderId || 0);
  const documentDate = Number(currentItem.date || Date.now());
  const enterpriseId = currentItem.enterpriseId ?? mainData.report?.selectedEnterpriseId ?? mainData.users?.user?.enterpriseId;
  const token = mainData.users?.user?.token;

  if (!senderId || !id) {
    currentItem.docValues.remainCount = 0;
    currentItem.docValues.price = 0;
    currentItem.docValues.total = 0;
    return;
  }

  try {
    const schet = getSchetForDocumentType(DocumentType.LeaveOnlyOneMaterial);
    const stock = await getStockByItem(schet, senderId, id, documentDate, enterpriseId ?? undefined, token);
    const remainCount = Number(stock.totalQuantity || 0);
    const price = remainCount > 0 ? Number(stock.totalSum || 0) / remainCount : 0;
    const count = Number(currentItem.docValues.count || 0);
    const total = price * count;

    currentItem.docValues.remainCount = Number(remainCount.toFixed(4));
    currentItem.docValues.price = Number(price.toFixed(2));
    currentItem.docValues.total = Number(total.toFixed(2));
  } catch (error) {
    currentItem.docValues.remainCount = 0;
    currentItem.docValues.price = 0;
    currentItem.docValues.total = 0;
    showMessage('Не удалось получить остаток/себестоимость по выбранному материалу', 'error', setMainData);
  }
};

// Обработчик для car
const handleCarChange = (currentItem: any, id: number) => {
  currentItem.docValues.carId = id;
};

// Обработчик для senderPerson
const handleSenderPersonChange = (currentItem: any, id: number) => {
  currentItem.docValues.senderPersonId = id;
};

// Обработчик для materialResponsiblePerson
const handleMaterialResponsiblePersonChange = (currentItem: any, id: number) => {
  currentItem.docValues.materialResponsiblePersonId = id;
};

// Обработчик для mediator
const handleMediatorChange = (currentItem: any, id: number) => {
  currentItem.docValues.mediatorId = id;
};

// Обработчик для analitic
const handleAnaliticChange = (
  currentItem: any, 
  id: number, 
  contentName: string, 
  user: any, 
  maydaSavdo: boolean | undefined,
  data: ReferenceModel[]
) => {
  const previousAnaliticId = currentItem.docValues.analiticId;
  currentItem.docValues.analiticId = id;

  console.log('[handleAnaliticChange] ComeCashFromClients:', {
    contentName,
    previousAnaliticId,
    newAnaliticId: id,
    previousSenderId: currentItem.docValues.senderId
  });

  // Для ComeCashFromClients: очищаем senderId при изменении analiticId
  // Это необходимо, чтобы пользователь выбрал клиента из новой организации
  if (contentName === DocumentType.ComeCashFromClients) {
    // Очищаем senderId если:
    // 1. analiticId очищается (id === 0 или null)
    // 2. analiticId изменяется на другое значение (выбрана другая организация)
    if (id === 0 || id === null || id === undefined || previousAnaliticId !== id) {
      currentItem.docValues.senderId = 0;
      console.log('[handleAnaliticChange] Cleared senderId');
    }
  }

  // balance больше не используется в docValues, он есть только в docTableItems
  if (docsDependentToMiddlePrice.includes(contentName)) {
    currentItem.docValues.price = 0;
  }


  // Логика для maydaSavdo
  if (maydaSavdo) {
    const price = getPropertySubconto(data, id).refValues.thirdPrice;
    if (price) {
      currentItem.docValues.price = price;
      currentItem.docValues.total = price * currentItem.docValues.count;
    }
  }
};

// Основная функция обработки изменений
export const handleSelectChange = async ({
  e,
  setMainData,
  mainData,
  type,
  maydaSavdo,
  data
}: ChangeHandlerParams) => {
  const { user } = mainData.users;
  const { contentName } = mainData.document;
  const { currentDocument } = mainData.document;

  if (!currentDocument || !currentDocument.docValues) return;

  // ИСПРАВЛЕНИЕ: создаем глубокую копию docValues для корректного обновления состояния
  // Это необходимо, чтобы React правильно отслеживал изменения в docValues
  // и чтобы изменения сохранялись при обновлении документа
  const currentItem = { 
    ...currentDocument,
    docValues: { ...currentDocument.docValues }
  };
  
  // Проверяем, является ли это кастомным событием
  let id: number | null;
  if ('currentTarget' in e) {
    // Стандартное событие HTMLSelectElement
    const target = e.currentTarget;
    const idStr = target[target.selectedIndex]?.getAttribute('data-id');
    id = idStr ? +idStr : null;
  } else {
    // Кастомное событие с данными
    const idStr = e.target.dataset.id;
    id = idStr ? +idStr : null;
  }

  // Если id равен null, это означает выбор опции по умолчанию
  if (id === null) {
    // Сбрасываем соответствующие поля в зависимости от типа
    switch (type) {
      case SELECT_TYPES.SENDER:
        currentItem.docValues.senderId = 0;
        if (contentName === DocumentType.TransferSubleaseToolsToClient) {
          currentItem.docValues.partnerId = undefined;
        }
        break;
      case SELECT_TYPES.RECEIVER:
        currentItem.docValues.receiverId = 0;
        if (contentName === DocumentType.ReceiveSubleaseToolsFromClient) {
          currentItem.docValues.partnerId = undefined;
        }
        break;
      case SELECT_TYPES.PRODUCT_FOR_CHARGE:
        currentItem.docValues.productForChargeId = 0;
        if (currentItem.documentType === DocumentType.LeaveOnlyOneMaterial) {
          currentItem.docValues.remainCount = 0;
          currentItem.docValues.price = 0;
          currentItem.docValues.total = 0;
        }
        break;
      case SELECT_TYPES.ANALITIC:
        currentItem.docValues.analiticId = 0;
        break;
      case SELECT_TYPES.CAR:
        currentItem.docValues.carId = 0;
        break;
      case SELECT_TYPES.SENDER_PERSON:
        currentItem.docValues.senderPersonId = 0;
        break;
      case SELECT_TYPES.MATERIAL_RESPONSIBLE_PERSON:
        currentItem.docValues.materialResponsiblePersonId = 0;
        break;
      case SELECT_TYPES.MEDIATOR:
        currentItem.docValues.mediatorId = undefined;
        break;
    }
    
    // Обновление состояния
    // ВАЖНО: явно копируем docValues, чтобы React правильно отслеживал изменения
    if (setMainData) {
      setMainData('currentDocument', { 
        ...currentItem,
        docValues: { ...currentItem.docValues }
      });
    }
    return;
  }

  if (!id) return;

  // Обработка по типу
  switch (type) {
    case SELECT_TYPES.SENDER:
      handleSenderChange(currentItem, id, contentName, data);
      break;
    
    case SELECT_TYPES.RECEIVER:
      handleReceiverChange(currentItem, id, contentName, data);
      break;
    
    case SELECT_TYPES.PRODUCT_FOR_CHARGE:
      await handleProductForChargeChange(currentItem, id, mainData, setMainData);
      break;
    
    case SELECT_TYPES.ANALITIC:
      handleAnaliticChange(currentItem, id, contentName, user, maydaSavdo, data);
      break;
    
    case SELECT_TYPES.CAR:
      handleCarChange(currentItem, id);
      break;
    
    case SELECT_TYPES.SENDER_PERSON:
      handleSenderPersonChange(currentItem, id);
      break;
    
    case SELECT_TYPES.MATERIAL_RESPONSIBLE_PERSON:
      handleMaterialResponsiblePersonChange(currentItem, id);
      break;

    case SELECT_TYPES.MEDIATOR:
      handleMediatorChange(currentItem, id);
      break;
  }

  // Обновление состояния
  // ВАЖНО: явно копируем docValues, чтобы React правильно отслеживал изменения
  if (setMainData) {
    setMainData('currentDocument', { 
      ...currentItem,
      docValues: { ...currentItem.docValues }
    });
  }
}; 