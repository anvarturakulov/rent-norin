import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const markEnterpriseToDelete = async (
  id: number,
  token: string | undefined,
  setMainData: Function | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/enterprises/' + id + '/mark-to-delete';
  
  try {
    await axios.patch(uri, {}, config);
    if (setMainData) {
      showMessage('Предприятие помечено на удаление', 'success', setMainData);
      setMainData('updateDataForEnterpriseJournal', true);
    }
  } catch (error: any) {
    if (setMainData) {
      showMessage(error.response?.data?.message || error.message, 'error', setMainData);
    }
    throw error;
  }
};

