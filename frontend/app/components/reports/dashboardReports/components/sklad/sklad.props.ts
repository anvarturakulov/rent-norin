import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface SkladProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any,
  currentSection?: string
}