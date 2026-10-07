import { nowMs } from '@/app/utils/serverNow';
import {
  endOfZonedDay,
  getZonedParts,
  startOfZonedDay,
  zonedDateTimeToMs,
  zonedYmdToEndMs,
} from '@/app/utils/appTime';

export interface MonthRange {
  start: number;
  end: number;
}

export const getMonthStartToCurrentDayRange = (): MonthRange => {
  const parts = getZonedParts(nowMs());
  if (!parts) {
    const fallback = Date.now();
    return { start: fallback, end: fallback };
  }

  const start = zonedDateTimeToMs(parts.year, parts.month, 1, 0, 0, 0, 0);
  const end = zonedYmdToEndMs(parts.year, parts.month, parts.day) ?? nowMs();

  return { start, end };
};

export const getTodayRange = (): MonthRange => {
  const now = nowMs();
  const start = startOfZonedDay(now) ?? now;
  const end = endOfZonedDay(now) ?? now;
  return { start, end };
};
