import { APP_TIMEZONE } from "src/common/timezone";

export const DATE_BAN_EDITING_MESSAGE = "Хужжат санаси макул эмас";
const DATE_BAN_TZ = APP_TIMEZONE;

/** Календарная дата YYYY-MM-DD в часовом поясе Узбекистана. */
export function toCalendarDateKey(value: unknown): string | null {
  if (value == null || value === "" || value === false) {
    return null;
  }
  if (typeof value === "number" && (!Number.isFinite(value) || value <= 0)) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  let ms: number;
  if (typeof value === "number") {
    ms = value;
  } else if (value instanceof Date) {
    ms = value.getTime();
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    ms = Number(value);
  } else {
    ms = Date.parse(String(value));
  }

  if (!Number.isFinite(ms) || Number.isNaN(ms) || ms <= 0) {
    return null;
  }

  const key = new Date(ms).toLocaleDateString("en-CA", {
    timeZone: DATE_BAN_TZ,
  });
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/** Документ с датой до даты запрета включительно нельзя менять / проводить. */
export function isDocumentDateBanned(
  docDate: unknown,
  banValue: unknown,
): boolean {
  const banKey = toCalendarDateKey(banValue);
  const docKey = toCalendarDateKey(docDate);
  if (!banKey || !docKey) {
    return false;
  }
  return docKey <= banKey;
}
