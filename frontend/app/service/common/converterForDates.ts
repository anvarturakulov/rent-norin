import { formatDateForInput } from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';

export const dateNumberToString = (dateInNumber: number): string => {
  const ms = dateInNumber > 0 ? dateInNumber : nowMs();
  return formatDateForInput(ms);
};
