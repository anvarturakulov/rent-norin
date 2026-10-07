import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface ZpItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  currentId: string | undefined,
  data: any,
  hamirs: any,
  title: string,
}