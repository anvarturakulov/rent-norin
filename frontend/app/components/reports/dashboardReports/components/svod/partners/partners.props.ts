import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface PartnersProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
  dataType: 'clients' | 'departments' | 'suppliers';
}