export interface TransferToolsPreviewRow {
  analiticId: number;
  count: number;
  balance: number;
  costPrice: number;
  costTotal: number;
  price: number;
  total: number;
  /** Часовой тариф аренды (периодика firstPrice или thirdPrice по типу тарифа). */
  hourlyTariff: number;
}
