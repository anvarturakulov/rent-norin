export type PlatformType = 'browser' | 'telegram' | 'unknown';

export interface PlatformInfo {
  type: PlatformType;
  isTelegram: boolean;
  isBrowser: boolean;
  userAgent: string;
  telegramWebApp?: {
    initData: string;
    initDataUnsafe: any;
    version: string;
    platform: string;
    colorScheme: string;
    themeParams: any;
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    headerColor: string;
    backgroundColor: string;
    isClosingConfirmationEnabled: boolean;
    backButton: any;
    mainButton: any;
    hapticFeedback: any;
    cloudStorage: any;
    isVersionAtLeast: (version: string) => boolean;
    setHeaderColor: (color: string) => void;
    setBackgroundColor: (color: string) => void;
    enableClosingConfirmation: () => void;
    disableClosingConfirmation: () => void;
    onEvent: (eventType: string, eventHandler: Function) => void;
    offEvent: (eventType: string, eventHandler: Function) => void;
    sendData: (data: string) => void;
    switchInlineQuery: (query: string, chooseChatTypes?: string[]) => void;
    openLink: (url: string, options?: { tryInstantView?: boolean }) => void;
    openTelegramLink: (url: string) => void;
    openInvoice: (url: string, callback?: Function) => void;
    showPopup: (params: any, callback?: Function) => void;
    showAlert: (message: string, callback?: Function) => void;
    showConfirm: (message: string, callback?: Function) => void;
    showScanQrPopup: (params: any, callback?: Function) => void;
    closeScanQrPopup: () => void;
    readTextFromClipboard: (callback?: Function) => void;
    requestWriteAccess: (callback?: Function) => void;
    requestContact: (callback?: Function) => void;
    invokeCustomMethod: (method: string, params: any, callback?: Function) => void;
  };
}

export const detectPlatform = (): PlatformInfo => {
  const userAgent = navigator.userAgent;
  
  // Проверяем наличие Telegram Web App API
  const telegramWebApp = (window as any).Telegram?.WebApp;
  
  if (telegramWebApp && typeof telegramWebApp.initData === 'string') {
    return {
      type: 'telegram',
      isTelegram: true,
      isBrowser: false,
      userAgent,
      telegramWebApp
    };
  }
  
  // Проверяем по User Agent
  if (userAgent.includes('TelegramWebApp') || userAgent.includes('Telegram')) {
    return {
      type: 'telegram',
      isTelegram: true,
      isBrowser: false,
      userAgent
    };
  }
  
  // Проверяем по URL параметрам (Telegram может передавать специальные параметры)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('tgWebAppData') || urlParams.has('tgWebAppStartParam')) {
    return {
      type: 'telegram',
      isTelegram: true,
      isBrowser: false,
      userAgent
    };
  }
  
  // Если это обычный браузер
  return {
    type: 'browser',
    isTelegram: false,
    isBrowser: true,
    userAgent
  };
};

export const getTelegramWebApp = () => {
  return (window as any).Telegram?.WebApp;
};

export const isTelegramWebApp = (): boolean => {
  return detectPlatform().isTelegram;
};

export const isBrowser = (): boolean => {
  return detectPlatform().isBrowser;
}; 