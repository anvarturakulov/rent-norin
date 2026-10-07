import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface CashItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
}