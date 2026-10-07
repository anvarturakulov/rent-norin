import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface TakingItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
}