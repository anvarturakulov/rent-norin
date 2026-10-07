import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface PartnersItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  index: number
}