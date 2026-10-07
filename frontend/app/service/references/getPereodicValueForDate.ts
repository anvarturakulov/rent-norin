import axios from 'axios';
import { getNgrokBypassHeaders, resolveApiBaseUrl } from '../common/getApiDomain';

export const getPereodicValueForDate = async (
  referenceId: number, 
  valueName: string, 
  date: number,
  token: string | undefined,
  enterpriseId?: number | null
): Promise<number> => {
  try {
    const baseDomain = resolveApiBaseUrl();
    const config: any = {
      headers: {
        Authorization: `Bearer ${token}`,
        ...getNgrokBypassHeaders(baseDomain),
      },
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      config.headers['x-enterprise-id'] = enterpriseId.toString();
    }
    const params = new URLSearchParams({
      referenceId: String(referenceId),
      valueName,
      date: String(date),
    });
    const uri = `${baseDomain}/api/pereodic/valueForDate?${params.toString()}`;
    
    const response = await axios.get(uri, config);
    return response.data;
  } catch (error) {
    console.error('Error fetching pereodic value:', error);
    return 0;
  }
}; 