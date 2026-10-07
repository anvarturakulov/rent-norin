import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface CostProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
}