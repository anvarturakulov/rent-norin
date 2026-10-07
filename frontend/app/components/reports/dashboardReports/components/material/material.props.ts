import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface MaterialProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any
}