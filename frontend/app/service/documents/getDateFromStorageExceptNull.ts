import { formatDateForInput } from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';

export const getDateFromStorageExceptNull = (date: string | null | undefined): string => {
  if (date != null && date !== '') {
    const asNumber = Number(date);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return formatDateForInput(asNumber);
    }
    const parsed = Date.parse(String(date));
    if (!Number.isNaN(parsed)) {
      return formatDateForInput(parsed);
    }
  }
  return formatDateForInput(nowMs());
};
