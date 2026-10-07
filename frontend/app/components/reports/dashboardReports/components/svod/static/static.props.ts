import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface StaticProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
}