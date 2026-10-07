import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '../common/getApiDomain';
import { showMessage } from '../common/showMessage';

let latestRequestId = 0;

export const getReferenceById = async (
  id: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined
): Promise<void> => {
  if (!id) return;

  const requestId = ++latestRequestId;
  setMainData && setMainData('currentReference', null);

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getNgrokBypassHeaders(),
    },
  };

  try {
    const uri = withApiDomain('/api/references/' + id);
    const response = await axios.get(uri, config);
    if (requestId !== latestRequestId) return;
    setMainData && setMainData('currentReference', response.data);
    setMainData && setMainData('showReferenceWindow', true);
  } catch (error: any) {
    if (requestId !== latestRequestId) return;
    if (setMainData) {
      showMessage(error.message, 'error', setMainData);
    }
  }
};
