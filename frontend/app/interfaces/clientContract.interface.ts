import type { FurnitureOrder } from '@/app/interfaces/furnitureOrder.interface';
import { DocumentType, type DocSTATUS } from '@/app/interfaces/document.interface';

export enum ClientContractStatus {
    DRAFT = 'DRAFT',
    APPROVED = 'APPROVED',
    PRODUCTION = 'PRODUCTION',
    COMPLETED = 'COMPLETED',
}

export enum ClientContractItemKind {
    TOVAR = 'TOVAR',
    MATERIAL = 'MATERIAL',
    HALFSTUFF = 'HALFSTUFF',
    PRODUCT = 'PRODUCT',
    SERVICE = 'SERVICE',
}

export interface ClientContractSaleDoc {
    id: number;
    date?: number;
    documentType?: DocumentType | string;
    docStatus?: DocSTATUS | string;
    docValues?: { comment?: string; total?: number; analiticId?: number };
}

export interface ClientContractExpenseLine {
    id?: number;
    contractId?: number;
    expenseName: string;
    amount: number;
}

export interface ClientContractOrderLine {
    id?: number;
    contractId?: number;
    furnitureOrderId: number;
    orderPrice: number;
    additionalExpenses: number;
    count?: number;
    /** Устаревшее имя поля в JSON, если бэкенд отдал атрибут Sequelize `qty`. */
    qty?: number;
    saleDocId?: number | null;
    furnitureOrder?: FurnitureOrder;
    saleDoc?: ClientContractSaleDoc | null;
}

export interface ClientContractItemLine {
    id?: number;
    contractId?: number;
    lineKind: ClientContractItemKind;
    analiticId: number;
    count: number;
    price: number;
    total: number;
    saleDocId?: number | null;
    analitic?: { id: number; name: string };
    saleDoc?: ClientContractSaleDoc | null;
}

export interface ClientContract {
    id: number;
    enterpriseId?: number | null;
    contractNumber: string;
    clientId: number;
    contractDate: number;
    status?: ClientContractStatus;
    client?: { id: number; name: string };
    orderLines?: ClientContractOrderLine[];
    itemLines?: ClientContractItemLine[];
    expenseLines?: ClientContractExpenseLine[];
}

export interface SaveClientContractPayload {
    enterpriseId?: number;
    contractNumber?: string;
    clientId: number;
    contractDate: number;
    status?: ClientContractStatus;
    orderLines: {
        furnitureOrderId: number;
        orderPrice: number;
        count?: number;
        saleDocId?: number | null;
    }[];
    itemLines: {
        id?: number;
        lineKind: ClientContractItemKind;
        analiticId: number;
        count: number;
        price: number;
        total?: number;
        saleDocId?: number | null;
    }[];
}

export interface ContractSaleCandidate {
    id: number;
    date: number;
    documentType: string;
    docStatus: string;
    comment: string;
    total: number;
    analiticId: number;
    items: { analiticId: number; count: number; total: number }[];
}

export const TMC_ITEM_KINDS: ClientContractItemKind[] = [
    ClientContractItemKind.TOVAR,
    ClientContractItemKind.MATERIAL,
    ClientContractItemKind.HALFSTUFF,
    ClientContractItemKind.PRODUCT,
];

export function documentTypeForItemKind(kind: ClientContractItemKind): DocumentType {
    switch (kind) {
        case ClientContractItemKind.TOVAR:
            return DocumentType.SaleTovar;
        case ClientContractItemKind.MATERIAL:
            return DocumentType.SaleMaterial;
        case ClientContractItemKind.HALFSTUFF:
            return DocumentType.SaleHalfStuff;
        case ClientContractItemKind.PRODUCT:
            return DocumentType.SaleProd;
        case ClientContractItemKind.SERVICE:
            return DocumentType.ServicesToClients;
    }
}

export function itemKindLabel(kind: ClientContractItemKind): string {
    switch (kind) {
        case ClientContractItemKind.TOVAR:
            return 'Товар';
        case ClientContractItemKind.MATERIAL:
            return 'Материал';
        case ClientContractItemKind.HALFSTUFF:
            return 'Ярим тайёр';
        case ClientContractItemKind.PRODUCT:
            return 'Тайёр маҳсулот';
        case ClientContractItemKind.SERVICE:
            return 'Хизмат';
    }
}

export function displayContractStatus(s: ClientContractStatus): string {
    switch (s) {
        case ClientContractStatus.DRAFT:
            return 'Қоралама';
        case ClientContractStatus.APPROVED:
        case ClientContractStatus.PRODUCTION:
            return 'Тасдиқланган';
        case ClientContractStatus.COMPLETED:
            return 'Якунланган';
        default:
            return s;
    }
}

export function normalizeContractStatus(
    s: ClientContractStatus | string | undefined | null,
): ClientContractStatus {
    if (s === ClientContractStatus.PRODUCTION) return ClientContractStatus.APPROVED;
    if (
        s === ClientContractStatus.DRAFT ||
        s === ClientContractStatus.APPROVED ||
        s === ClientContractStatus.COMPLETED
    ) {
        return s;
    }
    return ClientContractStatus.DRAFT;
}

export type FurnitureOrderQtyPrice = {
    count?: number | null;
    price?: number | null;
    total?: number | null;
};

export type ContractOrderLineQtyPrice = {
    count?: number | null;
    qty?: number | null;
    orderPrice?: number | null;
    furnitureOrder?: FurnitureOrderQtyPrice | null;
};

/** Количество, цена и сумма из заказа; если заказа нет — запас из строки договора. */
export function qtyPriceFromFurnitureOrder(
    order?: FurnitureOrderQtyPrice | null,
    fallback?: ContractOrderLineQtyPrice,
): { count: number; orderPrice: number; amount: number } {
    const countFromOrder = Number(order?.count);
    const storedCount = Number(fallback?.count ?? fallback?.qty);
    const count =
        countFromOrder > 0 ? countFromOrder : storedCount > 0 ? storedCount : 1;
    const total = Number(order?.total) || 0;
    let price = Number(order?.price) || 0;
    if (total > 0 && count > 0) {
        price = total / count;
    }
    if (!(price > 0)) {
        price = Number(fallback?.orderPrice) || 0;
    }
    const amount = total > 0 ? total : count * price;
    return { count, orderPrice: price, amount };
}

export function contractOrderLineFromOrder(line: ContractOrderLineQtyPrice): {
    count: number;
    orderPrice: number;
    amount: number;
} {
    return qtyPriceFromFurnitureOrder(line.furnitureOrder, line);
}

export function contractOrderLineCount(line: ContractOrderLineQtyPrice): number {
    return contractOrderLineFromOrder(line).count;
}

export function contractOrderLineAmount(line: ContractOrderLineQtyPrice): number {
    return contractOrderLineFromOrder(line).amount;
}

export function formatContractSaleLabel(doc?: ClientContractSaleDoc | null, saleDocId?: number | null): string {
    const id = doc?.id ?? saleDocId;
    if (!id) return '';
    const date = doc?.date
        ? new Date(Number(doc.date)).toLocaleDateString('ru-RU')
        : '';
    return date ? `#${id} · ${date}` : `#${id}`;
}

export function isContractLineFulfilled(
    saleDocId?: number | null,
    saleDoc?: ClientContractSaleDoc | null,
): boolean {
    if (!saleDocId) return false;
    if (saleDoc?.docStatus === 'DELETED') return false;
    return true;
}
