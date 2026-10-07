import { TypeReference, TypePartners, TypeSECTION, TypeTMZ } from '@/app/interfaces/reference.interface';
import { DetailedHTMLProps, SelectHTMLAttributes } from "react";

export interface SelectReferenceInTableProps extends Omit<DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>, 'onChange'> {
    typeReference: TypeReference,
    itemIndexInTable: number,
    currentItemId: number | undefined,
    selectForReciever?: boolean,
    typePartners?: TypePartners,
    typeSection?: TypeSECTION,
    /** Фильтр TMZ; по умолчанию MATERIAL */
    typeTMZ?: TypeTMZ,
    matchLinkedEnterprise?: boolean,
    fieldName?: 'analiticId',
    onChange?: (value: number | undefined) => void,
    noMargin?: boolean,
}