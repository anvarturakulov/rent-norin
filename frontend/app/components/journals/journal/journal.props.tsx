import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface JournalProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  user?: string
}