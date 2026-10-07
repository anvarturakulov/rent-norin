import { DetailedHTMLProps, InputHTMLAttributes } from "react";
import { DocTableItem } from '@/app/interfaces/document.interface';

export interface InputInTableForNumbersProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    nameControl: keyof DocTableItem,
    itemIndexInTable: number,
    disabled?: boolean,
}