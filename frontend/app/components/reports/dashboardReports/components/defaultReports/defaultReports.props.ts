import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface DefaultReprtsProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  reportType?: string;
}