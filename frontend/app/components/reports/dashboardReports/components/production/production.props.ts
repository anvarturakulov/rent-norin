import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface ProductionProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
  currentSection?: string
}