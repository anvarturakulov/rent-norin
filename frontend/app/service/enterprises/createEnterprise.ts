import axios from 'axios';
import { showMessage } from '../common/showMessage';
import { Enterprise } from '@/app/interfaces/enterprise.interface';

export const createEnterprise = async (
  enterprise: Enterprise,
  token: string | undefined,
  setMainData: Function | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/enterprises/';
  
  // Убираем id при создании, так как он генерируется автоматически
  const { id, createdAt, updatedAt, markToDeleted, ...enterpriseData } = enterprise;
  
  try {
    const response = await axios.post(uri, enterpriseData, config);
    if (setMainData) {
      showMessage('Предприятие успешно создано', 'success', setMainData);
      setMainData('updateDataForEnterpriseJournal', true);
    }
    return response.data;
  } catch (error: any) {
    if (setMainData) {
      const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка';
      showMessage(`Ошибка: ${errorMessage}`, 'error', setMainData);
    }
    throw error;
  }
};

