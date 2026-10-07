import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface ClientItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  section: string,
}