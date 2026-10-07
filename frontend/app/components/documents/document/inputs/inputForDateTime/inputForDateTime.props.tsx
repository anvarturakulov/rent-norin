import { DetailedHTMLProps, InputHTMLAttributes } from 'react';

export type DateTimeInputId = 'date' | 'returnDateTime' | 'settlementDate';

export interface InputForDateTimeProps
  extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
  label: string;
  /** 'date' — Document.date; иначе — поле в docValues */
  id: DateTimeInputId;
}
