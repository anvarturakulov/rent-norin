const isTelegramMiniApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initData && String(tg.initData).length > 0) return true;
  const ua = navigator.userAgent || '';
  return ua.includes('Telegram') || ua.includes('TelegramWebApp');
};

export const getApiDomain = (): string => {
  const defaultDomain = process.env.NEXT_PUBLIC_DOMAIN || '';
  const telegramDomain = process.env.NEXT_PUBLIC_TELEGRAM_API_DOMAIN || defaultDomain;
  return isTelegramMiniApp() ? telegramDomain : defaultDomain;
};

/** Базовый URL API без завершающего слэша (совпадает с next.config.js / backend PORT). */
export const resolveApiBaseUrl = (): string => {
  const fromEnv = (getApiDomain() || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5009`;
  }

  return process.env.NODE_ENV === 'production'
    ? 'https://mebers.kord.uz'
    : 'http://localhost:5009';
};

export const withApiDomain = (path: string): string => {
  const base = getApiDomain();
  if (!base) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

export const getNgrokBypassHeaders = (targetUrl?: string): Record<string, string> => {
  const base = targetUrl || getApiDomain();
  if (!base) return {};
  if (base.includes('ngrok-free.app')) {
    return { 'ngrok-skip-browser-warning': 'true' };
  }
  return {};
};
