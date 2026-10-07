import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface MiniJournalProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  name?: string
}