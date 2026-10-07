'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './ordersStageBoard.module.css';
import { useAppContext } from '@/app/context/app.context';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { getTodayRange } from '@/app/service/common/dateRanges';
import { getDateRangeText } from '@/app/components/common/header/helpers/headerTextHelpers';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import {
    FurnitureOrder,
    FurnitureOrderType,
    ORDER_STAGE_SEQUENCE,
    ORDER_TYPE_LABELS,
    OrderStageType,
    STAGE_BG,
    STAGE_LABELS,
    TEMPORARILY_DISABLED_STAGES,
} from '@/app/interfaces/furnitureOrder.interface';
import FurnitureOrderCard from '../furnitureOrderCard/furnitureOrderCard';

const BOARD_STAGES: OrderStageType[] = ORDER_STAGE_SEQUENCE.filter(
    (s) => s !== 'COMPLETED' && !TEMPORARILY_DISABLED_STAGES.includes(s),
);

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

const getActiveDeptNames = (order: FurnitureOrder): string => {
    const queue = order.productionQueue ?? [];
    const active = queue.filter((q) => q.status === 'ACTIVE');
    if (active.length === 0) return '';
    return active
        .map((q) => q.dept?.name ?? `#${q.deptId}`)
        .join(', ');
};

export default function OrdersStageBoard() {
    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users;
    const { dateStart, dateEnd } = mainData.journal.interval;
    const token = user?.token;
    const enterpriseId = user?.enterpriseId;

    const [orderFilter, setOrderFilter] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<FurnitureOrder | null>(null);
    const [openingOrderId, setOpeningOrderId] = useState<number | null>(null);

    const openOrder = useCallback(
        async (order: FurnitureOrder) => {
            if (!token) {
                setSelectedOrder(order);
                return;
            }
            setOpeningOrderId(order.id);
            try {
                const refreshed = await foApi.getOrder(token, order.id);
                setSelectedOrder(refreshed);
            } catch {
                setSelectedOrder(order);
            } finally {
                setOpeningOrderId(null);
            }
        },
        [token],
    );

    const { dateStartForUrl, dateEndForUrl } = useMemo(() => {
        let start = dateStart;
        let end = dateEnd;
        if (!start && !end) {
            const today = getTodayRange();
            start = today.start;
            end = today.end;
        }
        return { dateStartForUrl: start, dateEndForUrl: end };
    }, [dateStart, dateEnd]);

    const ordersKey =
        token && enterpriseId && dateStartForUrl != null && dateEndForUrl != null
            ? [
                  'stage-board-orders',
                  token,
                  enterpriseId,
                  dateStartForUrl,
                  dateEndForUrl,
              ]
            : null;

    const { data: orders = [], mutate, error, isLoading } = useSWR<FurnitureOrder[]>(
        ordersKey,
        () =>
            foApi.getOrders(token!, enterpriseId!, undefined, undefined, {
                dateStart: dateStartForUrl!,
                dateEnd: dateEndForUrl!,
                excludeCompleted: true,
            }),
    );

    const handleIntervalClick = useCallback(() => {
        setMainData?.('showIntervalWindow', true);
    }, [setMainData]);

    const filteredOrders = useMemo(() => {
        let list = [...orders];
        const q = orderFilter.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (o) =>
                    String(o.orderNumber ?? o.id).toLowerCase().includes(q) ||
                    (o.analitic?.name || '').toLowerCase().includes(q) ||
                    (o.client?.name || '').toLowerCase().includes(q),
            );
        }
        list.sort((a, b) => {
            const da = Number(a.deadlineDate) || Number.MAX_SAFE_INTEGER;
            const db = Number(b.deadlineDate) || Number.MAX_SAFE_INTEGER;
            if (da !== db) return da - db;
            return String(a.orderNumber ?? a.id).localeCompare(
                String(b.orderNumber ?? b.id),
                'ru-RU',
                { numeric: true },
            );
        });
        return list;
    }, [orders, orderFilter]);

    const countByStage = useMemo(() => {
        const counts = new Map<OrderStageType, number>();
        for (const stage of BOARD_STAGES) counts.set(stage, 0);
        for (const order of filteredOrders) {
            const stage = order.currentStage as OrderStageType;
            if (BOARD_STAGES.includes(stage)) {
                counts.set(stage, (counts.get(stage) ?? 0) + 1);
            }
        }
        return counts;
    }, [filteredOrders]);

    if (!enterpriseId) {
        return (
            <div className={styles.container}>
                <div className={styles.empty}>Корхона танланмаган</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Заявкалар доскаси</h2>
                <p>Заявкалар — этаплар бўйича. Жорий этап бўйича карточка кўрсатилади.</p>
                <div className={styles.intervalRow}>
                    <span>Давр:</span>
                    <button
                        type="button"
                        className={styles.intervalBtn}
                        onClick={handleIntervalClick}
                    >
                        {getDateRangeText(dateStartForUrl, dateEndForUrl)}
                    </button>
                </div>
            </div>

            <div className={styles.filterRow}>
                <input
                    className={styles.filterInput}
                    placeholder="Қидирув: заказ №, маҳсулот, мижоз"
                    value={orderFilter}
                    onChange={(e) => setOrderFilter(e.target.value)}
                />
            </div>

            {error && (
                <div className={styles.error}>Хатолик: {error.message}</div>
            )}
            {isLoading && orders.length === 0 && (
                <div className={styles.loading}>Юкланмоқда...</div>
            )}
            {!isLoading && filteredOrders.length === 0 && (
                <div className={styles.empty}>Танланган даврда заявкалар топилмади</div>
            )}

            {filteredOrders.length > 0 && (
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th
                                    className={`${styles.stickyColHeader} ${styles.stickyCol}`}
                                >
                                    Заявка
                                </th>
                                {BOARD_STAGES.map((stage) => (
                                    <th key={stage} className={styles.stageCol}>
                                        <div className={styles.stageHeader}>
                                            <span
                                                className={styles.stageHeaderLabel}
                                                style={{
                                                    backgroundColor: STAGE_BG[stage],
                                                }}
                                            >
                                                {STAGE_LABELS[stage]}
                                            </span>
                                            <span className={styles.stageCount}>
                                                {countByStage.get(stage) ?? 0}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => {
                                const currentStage =
                                    order.currentStage as OrderStageType;
                                const productName = (
                                    order.analitic?.name || '—'
                                ).toUpperCase();
                                const clientName = (
                                    order.client?.name || '—'
                                ).toUpperCase();
                                const productionDepts =
                                    currentStage === 'IN_PRODUCTION'
                                        ? getActiveDeptNames(order)
                                        : '';

                                return (
                                    <tr key={order.id} className={styles.orderRow}>
                                        <td className={styles.stickyCol}>
                                            <div className={styles.orderNumber}>
                                                #{order.orderNumber || order.id}
                                            </div>
                                            <div className={styles.orderMeta}>
                                                {productName}
                                            </div>
                                            <div className={styles.orderMeta}>
                                                {clientName}
                                            </div>
                                            <div className={styles.orderMeta}>
                                                Муддат: {formatDate(order.deadlineDate)}
                                            </div>
                                        </td>
                                        {BOARD_STAGES.map((stage) => {
                                            const isActive = stage === currentStage;
                                            return (
                                                <td
                                                    key={stage}
                                                    className={`${styles.stageCol} ${isActive ? styles.stageColActive : ''}`}
                                                >
                                                    {isActive ? (
                                                        <button
                                                            type="button"
                                                            className={styles.orderCard}
                                                            disabled={openingOrderId === order.id}
                                                            onClick={() => void openOrder(order)}
                                                        >
                                                            <span
                                                                className={
                                                                    styles.orderCardTitle
                                                                }
                                                            >
                                                                #
                                                                {order.orderNumber ||
                                                                    order.id}
                                                            </span>
                                                            <span
                                                                className={
                                                                    styles.orderCardMeta
                                                                }
                                                            >
                                                                {productName}
                                                            </span>
                                                            <span
                                                                className={
                                                                    styles.orderCardMeta
                                                                }
                                                            >
                                                                {clientName}
                                                            </span>
                                                            <span
                                                                className={
                                                                    styles.orderCardMeta
                                                                }
                                                            >
                                                                Муддат:{' '}
                                                                {formatDate(
                                                                    order.deadlineDate,
                                                                )}
                                                            </span>
                                                            <span
                                                                className={
                                                                    styles.orderCardType
                                                                }
                                                            >
                                                                {getOrderTypeLabel(
                                                                    order,
                                                                )}
                                                            </span>
                                                            {productionDepts && (
                                                                <span
                                                                    className={
                                                                        styles.productionHint
                                                                    }
                                                                >
                                                                    Жорий цех:{' '}
                                                                    {productionDepts}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span
                                                            className={
                                                                styles.cellEmpty
                                                            }
                                                        >
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedOrder && (
                <div
                    className={styles.overlay}
                    onClick={(e) =>
                        e.target === e.currentTarget && setSelectedOrder(null)
                    }
                >
                    <FurnitureOrderCard
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        onUpdated={(updated) => {
                            setSelectedOrder(updated);
                            mutate();
                        }}
                        onDeleted={() => {
                            setSelectedOrder(null);
                            mutate();
                        }}
                    />
                </div>
            )}
        </div>
    );
}
