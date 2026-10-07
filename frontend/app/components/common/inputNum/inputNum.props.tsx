import { DetailedHTMLProps, InputHTMLAttributes } from "react";

export interface InputNumProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    label: string,
    visible?: boolean,
    maximumFractionDigits?: number,
}