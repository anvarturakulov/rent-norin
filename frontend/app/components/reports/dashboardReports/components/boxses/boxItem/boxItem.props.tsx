import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface BoxItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
}