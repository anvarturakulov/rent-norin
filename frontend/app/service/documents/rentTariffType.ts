import { RentTariffType } from '@/app/interfaces/document.interface';

export type ToolHourlyTariffPriceName = 'firstPrice' | 'thirdPrice';

export const normalizeRentTariffType = (
  value?: string | null,
): RentTariffType =>
  value === RentTariffType.TRANSFER
    ? RentTariffType.TRANSFER
    : RentTariffType.CASH;

export const getRentTariffPriceName = (
  value?: string | null,
): ToolHourlyTariffPriceName =>
  normalizeRentTariffType(value) === RentTariffType.TRANSFER
    ? 'thirdPrice'
    : 'firstPrice';

export const getRentTariffFallbackFromRefValues = (
  refValues: { firstPrice?: number | null; thirdPrice?: number | null } | null | undefined,
  rentTariffType?: string | null,
): number => {
  const priceName = getRentTariffPriceName(rentTariffType);
  return Number(refValues?.[priceName]) || 0;
};

export const getRentTariffTypeLabel = (value?: string | null): string =>
  normalizeRentTariffType(value) === RentTariffType.TRANSFER
    ? 'Перечисление'
    : 'Нақд / физ.шахс';
