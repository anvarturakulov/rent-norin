'use client';

import { forwardRef } from 'react';
import {
    FurnitureOrder,
    FurnitureOrderType,
    ORDER_TYPE_LABELS,
    STAGE_LABELS,
} from '@/app/interfaces/furnitureOrder.interface';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import styles from './printOrdersRegistry.module.css';

interface PrintOrdersRegistryProps {
    orders: FurnitureOrder[];
    dateStart: number;
    dateEnd: number;
    stageFilterLabel: string;
}

const formatDate = (ms?: number | string) => {
    if (ms == null || ms === '') return '—';
    const num = typeof ms === 'string' ? Number(ms) : ms;
    if (!Number.isFinite(num)) return '—';
    return new Date(num).toLocaleDateString('ru-RU');
};

const getOrderTypeLabel = (order: FurnitureOrder) =>
    order.orderType
        ? ORDER_TYPE_LABELS[order.orderType as FurnitureOrderType]
        : ORDER_TYPE_LABELS.individualPrice;

export const PrintOrdersRegistry = forwardRef<HTMLDivElement, PrintOrdersRegistryProps>(
    ({ orders, dateStart, dateEnd, stageFilterLabel }, ref) => {
        const dateRangeText = `${dateNumberToString(dateStart)} — ${dateNumberToString(dateEnd)}`;
        const totalSum = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const safeOrders = orders ?? [];

        return (
            <div ref={ref} className={styles.printContainer}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        Мебельное производство — Реестр заявок ({stageFilterLabel})
                    </div>
                    <div className={styles.dateRange}>{dateRangeText}</div>
                </div>

                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Рақам</th>
                            <th>Тип</th>
                            <th>Мижоз</th>
                            <th>Маҳсулот</th>
                            <th>Этап</th>
                            <th>Сана</th>
                            <th>Муддат</th>
                            <th>Жами</th>
                            <th>Изоҳ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {safeOrders.map((order) => (
                            <tr key={order.id}>
                                <td>{order.id}</td>
                                <td>{order.orderNumber}</td>
                                <td>{getOrderTypeLabel(order)}</td>
                                <td>{order.client?.name ?? `ID ${order.clientId}`}</td>
                                <td>{order.analitic?.name ?? '—'}</td>
                                <td className={styles.stageCell}>
                                    {STAGE_LABELS[order.currentStage]}
                                </td>
                                <td>{formatDate(order.orderDate ?? order.createdDate)}</td>
                                <td>{formatDate(order.deadlineDate)}</td>
                                <td className={styles.sumCell}>
                                    {order.total ? order.total.toLocaleString() : '—'}
                                </td>
                                <td>{order.comment || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className={styles.footerRow}>
                            <td colSpan={8}>Жами заявкалар: {safeOrders.length}</td>
                            <td className={styles.sumCell} colSpan={2}>
                                Жами сумма: {totalSum.toLocaleString()}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        );
    },
);

PrintOrdersRegistry.displayName = 'PrintOrdersRegistry';
