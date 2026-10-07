import { DocumentType } from '@/app/interfaces/document.interface';
import { FurnitureOrder } from '@/app/interfaces/furnitureOrder.interface';
import type { ColumnFilterState } from '@/app/components/common/tableColumnFilter/tableColumnFilter.types';

export function showsOrderInJournal(contentName: string): boolean {
    return (
        contentName === DocumentType.LeaveMaterial ||
        contentName === DocumentType.LeaveHalfstuff ||
        contentName === DocumentType.ComeProduct ||
        contentName === DocumentType.SaleProd ||
        contentName === DocumentType.ServicesToClients
    );
}

export type OrderJournalColumnKey =
    | 'summa'
    | 'receiver'
    | 'sender'
    | 'analitic'
    | 'comment'
    | 'user'
    | 'order';

export const DEFAULT_ORDER_JOURNAL_COLUMN_FILTERS: ColumnFilterState<OrderJournalColumnKey> = {
    summa: '',
    receiver: '',
    sender: '',
    analitic: '',
    comment: '',
    user: '',
    order: '',
};

export function buildOrdersByIdMap(
    orders: FurnitureOrder[] | undefined | null,
): Map<number, FurnitureOrder> {
    const map = new Map<number, FurnitureOrder>();
    (orders || []).forEach((order) => {
        if (order?.id != null) {
            map.set(Number(order.id), order);
        }
    });
    return map;
}

/** Display label for journal cell / print. */
export function formatOrderJournalLabel(
    orderId: number | undefined | null,
    ordersById: Map<number, FurnitureOrder>,
): string {
    const id = Number(orderId || 0);
    if (!id) return '—';
    const order = ordersById.get(id);
    if (order?.orderNumber) return `№${order.orderNumber}`;
    return `#${id}`;
}

/** Filterable text: label + raw id so substring search works on both. */
export function getOrderJournalFilterValue(
    orderId: number | undefined | null,
    ordersById: Map<number, FurnitureOrder>,
): string {
    const id = Number(orderId || 0);
    if (!id) return '';
    return `${formatOrderJournalLabel(id, ordersById)} ${id}`;
}
