import { DetailedHTMLProps, InputHTMLAttributes } from "react";

export interface InputForDateProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    label: string,
    id: string,
}
