import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface ZpProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
  currentSection?: string
}