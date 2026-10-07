import { DetailedHTMLProps, HTMLAttributes } from "react";
import { SectionType } from '../../../inform.props';

export interface SectionItemProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  item: any,
  sectionType: SectionType,
}