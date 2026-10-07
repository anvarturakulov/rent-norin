import axios from 'axios';
import { showMessage } from './showMessage';
import { loadEnterpriseMenuConfig } from '../enterprises/loadEnterpriseMenuConfig';
import { workersUsersList } from '@/app/interfaces/user.interface';
import { getNgrokBypassHeaders } from './getApiDomain';

export const loginToAppTelegram = (body: any, setMainData: Function | undefined) => {
  const telegramApiDomain = process.env.NEXT_PUBLIC_TELEGRAM_API_DOMAIN || process.env.NEXT_PUBLIC_DOMAIN;
  const uri = telegramApiDomain + '/api/auth/loginByTelegram';
  axios.post(uri, body, {
    headers: {
      'Content-Type': 'application/json',
      ...getNgrokBypassHeaders(uri),
    },
  })
    .then(async function (response) {
      const user = response.data;
      setMainData && setMainData('user', user);

      // Для рабочих ролей menuVisibility не используется — пропускаем лишний запрос.
      if (workersUsersList.includes(user?.role)) {
        if (setMainData) {
          setMainData('enterpriseSettings', { menuVisibility: undefined });
        }
        return;
      }
      
      // Загружаем настройки предприятия, если есть enterpriseId
      if (user.enterpriseId && user.token) {
        try {
          const menuVisibility = await loadEnterpriseMenuConfig(user.enterpriseId, user.token, telegramApiDomain);
          if (setMainData && menuVisibility) {
            setMainData('enterpriseSettings', { menuVisibility });
          } else if (setMainData) {
            // Если настройки не найдены, устанавливаем undefined
            setMainData('enterpriseSettings', { menuVisibility: undefined });
          }
        } catch (error) {
          console.error('Ошибка при загрузке настроек предприятия:', error);
          // В случае ошибки устанавливаем undefined
          if (setMainData) {
            setMainData('enterpriseSettings', { menuVisibility: undefined });
          }
        }
      } else {
        // Если нет enterpriseId, очищаем настройки
        if (setMainData) {
          setMainData('enterpriseSettings', { menuVisibility: undefined });
        }
      }
      // showMessage('Малумотлар келди', 'success', setMainData)
    })
    .catch(function (error) {
      if (setMainData) {
        if (error.response?.status == 401) {
          showMessage('Фойдаланувчи маълумотлари хато киритилди', 'error', setMainData)
        } else {
          showMessage(error.message+'dddd', 'error', setMainData)
        }
      }
    });
}