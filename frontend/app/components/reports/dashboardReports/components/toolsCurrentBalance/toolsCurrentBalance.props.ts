import { DetailedHTMLProps, HTMLAttributes } from 'react';

export interface ToolsCurrentBalanceRow {
  toolId: number;
  toolName: string;
  article: string;
  warehouseQty: number;
  atClientQty: number;
  totalQty: number;
  warehouseSum: number;
}

export interface ToolsCurrentBalanceValues {
  balanceDate: number;
  warehouseId: number | null;
  warehouseName: string | null;
  rows: ToolsCurrentBalanceRow[];
  totals: {
    warehouseQty: number;
    atClientQty: number;
    totalQty: number;
    warehouseSum: number;
  };
}

export interface ToolsCurrentBalanceProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: unknown;
}
