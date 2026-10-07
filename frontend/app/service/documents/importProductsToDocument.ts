import { getImportedProducts, ImportedProduct } from './getImportedProducts';
import { DocTableItem } from '@/app/interfaces/document.interface';
import { showMessage } from '../common/showMessage';

export const importProductsToDocument = async (
  setMainData: Function | undefined,
  token: string | undefined,
  currentDocTableItems: DocTableItem[]
): Promise<void> => {
  try {
    console.log('Начинаем импорт товаров...');
    
    // Получаем импортированные товары
    const importedProducts = await getImportedProducts(setMainData, token);
    
    console.log('Получены импортированные товары:', importedProducts.length);
    
    if (importedProducts.length === 0) {
      if (setMainData) {
        showMessage('Нет импортированных товаров для добавления', 'warm', setMainData);
      }
      return;
    }

    // Создаем новые элементы таблицы из импортированных товаров
    const newDocTableItems: DocTableItem[] = importedProducts.map(product => ({
      analiticId: product.id,
      count: product.remainInStart, // count = refValues.remainInStart
      price: product.costPriceInStart, // price = refValues.costPriceInStart
      total: product.remainInStart * product.costPriceInStart, // total = count * price
      balance: 0, // баланс будет рассчитан автоматически
      costPrice: product.costPriceInStart,
      costTotal: product.remainInStart * product.costPriceInStart,
      refCountInBox: 1,
      countByBox: product.remainInStart
    }));

    console.log('Создано новых элементов:', newDocTableItems.length);

    // Объединяем существующие и новые элементы
    const updatedDocTableItems = [...(currentDocTableItems || []), ...newDocTableItems];

    console.log('Обновляем документ в контексте...');

    // Обновляем документ в контексте
    if (setMainData) {
      console.log('setMainData доступен, начинаем обновление контекста...');
      
      // Обновляем docTableItems напрямую
      setMainData('docTableItems', updatedDocTableItems);

      console.log('setMainData вызван с docTableItems, ждем обновления...');

      showMessage(
        `Успешно импортировано ${newDocTableItems.length} товаров в документ`, 
        'success', 
        setMainData
      );
    } else {
      console.error('setMainData не доступен');
    }

  } catch (error) {
    console.error('Ошибка при импорте товаров:', error);
    if (setMainData) {
      showMessage(
        `Ошибка при импорте товаров: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`, 
        'error', 
        setMainData
      );
    }
  }
};
