import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface PersonalItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
}