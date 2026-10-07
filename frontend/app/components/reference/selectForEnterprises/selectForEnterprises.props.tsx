import { DetailedHTMLProps, SelectHTMLAttributes } from "react";

export interface SelectForEnterprisesProps extends DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> {
    label: string,
    currentEnterpriseId: number | undefined | null,
    setEnterpriseId: (id: number | null) => void,
    isNewReference?: boolean
}

