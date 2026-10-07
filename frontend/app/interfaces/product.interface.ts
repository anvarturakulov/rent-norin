import { DocTableItem, TypeDocumentByComeOut, DocumentType } from './document.interface';
import { RefValues } from './reference.interface';
import { UserRoles } from './user.interface';

export interface Product {
  id: number;
  name: string;
  /** Артикул TMZ (поле верхнего уровня в API справочника) */
  article?: string;
  comment?: string;
  photo?: string;
  price?: number;
  parentId?: number | null;
  isFolder?: boolean;
  refValues?: RefValues;
}

export interface ProductTreeNode {
  item: Product;
  children: ProductTreeNode[];
  level: number;
  isOpen: boolean;
}

export interface StockData {
  totalQuantity: number;
  totalSum: number;
  reservedQuantity: number;
  availableQuantity: number;
  availableSum: number;
  lastUpdate: number;
}

export interface StockUpdate {
  type: 'initial' | 'update';
  stocks: {
    [schet: string]: {
      [itemId: string]: StockData;
    };
  };
}

// Функция конвертации Product в DocTableItem
export const convertProductToDocTableItem = (
  product: Product, 
  quantity: number, 
  typeDocumentByComeOut: TypeDocumentByComeOut,
  stockData?: StockData,
  customPrice?: number,
  documentType?: string,
  userRole?: UserRoles,
): DocTableItem => {
  // Используем переданную цену (теперь всегда передается из ProductModal)
  const price = customPrice !== undefined ? customPrice : (product.refValues?.firstPrice || product.price || 0);
  const total = price * quantity;
  
  // Рассчитываем себестоимость на основе данных склада
  let costPrice = 0;
  
  console.log('🔍 convertProductToDocTableItem - отладочная информация:', {
    productName: product.name,
    typeDocumentByComeOut,
    customPrice,
    customPriceUndefined: customPrice === undefined,
    defaultFirstPrice: product.refValues?.firstPrice,
    defaultPrice: product.price,
    finalPrice: price,
    documentType,
    userRole,
    stockData: stockData ? {
      totalQuantity: stockData.totalQuantity,
      totalSum: stockData.totalSum,
      availableQuantity: stockData.availableQuantity
    } : null
  });
  
  // Субаренда: остатка на своём складе нет — себестоимость не из AVEKO
  // (enrichSubleaseToolsRow обнуляет costPrice и ставит тарифы)
  const isSubleaseDoc =
    documentType === DocumentType.TransferSubleaseToolsToClient ||
    documentType === DocumentType.ReceiveSubleaseToolsFromClient;

  // Для приходных документов (comeProd) не рассчитываем себестоимость
  if (typeDocumentByComeOut === 'come' || isSubleaseDoc) {
    costPrice = 0;
    console.log(
      isSubleaseDoc
        ? '📥 Субаренда — себестоимость со склада не рассчитывается'
        : '📥 Приходной документ - себестоимость не рассчитывается',
    );
  } else {
    // Для остальных документов рассчитываем по средней цене (AVEKO)
    if (stockData && stockData.totalQuantity > 0) {
      costPrice = stockData.totalSum / stockData.totalQuantity;
      console.log(`💰 Рассчитана себестоимость: ${costPrice.toFixed(2)} (${stockData.totalSum} / ${stockData.totalQuantity})`);
    } else {
      // Если данных склада нет или totalQuantity = 0,
      // для документов продажи/списания/перемещения выбрасываем ошибку
      if (typeDocumentByComeOut === 'out') {
        console.log('❌ Ошибка: нет данных склада для расчета себестоимости');
        throw new Error(`Невозможно рассчитать себестоимость для товара "${product.name}" (ID: ${product.id}). Данные склада недоступны или количество товара равно 0.`);
      }
      // Для других случаев (если тип не определен) не выбрасываем ошибку
      costPrice = 0;
      console.log('⚠️ Неопределенный тип документа - себестоимость = 0');
    }
  }
  
  const costTotal = costPrice * quantity;
  
  // Рассчитываем количество коробок
  const countByBox = product.refValues?.countInBox ? Math.ceil(quantity / product.refValues.countInBox) : undefined;
  
  return {
    analiticId: product.id, // ID товара как аналитический ID
    refCountInBox: product.refValues?.countInBox,
    balance: 0, // Баланс будет рассчитываться отдельно
    count: quantity,
    price: price,
    total: total,
    costPrice: costPrice,
    costTotal: costTotal,
    countByBox: countByBox,
  };
};

// Функция проверки существования товара в документе
export const isProductInDocument = (productId: number, docTableItems: DocTableItem[]): boolean => {
  return docTableItems.some(item => item.analiticId === productId);
};

// Функция обновления количества товара в документе
export const updateProductQuantityInDocument = (
  productId: number, 
  newQuantity: number, 
  docTableItems: DocTableItem[]
): DocTableItem[] => {
  return docTableItems.map(item => {
    if (item.analiticId === productId) {
      const price = item.price;
      const costPrice = item.costPrice;
      return {
        ...item,
        count: newQuantity,
        total: price * newQuantity,
        costTotal: costPrice * newQuantity
      };
    }
    return item;
  });
};
