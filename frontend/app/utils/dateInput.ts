/**
 * HTML date input value YYYY-MM-DD ↔ timestamp in Asia/Tashkent.
 * Document dates keep time-of-day; interval bounds use start of Tashkent day.
 */

import { nowMs } from '@/app/utils/serverNow';
import {
  combineZonedDateAndTime,
  formatZonedYmd,
  getZonedParts,
  isValidZonedYmd,
  zonedDateTimeToMs,
  zonedYmdToStartMs,
} from '@/app/utils/appTime';

export const DATE_INPUT_YEAR_MIN = 1900;
export const DATE_INPUT_YEAR_MAX = 2100;
export const DATE_INPUT_MIN = `${DATE_INPUT_YEAR_MIN}-01-01`;
export const DATE_INPUT_MAX = `${DATE_INPUT_YEAR_MAX}-12-31`;

/** Placeholder for free-text date fields (DD.MM.YYYY). */
export const DATE_DISPLAY_PLACEHOLDER = 'ДД.ММ.ГГГГ';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_DISPLAY_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

export interface ParseDateInputOptions {
  /** Keep hours:minutes from this instant (Tashkent). Default: start of that Tashkent day. */
  timeFromMs?: number;
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  if (!value || typeof value !== 'string') return null;
  if (!DATE_INPUT_PATTERN.test(value.trim())) return null;
  const parts = value.trim().split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < DATE_INPUT_YEAR_MIN || year > DATE_INPUT_YEAR_MAX) return null;
  if (!isValidZonedYmd(year, month, day)) return null;
  return { year, month, day };
}

export function parseDateInputValue(
  value: string,
  options?: ParseDateInputOptions,
): number | null {
  const ymd = parseYmd(value);
  if (!ymd) return null;

  const timeFrom = options?.timeFromMs;
  if (timeFrom != null && Number.isFinite(timeFrom) && timeFrom > 0) {
    const timeParts = getZonedParts(timeFrom);
    if (timeParts) {
      return zonedDateTimeToMs(
        ymd.year,
        ymd.month,
        ymd.day,
        timeParts.hours,
        timeParts.minutes,
        timeParts.seconds,
        timeParts.milliseconds,
      );
    }
  }

  return zonedYmdToStartMs(ymd.year, ymd.month, ymd.day);
}

export function formatDateForInput(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  return formatZonedYmd(ms);
}

/** Default document date when creating or duplicating — server-synced now. */
export function getDefaultDocumentDateMs(): number {
  return nowMs();
}

export function formatDateForDisplay(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const parts = getZonedParts(ms);
  if (!parts) return '';
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  return `${day}.${month}.${parts.year}`;
}

export function dateFieldToMs(value: string, options?: ParseDateInputOptions): number | null {
  if (!value || typeof value !== 'string') return null;
  const match = DATE_DISPLAY_PATTERN.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (year < DATE_INPUT_YEAR_MIN || year > DATE_INPUT_YEAR_MAX) return null;
  const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return parseDateInputValue(ymd, options);
}

export function keepZonedTimeOnDate(dateMs: number, timeFromMs: number): number | null {
  return combineZonedDateAndTime(
    dateMs,
    getZonedParts(timeFromMs)?.hours ?? 0,
    getZonedParts(timeFromMs)?.minutes ?? 0,
    getZonedParts(timeFromMs)?.seconds ?? 0,
    getZonedParts(timeFromMs)?.milliseconds ?? 0,
  );
}
