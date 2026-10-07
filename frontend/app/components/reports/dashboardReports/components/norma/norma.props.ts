import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface NormaProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
  currentSection?: string
}