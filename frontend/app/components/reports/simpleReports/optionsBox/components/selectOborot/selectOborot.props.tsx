import { DetailedHTMLProps, SelectHTMLAttributes } from "react";

export interface SelectOborotProps extends DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> {
    label: string,
    visible: boolean,
}