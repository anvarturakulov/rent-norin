import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface SkladItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  key: number,
}