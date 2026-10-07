// Утилита для отключения логов Telegram Web App
export const disableTelegramLogs = () => {
  // Сохраняем оригинальные методы консоли
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  
  // Функция для проверки, является ли сообщение логом Telegram
  const isTelegramLog = (message: any): boolean => {
    if (typeof message !== 'string') return false;
    return (
      message.includes('[Telegram.WebView]') ||
      message.includes('postEvent') ||
      message.includes('web_app_') ||
      message.includes('Telegram.WebView')
    );
  };
  
  // Переопределяем console.log
  console.log = (...args) => {
    if (isTelegramLog(args[0])) {
      return; // Игнорируем логи Telegram
    }
    originalConsoleLog.apply(console, args);
  };
  
  // Переопределяем console.info
  console.info = (...args) => {
    if (isTelegramLog(args[0])) {
      return; // Игнорируем логи Telegram
    }
    originalConsoleInfo.apply(console, args);
  };
  
  // Переопределяем console.warn
  console.warn = (...args) => {
    if (isTelegramLog(args[0])) {
      return; // Игнорируем логи Telegram
    }
    originalConsoleWarn.apply(console, args);
  };
  
  // Возвращаем функцию для восстановления оригинальных методов
  return () => {
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
  };
}; 