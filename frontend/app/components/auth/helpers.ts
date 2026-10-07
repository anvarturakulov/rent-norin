import { loginToApp, LoginResult } from "@/app/service/common/loginToApp";
import { loginToAppTelegram } from "@/app/service/common/loginToAppTelegram";
import { showMessage } from "@/app/service/common/showMessage";
import { verifyOtpToApp } from "@/app/service/common/verifyOtpToApp";
import { BodyForLogin } from "@/app/interfaces/user.interface";

export const loginByTelegram = (setMainData: Function | undefined) => {
    const win: any = window;
    if (typeof win !== 'undefined' && win.Telegram?.WebApp) {
      const tg = win.Telegram.WebApp;
      tg.ready();
      const data = tg.initData;
      if (data) {
        const body = { initData: data };
        loginToAppTelegram(body, setMainData)
      } else {
        console.warn('initData is empty');
      }
    } else {
      console.error('Telegram WebApp SDK not loaded or not in Telegram context');
    }
  }

  export const onSubmit = async (
    body: BodyForLogin,
    setMainData: Function | undefined,
    platform: string,
  ): Promise<LoginResult | void> => {
    const {email, password} = body;
    
    if (platform == 'telegram') {
      loginByTelegram(setMainData)
      return;
    }

    if (email.trim().length && password.trim().length) {
      return loginToApp(body, setMainData)
    }

    showMessage("Кириш учун маълумотларни киритинг", 'error', setMainData)
    return 'error';
  }

export const onVerifyOtp = async (
  email: string,
  code: string,
  setMainData: Function | undefined,
): Promise<boolean> => {
  if (!email.trim() || !/^\d{6}$/.test(code.trim())) {
    showMessage("Telegramдан келган 6 рақамли кодни киритинг", 'error', setMainData)
    return false;
  }
  return verifyOtpToApp(email.trim(), code.trim(), setMainData);
}
