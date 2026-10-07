import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface ProductionItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any
}