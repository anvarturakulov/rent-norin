import { DocTableItem } from '@/app/interfaces/document.interface';
import { getPereodicValueForDate } from '@/app/service/references/getPereodicValueForDate';
import {
  getRentTariffPriceName,
  ToolHourlyTariffPriceName,
} from '@/app/service/documents/rentTariffType';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Periodic firstPrice/thirdPrice on date, else fallback. */
export const resolveToolHourlyTariff = async (
  referenceId: number,
  documentDate: number,
  token: string | undefined,
  enterpriseId: number | null | undefined,
  fallbackPrice?: number | null,
  priceName: ToolHourlyTariffPriceName = 'firstPrice',
): Promise<number> => {
  const periodic = await getPereodicValueForDate(
    referenceId,
    priceName,
    documentDate,
    token,
    enterpriseId ?? undefined,
  );
  if (Number(periodic) > 0) return Number(periodic);
  return Number(fallbackPrice) || 0;
};

export const buildTransferToolsRow = (params: {
  analiticId: number;
  count: number;
  costPrice: number;
  hourlyTariff: number;
  balance?: number;
}): DocTableItem => {
  const count = Number(params.count) || 0;
  const costPrice = Number(params.costPrice) || 0;
  const costTotal = round2(costPrice * count);
  const hourlyTariff = Number(params.hourlyTariff) || 0;

  return {
    analiticId: params.analiticId,
    balance: params.balance ?? 0,
    count,
    price: costPrice,
    total: costTotal,
    costPrice,
    costTotal,
    hourlyTariff,
    dailyRent: round2(hourlyTariff * count * 24),
  };
};

/** Enrich row with hourly tariff — periodic by rentTariffType, else fallback. */
export const enrichTransferToolsRow = async (
  item: DocTableItem,
  documentDate: number,
  token: string | undefined,
  enterpriseId: number | null | undefined,
  fallbackPrice?: number | null,
  rentTariffType?: string | null,
): Promise<DocTableItem> => {
  const priceName = getRentTariffPriceName(rentTariffType);
  const hourlyTariff = await resolveToolHourlyTariff(
    item.analiticId,
    documentDate,
    token,
    enterpriseId,
    fallbackPrice,
    priceName,
  );
  const count = Number(item.count) || 0;
  const costPrice = Number(item.costPrice) || 0;
  const costTotal = round2(costPrice * count);

  return {
    ...item,
    costPrice,
    costTotal,
    hourlyTariff,
    dailyRent: round2(hourlyTariff * count * 24),
    total: costTotal,
    price: costPrice,
  };
};

export const recalcTransferToolsRowTotals = (
  item: DocTableItem,
  newCount: number,
): DocTableItem => {
  const count = Number(newCount) || 0;
  const costPrice = Number(item.costPrice) || 0;
  const hourlyTariff = Number(item.hourlyTariff) || 0;
  const costTotal = round2(costPrice * count);

  return {
    ...item,
    count,
    costPrice,
    costTotal,
    price: costPrice,
    total: costTotal,
    hourlyTariff,
    dailyRent: round2(hourlyTariff * count * 24),
  };
};

export const recalcTransferToolsTableTariffs = async (
  items: DocTableItem[] | undefined,
  documentDate: number,
  token: string | undefined,
  enterpriseId: number | null | undefined,
  rentTariffType?: string | null,
): Promise<DocTableItem[]> => {
  if (!items?.length) {
    return items || [];
  }

  return Promise.all(
    items.map((item) => {
      if (
        item.tableType === 'sale' ||
        item.tableType === 'tovar' ||
        !item.analiticId ||
        Number(item.analiticId) <= 0
      ) {
        return item;
      }
      return enrichTransferToolsRow(
        item,
        documentDate,
        token,
        enterpriseId,
        undefined,
        rentTariffType,
      );
    }),
  );
};
