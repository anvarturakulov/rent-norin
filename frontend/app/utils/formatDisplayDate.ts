import { APP_LOCALE, APP_TIMEZONE } from '@/app/config/locale';

export function formatDisplayDate(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(APP_LOCALE, { timeZone: APP_TIMEZONE });
}

export function formatDisplayTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDisplayDateTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const datePart = formatDisplayDate(ms);
  const timePart = formatDisplayTime(ms);
  if (!datePart) return '';
  return timePart ? `${datePart} ${timePart}` : datePart;
}

export function formatDisplayDateOrDash(ms?: number | string | null): string {
  if (ms == null || ms === '') return '—';
  const num = typeof ms === 'string' ? Number(ms) : ms;
  if (!Number.isFinite(num) || num <= 0) return '—';
  const formatted = formatDisplayDate(num);
  return formatted || '—';
}
