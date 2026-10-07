export interface SubleaseReceivePreviewRow {
  analiticId: number;
  count: number;
  price: number;
  total: number;
  balance: number;
  hourlyTariff: number;
  partnerHourlyTariff: number;
  rentSum: number;
  partnerRentSum: number;
  sourceTransferDocId: number;
  settlementDate: number;
  transferDocNumber: string;
  partnerId: number;
  partnerStorageId: number;
  tableType: "return";
}
