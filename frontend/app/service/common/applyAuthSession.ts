import { User, workersUsersList } from '@/app/interfaces/user.interface';
import { loadEnterpriseMenuConfig } from '../enterprises/loadEnterpriseMenuConfig';
import { showMessage } from './showMessage';

export const applyAuthSession = async (
  user: User,
  setMainData: Function | undefined,
  apiDomain?: string,
) => {
  if (workersUsersList.includes(user?.role)) {
    showMessage(
      'Для рабочих ролей вход доступен только через Telegram Mini App',
      'error',
      setMainData,
    );
    return;
  }

  setMainData && setMainData('user', user);

  if (user.enterpriseId && user.token) {
    try {
      const menuVisibility = await loadEnterpriseMenuConfig(
        user.enterpriseId,
        user.token,
        apiDomain,
      );
      if (setMainData && menuVisibility) {
        setMainData('enterpriseSettings', { menuVisibility });
      } else if (setMainData) {
        setMainData('enterpriseSettings', { menuVisibility: undefined });
      }
    } catch (error) {
      console.error('Ошибка при загрузке настроек предприятия:', error);
      if (setMainData) {
        setMainData('enterpriseSettings', { menuVisibility: undefined });
      }
    }
    return;
  }

  if (setMainData) {
    setMainData('enterpriseSettings', { menuVisibility: undefined });
  }
};

export const getAuthErrorMessage = (error: any, fallback: string): string => {
  const fromResponse = error?.response?.data?.message;
  if (typeof fromResponse === 'string' && fromResponse.trim()) {
    return fromResponse;
  }
  if (Array.isArray(fromResponse) && fromResponse[0]) {
    return String(fromResponse[0]);
  }
  if (error?.response?.status === 401) {
    return fallback;
  }
  if (error?.response?.status === 423) {
    return fromResponse || 'Доступ временно заблокирован. Попробуйте через 1 час.';
  }
  return error?.message || fallback;
};
