import { DetailedHTMLProps, InputHTMLAttributes } from "react";

export interface InputForDatePereodicProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    label: string,
    id: string,
}
