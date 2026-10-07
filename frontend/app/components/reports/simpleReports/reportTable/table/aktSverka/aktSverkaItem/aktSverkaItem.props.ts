import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface AktSverkaItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  references: any
}