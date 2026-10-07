import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface InfoProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    label: string,
    content: string
}
