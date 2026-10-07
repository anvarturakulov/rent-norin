import axios from 'axios';
import { Enterprise } from '@/app/interfaces/enterprise.interface';
import { MenuVisibilitySettings } from '@/app/interfaces/enterprise.interface';
import { patchMenuVisibilityInformReports } from '@/app/utils/menuFilter';

/**
 * Загружает настройки видимости меню для предприятия
 * @param enterpriseId - ID предприятия
 * @param token - токен авторизации
 * @returns настройки видимости меню или undefined
 */
export const loadEnterpriseMenuConfig = async (
  enterpriseId: number | null | undefined,
  token: string | undefined,
  apiDomain?: string
): Promise<MenuVisibilitySettings | undefined> => {
  if (!enterpriseId || !token) {
    return undefined;
  }

  try {
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };
    const baseDomain = apiDomain || process.env.NEXT_PUBLIC_DOMAIN;
    const url = baseDomain + '/api/enterprises/' + enterpriseId;
    const response = await axios.get<Enterprise>(url, config);
    
    const enterprise = response.data;
    if (enterprise.settings && enterprise.settings.menuVisibility) {
      return patchMenuVisibilityInformReports(enterprise.settings.menuVisibility);
    }
    
    return undefined;
  } catch (error) {
    console.error('Ошибка при загрузке настроек предприятия:', error);
    return undefined;
  }
};

