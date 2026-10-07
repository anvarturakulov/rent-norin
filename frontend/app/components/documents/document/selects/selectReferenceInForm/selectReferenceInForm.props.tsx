import { TypeReference } from '@/app/interfaces/reference.interface';
import { DetailedHTMLProps, SelectHTMLAttributes } from "react";

export type TypeForSelectInForm = 'sender' | 'receiver' | 'analitic' | 'firstWorker' | 'secondWorker' | 'thirdWorker' | 'productForCharge' | 'car' | 'senderPerson' | 'materialResponsiblePerson' | 'mediator'

export interface SelectReferenceInFormProps extends DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> {
    label: string,
    typeReference: TypeReference,
    visibile?: boolean,
    currentItemId: number | undefined | null,
    type: TypeForSelectInForm,
    definedItemId?: number,
    maydaSavdo?: boolean
}