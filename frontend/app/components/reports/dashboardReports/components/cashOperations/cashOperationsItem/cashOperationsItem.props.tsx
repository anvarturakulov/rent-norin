import { DetailedHTMLProps, HTMLAttributes } from "react";
import { SectionType } from '../../../inform.props';

export interface CashOperationsItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  references: any
}