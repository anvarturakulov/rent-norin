import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { DetailedHTMLProps, SelectHTMLAttributes } from "react";


export interface SelectForReferencesProps extends DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> {
    label: string,
    type: 'parent' | 'clientOwner',
    referenceId: number | undefined | null,
    typeReference: TypeReference,
    currentItemId: number | undefined | null,
    setClientForSectionId: (id: number | null, selectedFolder?: ReferenceModel | null) => void,
    isNewReference?: boolean
}