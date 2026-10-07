import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface CostItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  index: number
}