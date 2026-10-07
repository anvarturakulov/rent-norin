import { 
  calculateMaterialsForProductsClient,
  convertMaterialsToDocTableItemsClient,
  getMaterialBalanceClient,
  extractProductsFromDocTableItemsClient,
  recalculateProductCostFromMaterialsClient,
  distributeMaterialSumToProducts as distributeMaterialSumToProductsClient
} from './calculateMaterialsClient';
import { DocTableItem } from '@/app/interfaces/document.interface';

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
}

/**
 * Рассчитывает материалы на основе калькуляций готовой продукции
 * НОВАЯ АРХИТЕКТУРА: Расчет происходит на фронтенде
 */
export async function calculateMaterialsForProducts(
  endDate: number,
  products: ProductQuantityInput[],
  token: string,
  materialWarehouseId: number = 1
): Promise<MaterialCalculationResult[]> {
  console.log('🔄 Переключение на клиентскую логику расчета материалов');
  return calculateMaterialsForProductsClient(endDate, products, token, materialWarehouseId);
}

/**
 * Получает остаток материала со склада
 * НОВАЯ АРХИТЕКТУРА: Используем клиентскую версию
 */
export async function getMaterialBalance(
  materialId: number, 
  warehouseId: number, 
  token: string
): Promise<number> {
  return getMaterialBalanceClient(materialId, warehouseId, token);
}

/**
 * Преобразует результаты расчета материалов в DocTableItem для использования в документе
 * НОВАЯ АРХИТЕКТУРА: Остатки получаем через WebSocket, не через HTTP
 */
export function convertMaterialsToDocTableItems(
  materials: MaterialCalculationResult[]
): DocTableItem[] {
  return convertMaterialsToDocTableItemsClient(materials);
}

/**
 * Синхронная версия для обратной совместимости (без получения остатков)
 */
export function convertMaterialsToDocTableItemsSync(
  materials: MaterialCalculationResult[]
): DocTableItem[] {
  return materials.map((material) => ({
    analiticId: material.materialId,
    balance: 0, // Остаток на складе (будет обновлен позже)
    count: material.totalQuantity,
    price: material.costPrice, // Используем себестоимость
    total: material.costTotal,
    costPrice: material.costPrice,
    costTotal: material.costTotal,
    tableType: 'expense' as const, // Это списание материалов
  }));
}

/**
 * Пересчитывает себестоимость готовой продукции на основе материалов
 * НОВАЯ АРХИТЕКТУРА: Используем клиентскую версию
 */
export async function recalculateProductCostFromMaterials(
  endDate: number,
  docTableItems: DocTableItem[],
  token: string,
  materialWarehouseId: number = 1
): Promise<DocTableItem[]> {
  return recalculateProductCostFromMaterialsClient(docTableItems, token, endDate, materialWarehouseId);
}

/**
 * Извлекает продукты из DocTableItem и подготавливает их для расчета материалов
 * НОВАЯ АРХИТЕКТУРА: Используем клиентскую версию
 */
export function extractProductsFromDocTableItems(
  docTableItems: DocTableItem[]
): ProductQuantityInput[] {
  return extractProductsFromDocTableItemsClient(docTableItems);
}

/** Получить цену и остаток материала со склада (для ручного добавления материала в ComeProduct). */
export { getMaterialCostPriceClient as getMaterialCostPrice } from './calculateMaterialsClient';

/**
 * Распределяет сумму материалов по продукции пропорционально количеству (кнопка «Рассчитать»).
 */
export async function distributeMaterialSumToProducts(
  docTableItems: DocTableItem[],
  token: string
): Promise<DocTableItem[]> {
  return distributeMaterialSumToProductsClient(docTableItems, token);
}
