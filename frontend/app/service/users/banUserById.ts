import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const banUserById = (
  id: number | undefined,
  name: string | undefined,
  reason: string | undefined,
  setMainData: Function | undefined,
  token: string | undefined,
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    
    const body =  {
      id: id,
      reason: reason
    }

    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/users/ban';
    axios.patch(uri, body, config)
      .then(function () {
        if (setMainData) {
          showMessage(`${name} - холати узгартирилди`, 'success', setMainData);
          setMainData('updateDataForRefenceJournal', false);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData)
        }
      });
  }
}