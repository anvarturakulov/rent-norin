import axios from 'axios';
import { showMessage } from './showMessage';
import { BodyForLogin } from '@/app/interfaces/user.interface';
import { applyAuthSession, getAuthErrorMessage } from './applyAuthSession';

export type LoginResult = 'ok' | 'otp' | 'error';

export const loginToApp = async (
  body: BodyForLogin,
  setMainData: Function | undefined,
): Promise<LoginResult> => {
  const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/auth/login';
  try {
    const response = await axios.post(uri, body);
    const payload = response.data;

    if (payload?.otpRequired) {
      showMessage('Код Telegramга юборилди', 'success', setMainData);
      return 'otp';
    }

    if (!payload?.token) {
      showMessage('Кириш натижаси нотўғри', 'error', setMainData);
      return 'error';
    }

    await applyAuthSession(payload, setMainData);
    return 'ok';
  } catch (error: any) {
    if (setMainData) {
      showMessage(
        getAuthErrorMessage(error, 'Фойдаланувчи маълумотлари хато киритилди'),
        'error',
        setMainData,
      );
    }
    return 'error';
  }
};
