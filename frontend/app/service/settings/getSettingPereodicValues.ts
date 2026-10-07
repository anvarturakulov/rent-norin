import axios from 'axios';
import { getNgrokBypassHeaders, resolveApiBaseUrl } from '../common/getApiDomain';

export const getSettingPereodicValues = async (
  settingId: number,
  token: string | undefined,
  enterpriseId?: number | null
): Promise<any[]> => {
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
    const params = enterpriseId ? `?enterpriseId=${enterpriseId}` : '';
    const uri = `${domain}/api/settings/${settingId}/pereodic${params}`;

    const response = await axios.get(uri, config);
    return response.data;
  } catch (error) {
    console.error('Error fetching setting pereodic values:', error);
    return [];
  }
};
