import { NameControl } from '@/app/interfaces/document.interface';
import { DetailedHTMLProps, InputHTMLAttributes } from "react";

export interface InputInFormProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    label: string,
    visible?: boolean,
    nameControl: NameControl,
    isNewDocument?: boolean,
    labelPosition?: 'left' | 'top'
}
