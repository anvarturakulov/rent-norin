import { getNgrokBypassHeaders } from './getApiDomain';
import { clearAuthSession } from './authStorage';

export const getDataForSwr = async (url: string, token: string | undefined) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getNgrokBypassHeaders(url),
    }
  };
  const response = await fetch(url, config);
  
  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
      const errorData = await response.json().catch(() => ({ message: 'Токен истек. Пожалуйста, войдите снова.' }));
      throw new Error(errorData.message || 'Токен истек. Пожалуйста, войдите снова.');
    }
    
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
};
