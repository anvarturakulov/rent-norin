import { DetailedHTMLProps, InputHTMLAttributes } from "react";

export interface InputForTimeProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    label: string,
}
