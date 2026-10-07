/**
 * HTML datetime-local value YYYY-MM-DDTHH:mm ↔ timestamp in Asia/Tashkent.
 */

import {
  DATE_INPUT_MAX,
  DATE_INPUT_MIN,
  DATE_INPUT_YEAR_MAX,
  DATE_INPUT_YEAR_MIN,
  formatDateForInput,
  parseDateInputValue,
} from '@/app/utils/dateInput';
import {
  combineZonedDateAndTime,
  getZonedParts,
} from '@/app/utils/appTime';

export { DATE_INPUT_MIN, DATE_INPUT_MAX };

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
/** Strict display / stored form: HH:mm */
export const TIME_INPUT_PATTERN = /^\d{2}:\d{2}$/;
/** Complete enough to commit while typing (not bare hour digits alone). */
const TIME_INPUT_COMPLETE_PATTERN = /^\d{1,2}:\d{2}$|^\d{3,4}$/;

export function formatTimeParts(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatTimeForInput(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const parts = getZonedParts(ms);
  if (!parts) return '';
  return formatTimeParts(parts.hours, parts.minutes);
}

function isValidTimeParts(hours: number, minutes: number): boolean {
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
}

/**
 * Parses flexible time entry:
 * - "07:00" / "7:00"
 * - "0700" → 07:00
 * - "700" → 07:00
 * - "7" / "07" → 07:00 (intended for blur normalization)
 */
export function parseTimeInputValue(
  value: string,
): { hours: number; minutes: number } | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, '');
  if (!trimmed) return null;

  let hours: number;
  let minutes: number;

  if (/^\d{1,2}:\d{1,2}$/.test(trimmed)) {
    const [hoursStr, minutesStr] = trimmed.split(':');
    hours = Number(hoursStr);
    minutes = Number(minutesStr);
  } else if (/^\d{4}$/.test(trimmed)) {
    hours = Number(trimmed.slice(0, 2));
    minutes = Number(trimmed.slice(2, 4));
  } else if (/^\d{3}$/.test(trimmed)) {
    hours = Number(trimmed.slice(0, 1));
    minutes = Number(trimmed.slice(1, 3));
  } else if (/^\d{1,2}$/.test(trimmed)) {
    hours = Number(trimmed);
    minutes = 0;
  } else {
    return null;
  }

  if (!isValidTimeParts(hours, minutes)) return null;
  return { hours, minutes };
}

/** True when value is complete enough to commit on change (not bare "7" while typing). */
export function isCompleteTimeInputValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim().replace(/\s+/g, '');
  return TIME_INPUT_COMPLETE_PATTERN.test(trimmed);
}

export function combineDateAndTime(
  dateMs: number,
  hours: number,
  minutes: number,
): number {
  const t = combineZonedDateAndTime(dateMs, hours, minutes, 0, 0);
  return t != null && Number.isFinite(t) ? t : NaN;
}

export function parseDateTimeInputValue(value: string): number | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!DATETIME_LOCAL_PATTERN.test(trimmed)) return null;

  const [datePart, timePart] = trimmed.split('T');
  const dateMs = parseDateInputValue(datePart);
  if (dateMs === null) return null;

  const [hoursStr, minutesStr] = timePart.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const t = combineZonedDateAndTime(dateMs, hours, minutes, 0, 0);
  return t != null && Number.isFinite(t) ? t : null;
}

export function formatDateTimeForInput(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const parts = getZonedParts(ms);
  if (!parts) return '';

  if (parts.year < DATE_INPUT_YEAR_MIN || parts.year > DATE_INPUT_YEAR_MAX) {
    return formatDateForInput(ms);
  }

  const datePart = formatDateForInput(ms);
  return `${datePart}T${formatTimeParts(parts.hours, parts.minutes)}`;
}
