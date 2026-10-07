import {
  DocTableItem,
  getBrakItems,
  getReturnItems,
  getSaleItems,
  getTovarItems,
  ReceiveToolsPreviewRow,
} from '@/app/interfaces/document.interface';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Минимальное время аренды при возврате инструментов (сутки). */
export const MIN_RENT_HOURS = 24;

export function clampRentHours(hours: number): number {
  return round2(Math.max(MIN_RENT_HOURS, hours));
}

export function getReceiveToolsReturnDateTime(document: {
  date?: number;
  docValues?: { returnDateTime?: number };
}): number {
  return (
    Number(document?.docValues?.returnDateTime) ||
    Number(document?.date) ||
    0
  );
}

export function getHoursFromSettlement(
  item: DocTableItem,
  returnDateTime: number,
): number | null {
  const settlementDate = Number(item.settlementDate) || 0;
  if (settlementDate > 0 && returnDateTime > 0) {
    return clampRentHours((returnDateTime - settlementDate) / 3_600_000);
  }
  return null;
}

export function getReceiveToolsRentHours(
  item: DocTableItem,
  returnDateTime: number,
): number | null {
  if (item.rentHours != null && item.rentHours !== undefined && !Number.isNaN(Number(item.rentHours))) {
    return clampRentHours(Number(item.rentHours));
  }

  const fromDates = getHoursFromSettlement(item, returnDateTime);
  if (fromDates !== null) {
    return fromDates;
  }

  const hourlyTariff = Number(item.hourlyTariff) || 0;
  const count = Number(item.count) || 0;
  const rentSum = Number(item.rentSum) || 0;
  if (hourlyTariff > 0 && count > 0) {
    return clampRentHours(rentSum / (hourlyTariff * count));
  }

  return null;
}

export function recalcReceiveToolsReturnRow(
  item: DocTableItem,
  returnDateTime?: number,
): DocTableItem {
  const hours = clampRentHours(
    item.rentHours != null && item.rentHours !== undefined
      ? Number(item.rentHours) || 0
      : returnDateTime
        ? getHoursFromSettlement(item, returnDateTime) ?? 0
        : 0,
  );

  const count = Number(item.count) || 0;
  const tariff = Number(item.hourlyTariff) || 0;
  const partnerTariff = Number(item.partnerHourlyTariff) || 0;
  const price = Number(item.price) || 0;
  const costPrice = Number(item.costPrice) || 0;
  const rentSum = round2(hours * tariff * count);
  const partnerRentSum = round2(hours * partnerTariff * count);
  const total = round2(rentSum - price);
  const costTotal = round2(costPrice * count);

  return {
    ...item,
    rentHours: hours,
    rentSum,
    partnerRentSum,
    total,
    costTotal,
  };
}

export function buildReceiveToolsReturnRow(
  source: DocTableItem | ReceiveToolsPreviewRow,
  count: number,
  returnDateTime: number,
  options?: { preservePrice?: number },
): DocTableItem {
  const settlementDate = Number(source.settlementDate) || 0;
  const hours =
    getHoursFromSettlement({ settlementDate } as DocTableItem, returnDateTime) ??
    getReceiveToolsRentHours(
      { ...source, settlementDate, count } as DocTableItem,
      returnDateTime,
    ) ??
    0;

  const costPrice = Number(source.costPrice) || 0;

  return recalcReceiveToolsReturnRow(
    {
      analiticId: source.analiticId,
      count,
      price: options?.preservePrice ?? 0,
      total: 0,
      costPrice,
      costTotal: round2(costPrice * count),
      balance: 0,
      hourlyTariff: Number(source.hourlyTariff) || 0,
      partnerHourlyTariff: Number((source as any).partnerHourlyTariff) || 0,
      rentHours: hours,
      settlementDate,
      sourceTransferDocId: source.sourceTransferDocId,
      tableType: 'return',
    },
    returnDateTime,
  );
}

export function normalizeReceiveToolsReturnRow(
  item: DocTableItem,
  returnDateTime: number,
): DocTableItem {
  return buildReceiveToolsReturnRow(item, Number(item.count) || 0, returnDateTime);
}

export function recalcReceiveToolsReturnTable(
  docTableItems: DocTableItem[] | undefined,
  returnDateTime: number,
): DocTableItem[] {
  if (!docTableItems?.length) {
    return docTableItems || [];
  }

  const recalcedReturn = getReturnItems(docTableItems).map((item) =>
    buildReceiveToolsReturnRow(item, Number(item.count) || 0, returnDateTime, {
      preservePrice: Number(item.price) || 0,
    }),
  );

  return [
    ...recalcedReturn,
    ...getBrakItems(docTableItems),
    ...getSaleItems(docTableItems),
    ...getTovarItems(docTableItems),
  ];
}

export function formatRentHours(hours: number | null): string {
  if (hours === null) return '—';
  return hours.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export const isReceiveToolsReturnRow = (item: DocTableItem): boolean =>
  item.tableType === 'return' || !item.tableType;
