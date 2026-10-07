import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const deleteComeProducts = (
  dateStart: number,
  dateEnd: number,
  token: string | undefined,
  setMainData: Function | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (dateStart && dateEnd) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/deleteComeProducts' + '?dateStart='+dateStart+'&dateEnd='+dateEnd;

    axios.delete(uri, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Хужжатлар тозаланди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData)
        }
      });
  }
}