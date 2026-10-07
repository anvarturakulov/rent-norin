import axios from 'axios';
import { showMessage } from './showMessage';
import { applyAuthSession, getAuthErrorMessage } from './applyAuthSession';

export const verifyOtpToApp = async (
  email: string,
  code: string,
  setMainData: Function | undefined,
): Promise<boolean> => {
  const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/auth/verifyOtp';
  try {
    const response = await axios.post(uri, { email, code });
    const user = response.data;
    if (!user?.token) {
      showMessage('Код тасдиқланмади', 'error', setMainData);
      return false;
    }
    await applyAuthSession(user, setMainData);
    return true;
  } catch (error: any) {
    if (setMainData) {
      showMessage(
        getAuthErrorMessage(error, 'Код нотўғри ёки муддати тугаган'),
        'error',
        setMainData,
      );
    }
    return false;
  }
};
