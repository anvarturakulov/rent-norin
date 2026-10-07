'use client';

import { useState } from 'react';
import useSWR from 'swr';
import styles from './contractOrderPickerModal.module.css';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import {
    STAGE_BG,
    STAGE_LABELS,
    type FurnitureOrder,
    type OrderStageType,
} from '@/app/interfaces/furnitureOrder.interface';
import FurnitureOrderForm from '@/app/components/furnitureOrders/furnitureOrderForm/furnitureOrderForm';

interface Props {
    open: boolean;
    token: string;
    enterpriseId: number;
    clientId: number;
    excludeIds: number[];
    onClose: () => void;
    onPick: (order: FurnitureOrder) => void;
}

export default function ContractOrderPickerModal({
    open,
    token,
    enterpriseId,
    clientId,
    excludeIds,
    onClose,
    onPick,
}: Props) {
    const url =
        open && clientId > 0
            ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/furniture-orders?enterpriseId=${enterpriseId}&clientId=${clientId}`
            : null;

    const { data, error, mutate } = useSWR(url, (u) => getDataForSwr(u, token));

    const [showNewOrderForm, setShowNewOrderForm] = useState(false);

    const formatDate = (ms?: number | string) => {
        if (ms == null || ms === '') return '—';
        const num = typeof ms === 'string' ? Number(ms) : ms;
        if (!Number.isFinite(num)) return '—';
        return new Date(num).toLocaleDateString('ru-RU');
    };

    if (!open) return null;

    const orders = (data as FurnitureOrder[] | undefined)?.filter(
        (o) => !excludeIds.includes(o.id),
    );

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.title}>Буюртмани танланг</h3>
                <div className={styles.body}>
                    {error && <div className={styles.empty}>Юклашда хатолик</div>}
                    {!data && !error && <div className={styles.empty}>Юкланмоқда…</div>}
                    {orders && orders.length === 0 && (
                        <div className={styles.empty}>Мавжуд буюртмалар йўқ</div>
                    )}
                    {orders && orders.length > 0 && (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Рақам</th>
                                    <th>Маҳсулот</th>
                                    <th>Босқич</th>
                                    <th>Сана</th>
                                    <th>Жами</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className={styles.tr}
                                        onClick={() => onPick(order)}
                                    >
                                        <td>
                                            <strong>{order.orderNumber}</strong>
                                        </td>
                                        <td>{order.analitic?.name ?? '—'}</td>
                                        <td>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: 10,
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: '#fff',
                                                    background:
                                                        STAGE_BG[order.currentStage] ?? '#9e9e9e',
                                                }}
                                            >
                                                {STAGE_LABELS[order.currentStage as OrderStageType]}
                                            </span>
                                        </td>
                                        <td>
                                            {formatDate(order.orderDate ?? order.createdDate)}
                                        </td>
                                        <td>
                                            {order.total != null
                                                ? `${order.total.toLocaleString('ru-RU')} сўм`
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className={styles.footer}>
                    <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => setShowNewOrderForm(true)}
                    >
                        + Янги буюртма
                    </button>
                    <div className={styles.footerEnd}>
                        <button type="button" className={styles.btn} onClick={onClose}>
                            Бекор қилиш
                        </button>
                    </div>
                </div>
                {showNewOrderForm && (
                    <div className={styles.formOverlay}>
                        <div onClick={(e) => e.stopPropagation()}>
                            <FurnitureOrderForm
                                initialClientId={clientId}
                                lockClient
                                onClose={() => setShowNewOrderForm(false)}
                                onCreated={(order) => {
                                    void mutate();
                                    setShowNewOrderForm(false);
                                    onPick(order);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
