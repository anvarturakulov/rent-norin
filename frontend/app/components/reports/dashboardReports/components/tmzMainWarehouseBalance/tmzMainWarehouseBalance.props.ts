import { DetailedHTMLProps, HTMLAttributes } from 'react';

export interface TmzMainWarehouseBalanceProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
}

export interface TmzBalanceEntry {
  qty: number;
  sum: number;
  schet: string;
}

export interface TmzBalanceReportValues {
  warehouseId: number | null;
  warehouseName: string;
  balanceDate: number;
  balances: Record<string, TmzBalanceEntry>;
}
