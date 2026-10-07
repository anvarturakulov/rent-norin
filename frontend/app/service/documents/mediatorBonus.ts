import { DocumentModel } from '@/app/interfaces/document.interface';
import { RefValues } from '@/app/interfaces/reference.interface';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const sumReceiveRentNetIncome = (doc: DocumentModel | null | undefined): number =>
  (doc?.docTableItems ?? [])
    .filter((row) => (row.tableType || 'return') === 'return')
    .reduce((sum, row) => {
      const rentSum = Number(row.rentSum) || 0;
      const price = Number(row.price) || 0;
      return sum + Math.max(0, rentSum - price);
    }, 0);

export function resolvePartnerPercentFromSettings(
  settings: Record<string, number | undefined>,
  refValues?: RefValues | null,
): number {
  if (refValues?.isMediatorDriver && (settings.driverPercent ?? 0) > 0) {
    return settings.driverPercent!;
  }
  if (refValues?.isMediatorMaster && (settings.masterPercent ?? 0) > 0) {
    return settings.masterPercent!;
  }
  return settings.defaultPercent ?? 0;
}

export function computeMediatorBonusPreview(params: {
  costBase: number;
  percent: number;
  minAmount?: number;
}): { bonus: number; belowMin: boolean } {
  const { costBase, percent, minAmount = 0 } = params;
  if (costBase <= 0 || percent <= 0) {
    return { bonus: 0, belowMin: false };
  }
  const bonus = round2((costBase * percent) / 100);
  const belowMin = minAmount > 0 && bonus > 0 && bonus < minAmount;
  return { bonus: belowMin ? 0 : bonus, belowMin };
}
