import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const getPereodicById = (
  id: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };
  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/pereodic/' + id;
    axios.get(uri, config)
      .then(function (response) {
        // Преобразуем date из строки в число
        const data = {
          ...response.data,
          date: typeof response.data.date === 'string' ? +response.data.date : response.data.date
        };
        setMainData && setMainData('currentPereodic', data);
        setMainData && setMainData('showPereodicWindow', true);
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData)
        }
      });
  }
}