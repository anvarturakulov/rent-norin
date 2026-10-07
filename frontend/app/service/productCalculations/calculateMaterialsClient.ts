import { ProductCalculationsService } from './productCalculations.service';
import { DocTableItem } from '@/app/interfaces/document.interface';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { resolveApiBaseUrl, getNgrokBypassHeaders } from '@/app/service/common/getApiDomain';

export interface ProductQuantityInput {
  productId: number;
  quantity: number;
}

export interface MaterialCalculationResult {
  materialId: number;
  materialName: string;
  totalQuantity: number;
  costPrice: number;
  balance: number;
  costTotal: number;
  productBreakdown?: Array<{
    productId: number;
    productName: string;
    quantity: number;
    requiredQuantity: number;
  }>;
}

export interface ProductCalculation {
  id?: number;
  productId: number;
  materialId: number;
  quantityPerUnit: number;
  product?: ReferenceModel;
  material?: ReferenceModel;
}

/**
 * Рассчитывает материалы на основе калькуляций готовой продукции - КЛИЕНТСКАЯ ВЕРСИЯ
 * Вся логика перенесена с бекенда на фронтенд
 */
export async function calculateMaterialsForProductsClient(
  endDate: number,
  products: ProductQuantityInput[],
  token: string,
  materialWarehouseId: number = 1,
): Promise<MaterialCalculationResult[]> {
  try {
    console.log('🧮 [CLIENT] Начинаем расчет материалов для продуктов:', products);
    
    // Получаем все калькуляции для указанных продуктов
    const productIds = products.map(p => p.productId);
    const allCalculations: ProductCalculation[] = [];
    
    // Загружаем калькуляции для каждого продукта
    for (const productId of productIds) {
      try {
        const calculations = await ProductCalculationsService.getCalculationsByProduct(productId, token);
        allCalculations.push(...calculations);
      } catch (error) {
        // console.warn(`⚠️ [CLIENT] Махсулот калькуляцияси юклашла хатолик юз берди: ${productId}:`, error);
      }
    }

// 
    if (allCalculations.length === 0) {
      console.warn('⚠️ [CLIENT] Не найдено калькуляций для указанных продуктов');
      return [];
    }

    // Группируем материалы и суммируем количества
    const materialTotals = new Map<number, {
      materialId: number;
      materialName: string;
      balance: number;
      totalQuantity: number;
      costPrice: number;
      costTotal: number;
      productBreakdown: Array<{
        productId: number;
        productName: string;
        quantity: number;
        requiredQuantity: number;
      }>;
    }>();

    // Обрабатываем каждый продукт
    for (const product of products) {
      const productCalculations = allCalculations.filter(c => c.productId === product.productId);
      
      console.log(`🏭 [CLIENT] Продукт ID ${product.productId} (${product.quantity} шт): найдено ${productCalculations.length} материалов в калькуляции`);
      
      for (const calculation of productCalculations) {
        const materialId = calculation.materialId;
        const materialName = calculation.material?.name || `Материал ${materialId}`;
        const requiredQuantity = calculation.quantityPerUnit * product.quantity;

        console.log(`📦 [CLIENT] Материал "${materialName}": ${calculation.quantityPerUnit} × ${product.quantity} = ${requiredQuantity}`);

        if (materialTotals.has(materialId)) {
          const existing = materialTotals.get(materialId);
          if (existing) {
            const oldQuantity = existing.totalQuantity;
            const oldCostTotal = existing.costTotal;
            
            existing.totalQuantity += requiredQuantity;
            // Пересчитываем costTotal на основе себестоимости за единицу и нового общего количества
            existing.costTotal = existing.costPrice * existing.totalQuantity;
            
            existing.productBreakdown.push({
              productId: product.productId,
              productName: calculation.product?.name || `Продукт ${product.productId}`,
              quantity: product.quantity,
              requiredQuantity: requiredQuantity
            });
            
            console.log(`➕ [CLIENT] Добавлено к существующему материалу "${materialName}" (ID ${materialId}):`, {
              добавлено_количество: requiredQuantity,
              старое_количество: oldQuantity,
              новое_количество: existing.totalQuantity,
              себестоимость_за_единицу: existing.costPrice,
              старый_costTotal: oldCostTotal,
              новый_costTotal: existing.costTotal,
              расчет: `${existing.costPrice} × ${existing.totalQuantity} = ${existing.costTotal}`
            });
          }
        } else {
          // Получаем себестоимость материала из склада
          const {costPrice, balance} = await getMaterialCostPriceClient(endDate, materialId, materialWarehouseId, token);
          
          const costTotal = costPrice * requiredQuantity;
          
          materialTotals.set(materialId, {
            materialId,
            materialName,
            balance: balance,
            totalQuantity: requiredQuantity,
            costPrice,
            costTotal: costTotal,
            productBreakdown: [{
              productId: product.productId,
              productName: calculation.product?.name || `Продукт ${product.productId}`,
              quantity: product.quantity,
              requiredQuantity: requiredQuantity
            }]
          });
          
          console.log(`🆕 [CLIENT] Новый материал "${materialName}" (ID ${materialId}):`, {
            количество: requiredQuantity,
            себестоимость_за_единицу: costPrice,
            costTotal: costTotal,
            расчет: `${costPrice} × ${requiredQuantity} = ${costTotal}`,
            остаток_на_складе: balance
          });
        }
      }
    }

    const result = Array.from(materialTotals.values());
    console.log('✅ [CLIENT] Итоговый расчет материалов:', result.map(r => ({
      materialId: r.materialId,
      materialName: r.materialName,
      totalQuantity: r.totalQuantity,
      costPrice: r.costPrice,
      costTotal: r.costTotal,
      проверка_расчета: `${r.costPrice} × ${r.totalQuantity} = ${r.costPrice * r.totalQuantity}`,
      совпадает_с_costTotal: (r.costPrice * r.totalQuantity).toFixed(2) === r.costTotal.toFixed(2),
      productBreakdown: r.productBreakdown
    })));
    
    // Проверка на возможные ошибки в расчете
    result.forEach(r => {
      const expectedCostTotal = r.costPrice * r.totalQuantity;
      const difference = Math.abs(r.costTotal - expectedCostTotal);
      if (difference > 0.01) { // Допускаем небольшую погрешность округления
        console.warn(`⚠️ [CLIENT] ВНИМАНИЕ! Несоответствие в расчете для материала "${r.materialName}" (ID ${r.materialId}):`, {
          ожидаемый_costTotal: expectedCostTotal,
          фактический_costTotal: r.costTotal,
          разница: difference,
          costPrice: r.costPrice,
          totalQuantity: r.totalQuantity
        });
      }
    });
    
    return result;
  } catch (error) {
    console.error('❌ [CLIENT] Ошибка расчета материалов:', error);
    throw error;
  }
}

/**
 * Получает себестоимость материала из склада - КЛИЕНТСКАЯ ВЕРСИЯ
 * Использует среднюю себестоимость со склада
 */

export async function getHalfstuffCostPriceClient(
  endDate: number,
  halfstuffId: number,
  warehouseId: number,
  token: string,
  enterpriseId?: number,
): Promise<{costPrice: number; balance: number}> {
  try {
    const params = new URLSearchParams({
      schet: 'S21',
      endDate: String(endDate),
      firstSubcontoId: String(warehouseId),
      secondSubcontoId: String(halfstuffId),
    });
    if (enterpriseId != null && enterpriseId > 0) {
      params.append('enterpriseId', String(enterpriseId));
    }
    const apiUrl = `${resolveApiBaseUrl()}/api/reports/priceAndBalance?${params.toString()}`;
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...getNgrokBypassHeaders(apiUrl),
      },
    });
    if (response.ok) {
      const stockData = await response.json();
      const costPrice = Number(stockData?.price) || 0;
      const balance = Number(stockData?.balance ?? stockData?.totalQuantity ?? 0) || 0;
      return { costPrice, balance };
    }
    console.warn(
      `[getHalfstuffCostPriceClient] halfstuffId=${halfstuffId} warehouseId=${warehouseId}: HTTP ${response.status}`,
      apiUrl,
    );
  } catch {
    // ignore
  }
  return { costPrice: 0, balance: 0 };
}

/** Экспортируется для добавления материала вручную (остаток и цена с БД). */
export async function getMaterialCostPriceClient(
  endDate: number,
  materialId: number,
  warehouseId: number,
  token: string,
  enterpriseId?: number,
  stockOnly = false,
): Promise<{costPrice: number; balance: number}> {
  try {
    const params = new URLSearchParams({
      schet: 'S10',
      endDate: String(endDate),
      firstSubcontoId: String(warehouseId),
      secondSubcontoId: String(materialId),
    });
    if (enterpriseId != null && enterpriseId > 0) {
      params.append('enterpriseId', String(enterpriseId));
    }
    const apiUrl = `${resolveApiBaseUrl()}/api/reports/priceAndBalance?${params.toString()}`;
    if (!stockOnly) {
      console.log(`🔍 [CLIENT] Запрос себестоимости материала ID ${materialId} со склада ${warehouseId}: ${apiUrl}`);
    }

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...getNgrokBypassHeaders(apiUrl),
      },
    });

    if (!stockOnly) {
      console.log(`📡 [CLIENT] Ответ API для материала ${materialId}: статус ${response.status}`);
    }

    if (response.ok) {
      const stockData = await response.json();
      if (!stockOnly) {
        console.log(`📊 [CLIENT] Полные данные API для материала ID ${materialId}:`, {
          stockData,
          price: stockData?.price,
          balance: stockData?.balance,
          totalSum: stockData?.totalSum,
          totalQuantity: stockData?.totalQuantity
        });
      }
      
      // API возвращает {price, balance}, где price - это уже средняя себестоимость (totalSum / totalQuantity)
      // НЕ нужно пересчитывать price, так как это уже средняя цена за единицу
      let costPrice = 0;
      let balance = 0;
      
      if (stockData) {
        // Приоритет 1: Используем price напрямую, если он есть (это уже средняя себестоимость)
        if (stockData.price !== undefined && stockData.price !== null && stockData.price > 0) {
          balance = Number(stockData.balance ?? stockData.totalQuantity ?? 0) || 0;
          if (stockOnly && balance <= 0) {
            return { costPrice: 0, balance: 0 };
          }
          costPrice = stockData.price;
          if (!stockOnly) {
            console.log(`💰 [CLIENT] Себестоимость материала ID ${materialId} (средняя цена из API): ${costPrice.toFixed(5)}`);
            console.log(`📊 [CLIENT] Остаток материала ID ${materialId}: ${balance}`);
          }
          return {costPrice, balance};
        }
        
        // Приоритет 2: Если есть totalSum и totalQuantity, вычисляем среднюю цену
        if (stockData.totalSum !== undefined && stockData.totalQuantity !== undefined && stockData.totalQuantity > 0) {
          balance = Number(stockData.balance ?? stockData.totalQuantity ?? 0) || 0;
          if (stockOnly && balance <= 0) {
            return { costPrice: 0, balance: 0 };
          }
          costPrice = stockData.totalSum / stockData.totalQuantity;
          if (!stockOnly) {
            console.log(`💰 [CLIENT] Средняя себестоимость материала ID ${materialId} (вычислена): ${costPrice.toFixed(5)} (${stockData.totalSum} / ${stockData.totalQuantity})`);
            console.log(`📊 [CLIENT] Остаток материала ID ${materialId}: ${balance}`);
          }
          return {costPrice, balance};
        }
        
        // Приоритет 3: Остаток без цены (balance или totalQuantity)
        const qtyOnly = Number(stockData.balance ?? stockData.totalQuantity ?? 0) || 0;
        if (qtyOnly > 0) {
          balance = qtyOnly;
          if (!stockOnly) {
            console.warn(`⚠️ [CLIENT] Материал ID ${materialId} имеет остаток ${balance}, но нет цены. Используем 0`);
          }
          return {costPrice: 0, balance};
        }
        
        // Приоритет 4: Если нет остатков, но есть цена в справочнике (только если не stockOnly)
        if (
          !stockOnly &&
          stockData.price !== undefined &&
          stockData.price > 0
        ) {
          costPrice = stockData.price;
          balance = 0;
          if (!stockOnly) {
            console.log(`💰 [CLIENT] Используем цену из справочника для материала ID ${materialId}: ${costPrice.toFixed(5)} (остаток = 0)`);
          }
          return {costPrice, balance};
        }
        
        if (!stockOnly) {
          console.warn(`⚠️ [CLIENT] Нет данных для материала ID ${materialId} на складе ${warehouseId}:`, stockData);
        }
        return {costPrice: 0, balance: 0};
      } else {
        if (!stockOnly) {
          console.warn(`⚠️ [CLIENT] Пустой ответ для материала ID ${materialId}`);
        }
        return {costPrice: 0, balance: 0};
      }
    } else {
      const errorText = await response.text();
      if (!stockOnly) {
        console.warn(`⚠️ [CLIENT] Ошибка ${response.status} получения данных склада для материала ID ${materialId}:`, errorText);
      }
      return {costPrice: 0, balance: 0};
    }
  } catch (error) {
    console.error(`❌ [CLIENT] Ошибка получения себестоимости материала ID ${materialId}:`, error);
    return {costPrice: 0, balance: 0};
  }
}


/**
 * Получает остаток материала со склада
 * УСТАРЕЛО: Теперь остатки получаем через WebSocket
 * Функция оставлена для обратной совместимости
 */
export async function getMaterialBalanceClient(
  materialId: number, 
  warehouseId: number, 
  token: string
): Promise<number> {
  console.warn('⚠️ [DEPRECATED] getMaterialBalanceClient устарела, используйте WebSocket для получения остатков');
  return 0; // Возвращаем 0, остатки будут получены через WebSocket
}

/**
 * Преобразует результаты расчета материалов в DocTableItem для использования в документе - КЛИЕНТСКАЯ ВЕРСИЯ
 * Остатки будут получены через WebSocket, поэтому здесь ставим 0
 */
export function convertMaterialsToDocTableItemsClient(
  materials: MaterialCalculationResult[]
): DocTableItem[] {
  console.log('🔄 [CLIENT] convertMaterialsToDocTableItems - входные материалы:', materials.map(m => ({
    materialId: m.materialId,
    materialName: m.materialName,
    totalQuantity: m.totalQuantity,
    costPrice: m.costPrice,
    costTotal: m.costTotal,
    проверка: `${m.costPrice} × ${m.totalQuantity} = ${m.costPrice * m.totalQuantity}`
  })));
  
  const items = materials.map((material, index) => {
    // Проверяем корректность данных перед преобразованием
    const expectedTotal = material.costPrice * material.totalQuantity;
    const totalDifference = Math.abs(material.costTotal - expectedTotal);
    
    if (totalDifference > 0.01) {
      console.warn(`⚠️ [CLIENT] ВНИМАНИЕ! Несоответствие в материале "${material.materialName}" перед преобразованием:`, {
        ожидаемый_total: expectedTotal,
        фактический_costTotal: material.costTotal,
        разница: totalDifference
      });
    }
    
    const docTableItem = {
      analiticId: material.materialId,
      balance: material.balance, // Остаток будет получен через WebSocket
      count: material.totalQuantity, // ✅ Правильное рассчитанное количество материала
      price: material.costPrice, // Используем себестоимость за единицу
      total: material.costTotal, // ✅ Общая стоимость (costPrice × count)
      costPrice: material.costPrice, // ✅ Себестоимость за единицу
      costTotal: material.costTotal, // ✅ Общая себестоимость (costPrice × count)
      tableType: 'expense' as const, // Это списание материалов
    };
    
    // Проверяем корректность преобразования
    const checkTotal = docTableItem.price * docTableItem.count;
    const checkCostTotal = docTableItem.costPrice * docTableItem.count;
    
    console.log(`📦 [CLIENT] Материал ${index + 1} "${material.materialName}" (ID ${material.materialId}):`, {
      количество: docTableItem.count,
      цена_за_единицу: docTableItem.price,
      total: docTableItem.total,
      проверка_total: `${docTableItem.price} × ${docTableItem.count} = ${checkTotal}`,
      себестоимость_за_единицу: docTableItem.costPrice,
      costTotal: docTableItem.costTotal,
      проверка_costTotal: `${docTableItem.costPrice} × ${docTableItem.count} = ${checkCostTotal}`,
      остаток: 'будет получен через WebSocket'
    });
    
    if (Math.abs(docTableItem.total - checkTotal) > 0.01) {
      console.error(`❌ [CLIENT] ОШИБКА! Несоответствие total для материала "${material.materialName}":`, {
        ожидаемый: checkTotal,
        фактический: docTableItem.total
      });
    }
    
    if (Math.abs(docTableItem.costTotal - checkCostTotal) > 0.01) {
      console.error(`❌ [CLIENT] ОШИБКА! Несоответствие costTotal для материала "${material.materialName}":`, {
        ожидаемый: checkCostTotal,
        фактический: docTableItem.costTotal
      });
    }
    
    return docTableItem;
  });
  
  console.log('✅ [CLIENT] convertMaterialsToDocTableItems - результат:', items.map(item => ({
    analiticId: item.analiticId,
    count: item.count,
    price: item.price,
    total: item.total,
    costPrice: item.costPrice,
    costTotal: item.costTotal,
    проверка: `price×count=${item.price * item.count}, costPrice×count=${item.costPrice * item.count}`
  })));
  
  return items;
}

/**
 * Извлекает продукты из DocTableItem и подготавливает их для расчета материалов
 */
export function extractProductsFromDocTableItemsClient(
  docTableItems: DocTableItem[]
): ProductQuantityInput[] {
  console.log('🔍 [CLIENT] extractProductsFromDocTableItems - входные данные:', docTableItems);
  
  const result = docTableItems.map(item => {
    const productData = {
      productId: item.analiticId,
      quantity: item.count || 0,
    };
    console.log(`📦 [CLIENT] Извлекаем продукт: ID=${productData.productId}, количество=${productData.quantity}`, item);
    return productData;
  });
  
  console.log('✅ [CLIENT] extractProductsFromDocTableItems - результат:', result);
  return result;
}

/**
 * Пересчитывает себестоимость готовой продукции на основе материалов - КЛИЕНТСКАЯ ВЕРСИЯ
 * ИСПРАВЛЕНО: Теперь рассчитывает себестоимость для каждого продукта индивидуально на основе его калькуляции
 */
export async function recalculateProductCostFromMaterialsClient(
  docTableItems: DocTableItem[],
  token: string,
  endDate: number,
  materialWarehouseId: number = 1
): Promise<DocTableItem[]> {
  console.log('🔍 [CLIENT] ========== НАЧАЛО ПЕРЕСЧЕТА СЕБЕСТОИМОСТИ ==========');
  console.log('🔍 [CLIENT] recalculateProductCostFromMaterials - ИСПРАВЛЕННАЯ ВЕРСИЯ');
  console.log('📊 [CLIENT] Входные параметры:', {
    количество_элементов: docTableItems.length,
    дата_документа: endDate,
    склад_материалов_ID: materialWarehouseId,
    дата_документа_формат: new Date(endDate).toLocaleString('ru-RU')
  });
  console.log('📋 [CLIENT] Все элементы docTableItems:', docTableItems.map((item, index) => ({
    индекс: index,
    analiticId: item.analiticId,
    tableType: item.tableType || 'undefined (считается income)',
    count: item.count,
    costPrice: item.costPrice,
    costTotal: item.costTotal,
    price: item.price,
    total: item.total
  })));
  
  // Получаем все материалы (expense) и готовую продукцию (income или undefined)
  const materialItems = docTableItems.filter(item => item.tableType === 'expense');
  const productItems = docTableItems.filter(item => !item.tableType || item.tableType === 'income');
  
  console.log('📦 [CLIENT] Найдено материалов (expense):', materialItems.length);
  console.log('🏭 [CLIENT] Найдено готовой продукции (income):', productItems.length);
  
  // Создаем Map для быстрого доступа к себестоимости материалов по ID
  const materialCostMap = new Map<number, number>();
  materialItems.forEach(material => {
    // Используем costPrice из уже рассчитанных материалов
    if (material.costPrice && material.costPrice > 0) {
      materialCostMap.set(material.analiticId, material.costPrice);
      console.log(`💰 [CLIENT] Материал ID ${material.analiticId}: себестоимость из docTableItems = ${material.costPrice}`);
    }
  });
  
  console.log('📦 [CLIENT] Материалы (expense):', materialItems.map(m => ({
    materialId: m.analiticId,
    costPrice: m.costPrice,
    costTotal: m.costTotal,
    count: m.count
  })));
  console.log('🏭 [CLIENT] Готовая продукция (income):', productItems);
  console.log('🗺️ [CLIENT] Map себестоимости материалов:', Array.from(materialCostMap.entries()));
  
  if (productItems.length === 0) {
    console.log('⚠️ [CLIENT] Нет готовой продукции для пересчета себестоимости');
    return docTableItems;
  }

  // Для каждого продукта рассчитываем его индивидуальную себестоимость
  console.log('🔄 [CLIENT] Начинаем пересчет себестоимости для каждого продукта...');
  const updatedItems = await Promise.all(
    docTableItems.map(async (item, index) => {
      console.log(`\n📦 [CLIENT] Обработка элемента ${index + 1}/${docTableItems.length}:`, {
        analiticId: item.analiticId,
        tableType: item.tableType || 'undefined (считается income)',
        count: item.count,
        текущий_costPrice: item.costPrice,
        текущий_costTotal: item.costTotal
      });
      
      if (item.tableType === 'expense') {
        // Материалы оставляем без изменений
        console.log(`✅ [CLIENT] Элемент ${index + 1} - материал (expense), пропускаем пересчет`);
        return item;
      }

      const productId = item.analiticId;
      const productQuantity = item.count || 0;
      
      console.log(`🏭 [CLIENT] Продукт ID ${productId}: количество = ${productQuantity}`);
      
      if (productQuantity <= 0) {
        console.log(`⚠️ [CLIENT] Продукт ID ${productId}: количество = 0, себестоимость = 0`);
        return {
          ...item,
          costPrice: 0,
          costTotal: 0,
          price: 0,
          total: 0
        };
      }

      try {
        // Получаем калькуляцию для данного продукта
        console.log(`🔍 [CLIENT] Запрашиваем калькуляцию для продукта ID ${productId}...`);
        const productCalculations = await ProductCalculationsService.getCalculationsByProduct(productId, token);
        console.log(`📋 [CLIENT] Получено калькуляций для продукта ID ${productId}:`, productCalculations.length);
        
        if (productCalculations.length === 0) {
          console.log(`⚠️ [CLIENT] Продукт ID ${productId}: нет калькуляции, себестоимость = 0`);
          return {
            ...item,
            costPrice: 0,
            costTotal: 0,
            price: 0,
            total: 0
          };
        }

        // Рассчитываем себестоимость на основе калькуляции
        console.log(`💰 [CLIENT] Начинаем расчет себестоимости для продукта ID ${productId} на основе ${productCalculations.length} материалов в калькуляции`);
        let totalCost = 0;
        const materialCosts: Array<{materialId: number, quantityPerUnit: number, requiredQuantity: number, costPrice: number, materialCost: number, источник: string}> = [];
        
        for (const calculation of productCalculations) {
          console.log(`\n  📦 [CLIENT] Обработка материала из калькуляции:`, {
            materialId: calculation.materialId,
            quantityPerUnit: calculation.quantityPerUnit,
            productId: calculation.productId
          });
          const materialId = calculation.materialId;
          const quantityPerUnit = calculation.quantityPerUnit;
          const requiredQuantity = quantityPerUnit * productQuantity;
          
          // ИСПРАВЛЕНО: Используем себестоимость из уже рассчитанных материалов вместо повторного запроса к API
          let costPrice: number;
          let источник = '';
          
          if (materialCostMap.has(materialId)) {
            costPrice = materialCostMap.get(materialId)!;
            источник = 'из docTableItems (уже рассчитано)';
            console.log(`✅ [CLIENT] Используем себестоимость материала ID ${materialId} из docTableItems: ${costPrice}`);
          } else {
            // Если материала нет в docTableItems (не должно происходить, но на всякий случай)
            console.warn(`⚠️ [CLIENT] Материал ID ${materialId} не найден в docTableItems, запрашиваем из API`);
            const result = await getMaterialCostPriceClient(endDate, materialId, materialWarehouseId, token);
            costPrice = result.costPrice;
            источник = 'из API (fallback)';
          }
          
          const materialCost = costPrice * requiredQuantity;
          totalCost += materialCost;
          
          materialCosts.push({
            materialId,
            quantityPerUnit,
            requiredQuantity,
            costPrice,
            materialCost,
            источник
          });
          
          console.log(`📦 [CLIENT] Продукт ID ${productId}: материал ${materialId}:`, {
            количество_на_единицу: quantityPerUnit,
            количество_продукта: productQuantity,
            требуемое_количество_материала: requiredQuantity,
            себестоимость_материала_за_единицу: costPrice,
            источник_себестоимости: источник,
            стоимость_материала: materialCost,
            расчет: `${costPrice} × ${requiredQuantity} = ${materialCost}`
          });
        }

        const costPerUnit = productQuantity > 0 ? totalCost / productQuantity : 0;
        const costTotal = costPerUnit * productQuantity;
        
        console.log(`\n✅ [CLIENT] Продукт ID ${productId} - ИТОГОВЫЙ РАСЧЕТ СЕБЕСТОИМОСТИ:`);
        console.log(`  📊 Общая себестоимость всех материалов: ${totalCost.toFixed(2)}`);
        console.log(`  📦 Количество продукта: ${productQuantity}`);
        console.log(`  💰 Себестоимость за единицу: ${costPerUnit.toFixed(5)}`);
        console.log(`  💵 Общая себестоимость (costTotal): ${costTotal.toFixed(5)}`);
        console.log(`  ✅ Проверка расчета: ${costPerUnit.toFixed(5)} × ${productQuantity} = ${costTotal.toFixed(5)}`);
        console.log(`  📋 Детали по материалам:`, materialCosts.map((m, idx) => ({
          номер: idx + 1,
          materialId: m.materialId,
          количество_на_единицу: m.quantityPerUnit,
          требуемое_количество: m.requiredQuantity,
          себестоимость_за_единицу: m.costPrice,
          стоимость_материала: m.materialCost,
          источник: m.источник
        })));
        
        console.log(`📦 [CLIENT] Продукт ID ${productId} - итоговый расчет себестоимости:`, {
          общая_себестоимость_всех_материалов: totalCost,
          количество_продукта: productQuantity,
          себестоимость_за_единицу: costPerUnit.toFixed(5),
          общая_себестоимость: costTotal.toFixed(5),
          проверка: `${costPerUnit.toFixed(5)} × ${productQuantity} = ${costTotal.toFixed(5)}`,
          материалы: materialCosts.map(m => ({
            materialId: m.materialId,
            стоимость: m.materialCost
          }))
        });
        
        // Проверка на возможные ошибки
        const expectedCostTotal = costPerUnit * productQuantity;
        if (Math.abs(costTotal - expectedCostTotal) > 0.01) {
          console.warn(`⚠️ [CLIENT] ВНИМАНИЕ! Несоответствие в расчете себестоимости продукта ID ${productId}:`, {
            ожидаемый_costTotal: expectedCostTotal,
            фактический_costTotal: costTotal,
            разница: Math.abs(costTotal - expectedCostTotal)
          });
        }
        
        return {
          ...item,
          costPrice: costPerUnit,
          costTotal: costTotal,
          price: costPerUnit,
          total: costTotal
        };
      } catch (error) {
        console.error(`❌ [CLIENT] Ошибка расчета себестоимости для продукта ID ${productId}:`, error);
        return item; // Возвращаем исходный элемент при ошибке
      }
    })
  );

  console.log('\n✅ [CLIENT] ========== ЗАВЕРШЕНИЕ ПЕРЕСЧЕТА СЕБЕСТОИМОСТИ ==========');
  console.log('📊 [CLIENT] Результаты пересчета:', updatedItems.map((item, index) => ({
    индекс: index,
    analiticId: item.analiticId,
    tableType: item.tableType || 'undefined',
    count: item.count,
    costPrice: item.costPrice,
    costTotal: item.costTotal,
    price: item.price,
    total: item.total
  })));
  
  return updatedItems;
}

/**
 * Распределяет общую стоимость материалов на готовую продукцию в документе `ComeProduct`,
 * пропорционально долям из калькуляций (`quantityPerUnit`), а не просто по `count`.
 *
 * Используется для ComeProduct при ручном вводе материалов и нажатии «Рассчитать».
 */
export async function distributeMaterialSumToProducts(
  docTableItems: DocTableItem[],
  token: string
): Promise<DocTableItem[]> {
  const expenseItems = docTableItems.filter(item => item.tableType === 'expense');
  const incomeItems = docTableItems.filter(item => !item.tableType || item.tableType === 'income');

  const totalMaterialSum = expenseItems.reduce((sum, item) => sum + (item.costTotal ?? item.total ?? 0), 0);
  if (incomeItems.length === 0 || totalMaterialSum <= 0) return docTableItems;

  const totalQuantity = incomeItems.reduce((s, item) => s + (item.count ?? 0), 0);
  if (totalQuantity <= 0) return docTableItems;

  const round2 = (value: number) => Math.round(value * 100) / 100;

  // Подготовим количество продукции по её ID
  const productCountById = new Map<number, number>();
  incomeItems.forEach(item => productCountById.set(item.analiticId, item.count ?? 0));

  // Загружаем все калькуляции для каждой строки готовой продукции
  const calculationsByProduct = await Promise.all(
    incomeItems.map(async (incomeItem) => {
      const productId = incomeItem.analiticId;
      try {
        const calculations = await ProductCalculationsService.getCalculationsByProduct(productId, token);
        return { productId, calculations };
      } catch (e) {
        console.warn(`⚠️ [CLIENT] Не удалось загрузить калькуляции для продукта ${productId}:`, e);
        return { productId, calculations: [] as ProductCalculation[] };
      }
    })
  );

  // expectedQtyByMaterial: materialId -> (productId -> expectedQuantity)
  const expectedQtyByMaterial = new Map<number, Map<number, number>>();
  for (const { productId, calculations } of calculationsByProduct) {
    const productQuantity = productCountById.get(productId) ?? 0;
    if (productQuantity <= 0) continue;

    for (const calculation of calculations) {
      const materialId = calculation.materialId;
      const requiredQuantity = calculation.quantityPerUnit * productQuantity;
      if (requiredQuantity <= 0) continue;

      if (!expectedQtyByMaterial.has(materialId)) {
        expectedQtyByMaterial.set(materialId, new Map<number, number>());
      }
      const inner = expectedQtyByMaterial.get(materialId)!;
      inner.set(productId, (inner.get(productId) ?? 0) + requiredQuantity);
    }
  }

  // Суммарная выделенная стоимость для каждой строки готовой продукции
  const allocatedCostTotalByProduct = new Map<number, number>();
  incomeItems.forEach(item => allocatedCostTotalByProduct.set(item.analiticId, 0));

  const incomeProductsList = incomeItems.map(i => ({
    productId: i.analiticId,
    count: i.count ?? 0,
  }));

  // Распределяем стоимость каждого материала отдельно
  for (const expenseItem of expenseItems) {
    const materialId = expenseItem.analiticId;
    const materialCost = expenseItem.costTotal ?? expenseItem.total ?? 0;
    if (materialCost <= 0) continue;

    const expectedByProduct = expectedQtyByMaterial.get(materialId);
    const sumExpectedQty = expectedByProduct
      ? Array.from(expectedByProduct.values()).reduce((s, v) => s + v, 0)
      : 0;

    // Если нет ожидаемых долей по материалу — fallback на пропорцию по count (как было раньше)
    if (!expectedByProduct || sumExpectedQty <= 0) {
      let allocatedSum = 0;
      let bestProductId: number | null = null;
      let bestCount = -Infinity;

      for (const { productId, count } of incomeProductsList) {
        if (count > bestCount) {
          bestCount = count;
          bestProductId = productId;
        }

        const share = totalQuantity > 0 ? count / totalQuantity : 0;
        const shareCost = round2(materialCost * share);
        allocatedCostTotalByProduct.set(
          productId,
          (allocatedCostTotalByProduct.get(productId) ?? 0) + shareCost
        );
        allocatedSum += shareCost;
      }

      const diff = round2(materialCost - allocatedSum);
      if (bestProductId != null && Math.abs(diff) >= 0.01) {
        allocatedCostTotalByProduct.set(
          bestProductId,
          (allocatedCostTotalByProduct.get(bestProductId) ?? 0) + diff
        );
      }

      continue;
    }

    // Распределение по ожидаемой потребности из калькуляций
    let allocatedSum = 0;
    let bestProductId: number | null = null;
    let bestExpectedQty = -Infinity;

    for (const { productId } of incomeProductsList) {
      const expectedQty = expectedByProduct.get(productId) ?? 0;
      if (expectedQty > bestExpectedQty) {
        bestExpectedQty = expectedQty;
        bestProductId = productId;
      }

      const share = expectedQty / sumExpectedQty;
      const shareCost = round2(materialCost * share);
      allocatedCostTotalByProduct.set(
        productId,
        (allocatedCostTotalByProduct.get(productId) ?? 0) + shareCost
      );
      allocatedSum += shareCost;
    }

    const diff = round2(materialCost - allocatedSum);
    if (bestProductId != null && Math.abs(diff) >= 0.01) {
      allocatedCostTotalByProduct.set(
        bestProductId,
        (allocatedCostTotalByProduct.get(bestProductId) ?? 0) + diff
      );
    }
  }

  // Обновляем строки готовой продукции
  return docTableItems.map(item => {
    if (item.tableType === 'expense') return item;

    const productId = item.analiticId;
    const productCount = item.count ?? 0;
    const costTotal = allocatedCostTotalByProduct.get(productId) ?? 0;
    const costPrice = productCount > 0 ? round2(costTotal / productCount) : 0;

    return {
      ...item,
      costPrice,
      costTotal,
      price: costPrice,
      total: costTotal,
    };
  });
}