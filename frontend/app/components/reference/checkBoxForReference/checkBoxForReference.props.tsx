import { DetailedHTMLProps, InputHTMLAttributes } from "react";

export interface checkBoxForReferenceProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    checked: boolean | undefined,
    label: string,
    setCheckbox: Function,
    id: string
}
