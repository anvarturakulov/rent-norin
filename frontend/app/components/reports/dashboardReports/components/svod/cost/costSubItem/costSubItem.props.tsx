import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface CostSubItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  index: number
}