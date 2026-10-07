import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const deleteSettingPereodic = (
  settingId: number,
  pId: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (pId) {
    const uri = `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings/${settingId}/pereodic/${pId}`;
    axios.delete(uri, config)
      .then(() => {
        if (setMainData) {
          showMessage('Қиймат ўчирилди', 'success', setMainData);
          setMainData('updateDataForSettingPereodicsList', true);
        }
      })
      .catch((error) => {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData);
        }
      });
  }
};
