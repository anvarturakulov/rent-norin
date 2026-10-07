import { DetailedHTMLProps, InputHTMLAttributes } from "react";
export type ValuesToJournalCheckboxs = 'charges' | 'workers' | 'mediators' | 'deliverers' | 'partners' | 'clients' | 'order' | 'departments' | 'pendingApproval'

export interface CheckBoxInFooterProps extends DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    id: ValuesToJournalCheckboxs,
    label: string,
}
