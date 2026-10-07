export const getSettingByKeyFromDB = async (
  key: string,
  token: string | undefined,
  enterpriseId?: number | null
): Promise<any> => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_DOMAIN + `/api/settings/key/${key}`;
      const query = enterpriseId !== null && enterpriseId !== undefined
        ? `?enterpriseId=${enterpriseId}`
        : '';
      const url = `${baseUrl}${query}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
  
      if (response.ok) {
        // Проверяем, что ответ не пустой
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn(`Setting with key "${key}" returned non-JSON response`);
          return null;
        }
        
        const text = await response.text();
        if (!text || text.trim() === '') {
          console.warn(`Setting with key "${key}" returned empty response`);
          return null;
        }
        
        try {
          const setting = JSON.parse(text);
          return setting.value;
        } catch (parseError) {
          console.warn(`Setting with key "${key}" returned invalid JSON:`, parseError);
          return null;
        }
      } else {
        console.warn(`Setting with key "${key}" not found or access denied. Status: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('Ошибка при получении настройки:', error);
      return null;
    }
  };
