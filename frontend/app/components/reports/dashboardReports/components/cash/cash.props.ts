import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface CashProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
}