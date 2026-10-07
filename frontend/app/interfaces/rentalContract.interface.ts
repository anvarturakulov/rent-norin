export enum RentalContractStatus {
    DRAFT = 'DRAFT',
    APPROVED = 'APPROVED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export interface RentalContract {
    id: number;
    enterpriseId?: number | null;
    contractNumber: string;
    clientId: number;
    contractDate: number;
    endDate?: number | null;
    status?: RentalContractStatus;
    comment?: string | null;
    client?: { id: number; name: string };
}

export interface SaveRentalContractPayload {
    enterpriseId?: number;
    contractNumber?: string;
    clientId: number;
    contractDate: number;
    endDate?: number | null;
    status?: RentalContractStatus;
    comment?: string | null;
}

export function formatRentalContractBasis(contract: RentalContract | null | undefined): string {
    if (!contract?.contractNumber) return '';
    const date = contract.contractDate
        ? new Date(Number(contract.contractDate)).toLocaleDateString('ru-RU')
        : '';
    return `Договор аренды № ${contract.contractNumber}${date ? ` от ${date}` : ''}`;
}

/** Печатная форма передачи ускуналар: «08.06.2026 санадаги № 5 сонли … шартнома» */
export function formatRentalContractBasisUz(contract: RentalContract | null | undefined): string {
    if (!contract?.contractNumber) return '';
    const date = contract.contractDate
        ? new Date(Number(contract.contractDate)).toLocaleDateString('ru-RU')
        : '';
    const datePart = date ? `${date} санадаги ` : '';
    return `${datePart}№ ${contract.contractNumber} сонли ускуналарни ижарага бериш тугрисидаги шартнома`;
}
