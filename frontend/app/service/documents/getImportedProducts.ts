import axios from 'axios';
import { showMessage } from '../common/showMessage';

export interface ImportedProduct {
  id: number;
  name: string;
  unit: string;
  remainInStart: number;
  costPriceInStart: number;
}

export const getImportedProducts = (
  setMainData: Function | undefined,
  token: string | undefined
): Promise<ImportedProduct[]> => {
  return new Promise((resolve, reject) => {
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/data-import/imported-products';
    
    console.log('Отправляем запрос к:', uri);
    console.log('Токен:', token ? 'Есть' : 'Нет');
    
    axios.get(uri, config)
      .then(function (response) {
        console.log('Получен ответ от API:', response.data);
        if (response.data.success) {
          resolve(response.data.data || []);
        } else {
          if (setMainData) {
            showMessage(response.data.message || 'Ошибка при получении товаров', 'error', setMainData);
          }
          reject(new Error(response.data.message));
        }
      })
      .catch(function (error) {
        console.error('Ошибка API запроса:', error);
        if (setMainData) {
          showMessage(error.message, 'error', setMainData);
        }
        reject(error);
      });
  });
};
