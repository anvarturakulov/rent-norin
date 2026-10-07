import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface GivingProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
  currentSection?: string
}