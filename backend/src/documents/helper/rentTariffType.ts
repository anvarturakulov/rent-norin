import { RentTariffType } from "src/interfaces/document.interface";

export type ToolHourlyTariffPriceName = "firstPrice" | "thirdPrice";

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
    ? "thirdPrice"
    : "firstPrice";
