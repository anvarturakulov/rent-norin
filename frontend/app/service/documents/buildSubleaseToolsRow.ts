import { DocTableItem } from '@/app/interfaces/document.interface';
import { getPereodicValueForDate } from '@/app/service/references/getPereodicValueForDate';
import { resolveToolHourlyTariff } from '@/app/service/documents/buildTransferToolsRow';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const resolvePartnerHourlyTariff = async (
  referenceId: number,
  documentDate: number,
  token: string | undefined,
  enterpriseId: number | null | undefined,
  fallbackSecondPrice?: number | null,
): Promise<number> => {
  const periodic = await getPereodicValueForDate(
    referenceId,
    'secondPrice',
    documentDate,
    token,
    enterpriseId ?? undefined,
  );
  if (Number(periodic) > 0) return Number(periodic);
  return Number(fallbackSecondPrice) || 0;
};

export const enrichSubleaseToolsRow = async (
  item: DocTableItem,
  documentDate: number,
  token: string | undefined,
  enterpriseId: number | null | undefined,
  fallbackFirstPrice?: number | null,
  fallbackSecondPrice?: number | null,
): Promise<DocTableItem> => {
  const [hourlyTariff, partnerHourlyTariff] = await Promise.all([
    resolveToolHourlyTariff(
      item.analiticId,
      documentDate,
      token,
      enterpriseId,
      fallbackFirstPrice ?? item.hourlyTariff,
    ),
    resolvePartnerHourlyTariff(
      item.analiticId,
      documentDate,
      token,
      enterpriseId,
      fallbackSecondPrice ?? item.partnerHourlyTariff,
    ),
  ]);
  const count = Number(item.count) || 0;

  return {
    ...item,
    costPrice: 0,
    costTotal: 0,
    price: 0,
    total: 0,
    balance: count,
    hourlyTariff,
    partnerHourlyTariff,
    dailyRent: round2(hourlyTariff * count * 24),
  };
};

export const recalcSubleaseToolsRowTotals = (
  item: DocTableItem,
  newCount: number,
): DocTableItem => {
  const count = Number(newCount) || 0;
  const hourlyTariff = Number(item.hourlyTariff) || 0;
  const partnerHourlyTariff = Number(item.partnerHourlyTariff) || 0;

  return {
    ...item,
    count,
    balance: count,
    costPrice: 0,
    costTotal: 0,
    price: 0,
    total: 0,
    hourlyTariff,
    partnerHourlyTariff,
    dailyRent: round2(hourlyTariff * count * 24),
  };
};
