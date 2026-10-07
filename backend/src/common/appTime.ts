import { APP_TIMEZONE } from "./timezone";

export { APP_TIMEZONE };

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

const zonedPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function readPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const found = parts.find((part) => part.type === type);
  return found ? Number(found.value) : NaN;
}

export function getZonedParts(ms: number): ZonedDateTimeParts | null {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const parts = zonedPartsFormatter.formatToParts(date);
  let hours = readPart(parts, "hour");
  if (hours === 24) hours = 0;
  const milliseconds = ((ms % 1000) + 1000) % 1000;
  const result: ZonedDateTimeParts = {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
    hours,
    minutes: readPart(parts, "minute"),
    seconds: readPart(parts, "second"),
    milliseconds,
  };
  if (
    !Number.isInteger(result.year) ||
    !Number.isInteger(result.month) ||
    !Number.isInteger(result.day)
  ) {
    return null;
  }
  return result;
}

function getTimeZoneOffsetMs(utcMs: number): number {
  const parts = getZonedParts(utcMs);
  if (!parts) return 0;
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    parts.seconds,
    parts.milliseconds,
  );
  return asUtc - utcMs;
}

export function zonedDateTimeToMs(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
): number {
  const utcGuess = Date.UTC(
    year,
    month - 1,
    day,
    hours,
    minutes,
    seconds,
    milliseconds,
  );
  let result = utcGuess - getTimeZoneOffsetMs(utcGuess);
  result = utcGuess - getTimeZoneOffsetMs(result);
  return result;
}

export function isValidZonedYmd(
  year: number,
  month: number,
  day: number,
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const noon = zonedDateTimeToMs(year, month, day, 12, 0, 0, 0);
  const parts = getZonedParts(noon);
  return Boolean(
    parts && parts.year === year && parts.month === month && parts.day === day,
  );
}

export function formatZonedYmd(ms: number): string {
  const parts = getZonedParts(ms);
  if (!parts) return "";
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function combineZonedDateAndTime(
  dateMs: number,
  hours: number,
  minutes: number,
  seconds = 0,
  milliseconds = 0,
): number | null {
  const parts = getZonedParts(dateMs);
  if (!parts) return null;
  if (!isValidZonedYmd(parts.year, parts.month, parts.day)) return null;
  return zonedDateTimeToMs(
    parts.year,
    parts.month,
    parts.day,
    hours,
    minutes,
    seconds,
    milliseconds,
  );
}
