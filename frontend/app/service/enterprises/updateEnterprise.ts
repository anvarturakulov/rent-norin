import axios from 'axios';
import { showMessage } from '../common/showMessage';
import { Enterprise } from '@/app/interfaces/enterprise.interface';

export const updateEnterprise = async (
  id: number,
  enterprise: Partial<Enterprise>,
  token: string | undefined,
  setMainData: Function | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/enterprises/' + id;
  
  try {
    const response = await axios.patch(uri, enterprise, config);
    if (setMainData) {
      showMessage('Предприятие успешно обновлено', 'success', setMainData);
      setMainData('updateDataForEnterpriseJournal', true);
    }
    return response.data;
  } catch (error: any) {
    if (setMainData) {
      showMessage(error.response?.data?.message || error.message, 'error', setMainData);
    }
    throw error;
  }
};

