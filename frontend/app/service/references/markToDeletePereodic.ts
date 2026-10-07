import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const markToDeletePereodic = (
  id: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/pereodic/markToDelete/' + id;
    axios.delete(uri, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Киймат учирилди`, 'success', setMainData);
          setMainData('updateDataForPereodicsList', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData)
        }
      });
  }
}