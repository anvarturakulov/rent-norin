import { DetailedHTMLProps, SelectHTMLAttributes } from 'react';

export interface SelectMatOborotTypeProps
  extends DetailedHTMLProps<
    SelectHTMLAttributes<HTMLSelectElement>,
    HTMLSelectElement
  > {
  label: string;
  visible: boolean;
}
