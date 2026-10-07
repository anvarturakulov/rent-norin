import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface TmcMaterialNormsProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
  currentSection?: string
}

