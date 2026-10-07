import { getDateBanEditingValue, toCalendarDateKey } from "./dateBanEditing";

/** @deprecated Используйте getDateBanEditingValue + isDocumentDateBanned. Оставлено для совместимости. */
export const getDateBanEditingInNumber = async (
  token: string | undefined,
  _enterpriseId?: number | null,
) => {
  const setting = await getDateBanEditingValue(token);
  const key = toCalendarDateKey(setting);
  if (!key) {
    return 0;
  }
  const milliseconds = Date.parse(`${key}T23:59:59.999+05:00`);
  return Number.isNaN(milliseconds) ? 0 : milliseconds;
};
