import { useAppContext } from '../context/app.context';
import { PlatformType } from '../service/common/platform/platformDetector';

export const usePlatform = () => {
  const { mainData } = useAppContext();
  const platformInfo = mainData.platform.info;

  return {
    // Основная информация о платформе
    platformType: platformInfo?.type || 'unknown' as PlatformType,
    isTelegram: platformInfo?.isTelegram || false,
    isBrowser: platformInfo?.isBrowser || false,
    
    // User Agent
    userAgent: platformInfo?.userAgent || '',
    
    // Telegram Web App API (если доступен)
    telegramWebApp: platformInfo?.telegramWebApp,
    
    // Удобные методы для проверки
    isTelegramWebApp: () => platformInfo?.isTelegram || false,
    isRegularBrowser: () => platformInfo?.isBrowser || false,
    
    // Полная информация о платформе
    platformInfo,
    
    // Методы для работы с Telegram Web App
    getTelegramUser: () => {
      if (platformInfo?.telegramWebApp?.initDataUnsafe?.user) {
        return platformInfo.telegramWebApp.initDataUnsafe.user;
      }
      return null;
    },
    
    getTelegramChat: () => {
      if (platformInfo?.telegramWebApp?.initDataUnsafe?.chat) {
        return platformInfo.telegramWebApp.initDataUnsafe.chat;
      }
      return null;
    },
    
    // Методы для адаптации UI под платформу
    shouldShowTelegramUI: () => platformInfo?.isTelegram || false,
    shouldShowBrowserUI: () => platformInfo?.isBrowser || false,
    
    // Методы для отправки данных в Telegram
    sendDataToTelegram: (data: string) => {
      if (platformInfo?.telegramWebApp?.sendData) {
        platformInfo.telegramWebApp.sendData(data);
      }
    },
    
    // Методы для работы с кнопками Telegram
    showMainButton: (text: string, callback?: () => void) => {
      if (platformInfo?.telegramWebApp?.mainButton) {
        platformInfo.telegramWebApp.mainButton.setText(text);
        platformInfo.telegramWebApp.mainButton.show();
        if (callback) {
          platformInfo.telegramWebApp.mainButton.onClick(callback);
        }
      }
    },
    
    hideMainButton: () => {
      if (platformInfo?.telegramWebApp?.mainButton) {
        platformInfo.telegramWebApp.mainButton.hide();
      }
    },
    
    showBackButton: (callback?: () => void) => {
      if (platformInfo?.telegramWebApp?.backButton) {
        platformInfo.telegramWebApp.backButton.show();
        if (callback) {
          platformInfo.telegramWebApp.backButton.onClick(callback);
        }
      }
    },
    
    hideBackButton: () => {
      if (platformInfo?.telegramWebApp?.backButton) {
        platformInfo.telegramWebApp.backButton.hide();
      }
    },
    
    // Методы для работы с темой
    setHeaderColor: (color: string) => {
      if (platformInfo?.telegramWebApp?.setHeaderColor) {
        platformInfo.telegramWebApp.setHeaderColor(color);
      }
    },
    
    setBackgroundColor: (color: string) => {
      if (platformInfo?.telegramWebApp?.setBackgroundColor) {
        platformInfo.telegramWebApp.setBackgroundColor(color);
      }
    },
    
    // Методы для работы с всплывающими окнами
    showAlert: (message: string, callback?: () => void) => {
      if (platformInfo?.telegramWebApp?.showAlert) {
        platformInfo.telegramWebApp.showAlert(message, callback);
      } else {
        // Fallback для браузера
        alert(message);
        if (callback) callback();
      }
    },
    
    showConfirm: (message: string, callback?: (confirmed: boolean) => void) => {
      if (platformInfo?.telegramWebApp?.showConfirm) {
        platformInfo.telegramWebApp.showConfirm(message, callback);
      } else {
        // Fallback для браузера
        const confirmed = confirm(message);
        if (callback) callback(confirmed);
      }
    }
  };
};