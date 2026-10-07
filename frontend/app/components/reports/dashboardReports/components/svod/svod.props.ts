import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface SvodProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
}