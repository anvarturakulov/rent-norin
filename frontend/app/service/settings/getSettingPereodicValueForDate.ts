import axios from 'axios';
import { getNgrokBypassHeaders, resolveApiBaseUrl } from '../common/getApiDomain';

export const getSettingPereodicValueForDate = async (
  settingId: number,
  date: number,
  token: string | undefined,
  enterpriseId?: number | null
): Promise<number> => {
  try {
    const domain = resolveApiBaseUrl();
    const config: any = {
      headers: {
        Authorization: `Bearer ${token}`,
        ...getNgrokBypassHeaders(domain),
      },
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      config.headers['x-enterprise-id'] = enterpriseId.toString();
    }
    const params = new URLSearchParams({ date: String(date) });
    if (enterpriseId !== undefined && enterpriseId !== null) {
      params.set('enterpriseId', String(enterpriseId));
    }
    const uri = `${domain}/api/settings/${settingId}/pereodic/forDate?${params.toString()}`;

    const response = await axios.get(uri, config);
    return response.data;
  } catch (error) {
    console.error('Error fetching setting pereodic value for date:', error);
    return 0;
  }
};
