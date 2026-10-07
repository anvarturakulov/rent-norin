import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface NormaItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any
}