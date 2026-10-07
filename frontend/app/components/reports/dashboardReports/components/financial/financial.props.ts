import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface FinancialProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
}