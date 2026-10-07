import { DetailedHTMLProps, InputHTMLAttributes } from "react";
export type CheckboxIdTypes = 'partner' | 'client' | 'worker' | 'mediator' | 'deliverer' | 'founder' | 'proveden' | 'cash' | 'orderWithDeleviry' | 'department'

export interface checkBoxInFormProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    id: CheckboxIdTypes,
    label: string,
}
