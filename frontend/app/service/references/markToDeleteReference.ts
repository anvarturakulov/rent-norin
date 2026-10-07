import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const markToDeleteReference = (
  id: number | undefined,
  name: string, setMainData: Function | undefined,
  token: string | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/references/markToDelete/' + id;
    axios.delete(uri, config)
      .then(function () {
        if (setMainData) {
          showMessage(`${name} - холати узгартирилди`, 'success', setMainData);
          setMainData('updateDataForRefenceJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          let errorMessage = 'Ошибка при удалении справочника';
          
          // Проверяем различные варианты ошибок
          if (error.response) {
            // Сервер ответил с ошибкой
            if (error.response.data) {
              if (typeof error.response.data === 'string') {
                errorMessage = error.response.data;
              } else if (error.response.data.message) {
                errorMessage = error.response.data.message;
              } else if (error.response.data.error) {
                errorMessage = error.response.data.error;
              }
            } else {
              errorMessage = `Ошибка сервера: ${error.response.status} ${error.response.statusText}`;
            }
          } else if (error.request) {
            // Запрос был отправлен, но ответа не получено
            errorMessage = 'Сервер не отвечает. Проверьте подключение к интернету.';
          } else if (error.message) {
            // Ошибка при настройке запроса
            errorMessage = error.message;
          }
          
          showMessage(errorMessage, 'error', setMainData);
        }
      });
  }
}