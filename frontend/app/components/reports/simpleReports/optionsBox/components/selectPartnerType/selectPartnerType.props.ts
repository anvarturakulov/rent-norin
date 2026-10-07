import { DetailedHTMLProps, SelectHTMLAttributes } from 'react';

export interface SelectPartnerTypeProps extends DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> {
    visible?: boolean;
}
