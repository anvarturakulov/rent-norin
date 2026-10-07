import { APP_LOCALE, APP_TIMEZONE } from '@/app/config/locale';

export const dateToStr = (num: number | null) => {
  if (num) {
    return new Date(num).toLocaleDateString(APP_LOCALE, { timeZone: APP_TIMEZONE });
  }
};
