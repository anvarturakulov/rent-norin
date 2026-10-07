import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface TakingProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
  currentSection?: string
}