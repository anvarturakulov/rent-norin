import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface FooterProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  windowFor: 'document' | 'reference' | 'order' | 'gate',
  count?: number,
  total?: number,
  totalSecond?: number,
  totalCost?: number,
  docCount?: number,
  label?: string
}