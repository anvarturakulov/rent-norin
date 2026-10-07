import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface OborotkaItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
}