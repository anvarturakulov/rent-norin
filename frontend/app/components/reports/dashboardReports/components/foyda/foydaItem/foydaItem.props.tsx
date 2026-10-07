import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface FoydaItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
}