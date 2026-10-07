import { DetailedHTMLProps, InputHTMLAttributes } from "react";
import { DocTableItem } from '@/app/interfaces/document.interface';

export interface InputInTableProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    nameControl: keyof DocTableItem,
    itemIndexInTable: number,
}