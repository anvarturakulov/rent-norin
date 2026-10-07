import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface MatOborotItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  section: string,
}