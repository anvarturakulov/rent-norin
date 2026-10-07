'use client'
import { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useReactToPrint } from 'react-to-print';
import styles from './furnitureOrdersJournal.module.css';
import { useAppContext } from '@/app/context/app.context';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { getTodayRange } from '@/app/service/common/dateRanges';
import { formatDisplayDate } from '@/app/utils/formatDisplayDate';
import { getDateRangeText } from '@/app/components/common/header/helpers/headerTextHelpers';
import DateIco from '@/app/components/common/header/date.svg';
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
import FurnitureOrderForm from '../furnitureOrderForm/furnitureOrderForm';
import FurnitureOrderCard from '../furnitureOrderCard/furnitureOrderCard';
import { filterRowsByColumns } from '@/app/components/common/tableColumnFilter/filterRowsByColumns';
import type { ColumnFilterGetters, ColumnFilterState } from '@/app/components/common/tableColumnFilter/tableColumnFilter.types';
import { PrintOrdersRegistry } from './PrintOrdersRegistry';

const ALL_STAGES: (OrderStageType | 'ALL')[] = [
    'ALL',
    ...ORDER_STAGE_SEQUENCE.filter((s) => !TEMPORARILY_DISABLED_STAGES.includes(s)),
];

type OrderColumnKey =
    | 'id'
    | 'orderNumber'
    | 'orderType'
    | 'client'
    | 'analitic'
    | 'stage'
    | 'orderDate'
    | 'deadlineDate'
    | 'total'
    | 'comment';

const DEFAULT_COLUMN_FILTERS: ColumnFilterState<OrderColumnKey> = {
    id: '',
    orderNumber: '',
    orderType: '',
    client: '',
    analitic: '',
    stage: '',
    orderDate: '',
    deadlineDate: '',
    total: '',
    comment: '',
};

const FILTER_COLUMNS: { key: OrderColumnKey; placeholder: string; width?: number }[] = [
    { key: 'id', placeholder: '№', width: 60 },
    { key: 'orderNumber', placeholder: 'Рақам', width: 120 },
    { key: 'orderType', placeholder: 'Тип', width: 130 },
    { key: 'client', placeholder: 'Мижоз' },
    { key: 'analitic', placeholder: 'Маҳсулот', width: 180 },
    { key: 'stage', placeholder: 'Этап', width: 130 },
    { key: 'orderDate', placeholder: 'Сана', width: 100 },
    { key: 'deadlineDate', placeholder: 'Муддат', width: 100 },
    { key: 'total', placeholder: 'Жами', width: 120 },
    { key: 'comment', placeholder: 'Изоҳ' },
];

const formatDate = (ms?: number | string) => {
    if (ms == null || ms === '') return '—';
    const num = typeof ms === 'string' ? Number(ms) : ms;
    if (!Number.isFinite(num)) return '—';
    return formatDisplayDate(num);
};

const getOrderTypeLabel = (order: FurnitureOrder) =>
    order.orderType
        ? ORDER_TYPE_LABELS[order.orderType as FurnitureOrderType]
        : ORDER_TYPE_LABELS.individualPrice;

const getClientLabel = (order: FurnitureOrder) =>
    order.client?.name ?? `ID ${order.clientId}`;

const getTotalLabel = (order: FurnitureOrder) =>
    order.total ? order.total.toLocaleString() : '—';

export default function FurnitureOrdersJournal() {
    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users;
    const { dateStart, dateEnd } = mainData.journal.interval;
    const token = user?.token;
    const enterpriseId = user?.enterpriseId;

    const [stageFilter, setStageFilter] = useState<OrderStageType | 'ALL'>('ALL');
    const [columnFilters, setColumnFilters] = useState<ColumnFilterState<OrderColumnKey>>(
        DEFAULT_COLUMN_FILTERS,
    );
    const [showColumnFilters, setShowColumnFilters] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<FurnitureOrder | null>(null);
    const [editingOrder, setEditingOrder] = useState<FurnitureOrder | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

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

    const enterpriseParam = enterpriseId ? `&enterpriseId=${enterpriseId}` : '';
    const stageParam = stageFilter !== 'ALL' ? `&stage=${stageFilter}` : '';
    const dateParam =
        dateStartForUrl != null && dateEndForUrl != null
            ? `&dateStart=${dateStartForUrl}&dateEnd=${dateEndForUrl}`
            : '';
    const url = token
        ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/furniture-orders?_=1${enterpriseParam}${stageParam}${dateParam}`
        : null;

    const { data, mutate, error } = useSWR(url, (u) => getDataForSwr(u, token));

    const handleIntervalClick = useCallback(() => {
        setMainData?.('showIntervalWindow', true);
    }, [setMainData]);

    const stageFilterLabel =
        stageFilter === 'ALL' ? 'Барчаси' : STAGE_LABELS[stageFilter as OrderStageType];

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Реестр заявок — ${dateNumberToString(dateStartForUrl)} — ${dateNumberToString(dateEndForUrl)}`,
        pageStyle: `
            @page { size: A4 landscape; margin: 10mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        `,
    });

    const orders = useMemo(
        () => (Array.isArray(data) ? (data as FurnitureOrder[]) : []),
        [data],
    );

    const sortedOrders = useMemo(
        () =>
            [...orders].sort((a, b) => {
                const aDate = Number(a.orderDate || a.createdDate) || 0;
                const bDate = Number(b.orderDate || b.createdDate) || 0;
                if (bDate !== aDate) return bDate - aDate;
                return Number(b.id) - Number(a.id);
            }),
        [orders],
    );

    const columnGetters = useMemo<ColumnFilterGetters<FurnitureOrder, OrderColumnKey>>(
        () => ({
            id: (order) => String(order.id),
            orderNumber: (order) => order.orderNumber ?? '',
            orderType: getOrderTypeLabel,
            client: getClientLabel,
            analitic: (order) => order.analitic?.name ?? '—',
            stage: (order) => STAGE_LABELS[order.currentStage] ?? '',
            orderDate: (order) => formatDate(order.orderDate ?? order.createdDate),
            deadlineDate: (order) => formatDate(order.deadlineDate),
            total: getTotalLabel,
            comment: (order) => order.comment ?? '—',
        }),
        [],
    );

    const filteredOrders = useMemo(
        () => filterRowsByColumns(sortedOrders, columnFilters, columnGetters),
        [sortedOrders, columnFilters, columnGetters],
    );

    const hasActiveColumnFilters = useMemo(
        () => Object.values(columnFilters).some((v) => v.trim() !== ''),
        [columnFilters],
    );

    const updateColumnFilter = useCallback((key: OrderColumnKey, value: string) => {
        setColumnFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clearColumnFilters = useCallback(() => {
        setColumnFilters(DEFAULT_COLUMN_FILTERS);
    }, []);

    const toggleColumnFilters = useCallback(() => {
        setShowColumnFilters((prev) => !prev);
    }, []);

    const openOrder = async (order: FurnitureOrder) => {
        try {
            const refreshed = await foApi.getOrder(token!, order.id);
            if (refreshed.currentStage === 'TALABGOR') {
                setEditingOrder(refreshed);
            } else {
                setSelectedOrder(refreshed);
            }
        } catch {
            if (order.currentStage === 'TALABGOR') {
                setEditingOrder(order);
            } else {
                setSelectedOrder(order);
            }
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <h2>Мебел ишлаб чикариш — Заявкалар</h2>
                    <button type="button" className={styles.addButton} onClick={() => setShowForm(true)}>
                        + Янги заявка
                    </button>
                </div>
                <div className={styles.filters}>
                    {ALL_STAGES.map(s => (
                        <button
                            key={s}
                            type="button"
                            className={`${styles.filterBtn} ${stageFilter === s ? styles.filterBtnActive : ''}`}
                            onClick={() => setStageFilter(s as any)}
                        >
                            {s === 'ALL' ? 'Барчаси' : STAGE_LABELS[s as OrderStageType]}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.intervalBar}>
                <div className={styles.intervalText}>
                    {getDateRangeText(dateStartForUrl, dateEndForUrl) || 'Оралиқ сана танланмаган'}
                </div>
                <div className={styles.intervalActions}>
                    <button
                        type="button"
                        className={styles.printBtn}
                        onClick={() => handlePrint()}
                        disabled={filteredOrders.length === 0}
                        title="Реестрни чоп этиш"
                    >
                        🖨 Реестр
                    </button>
                    <button
                        type="button"
                        className={styles.intervalBtn}
                        onClick={handleIntervalClick}
                        title="Оралиқ санани ўзгартириш"
                    >
                        <DateIco className={styles.intervalIco} />
                        <span>Интервал</span>
                    </button>
                </div>
            </div>

            {error && <div className={styles.error}>Маълумот юклашда хатолик: {error.message}</div>}
            {!data && !error && <div className={styles.loading}>Юкланмоқда...</div>}
            {data && orders.length === 0 && <div className={styles.empty}>Заявкалар топилмади</div>}

            {data && orders.length > 0 && (
                <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr
                            className={`${styles.headerRow} ${showColumnFilters || hasActiveColumnFilters ? styles.headerRowFiltersOn : ''}`}
                            onDoubleClick={toggleColumnFilters}
                            title="Фильтр учун шапкани икки марта босинг"
                        >
                            <th style={{ width: 60 }}>№</th>
                            <th style={{ width: 120 }}>Рақам</th>
                            <th style={{ width: 130 }}>Тип</th>
                            <th>Мижоз</th>
                            <th style={{ width: 180 }}>Маҳсулот</th>
                            <th style={{ width: 130 }}>Этап</th>
                            <th style={{ width: 100 }}>Сана</th>
                            <th style={{ width: 100 }}>Муддат</th>
                            <th style={{ width: 120 }}>Жами</th>
                            <th>Изоҳ</th>
                        </tr>
                        {showColumnFilters && (
                            <tr className={styles.filterRow}>
                                {FILTER_COLUMNS.map((col, index) => (
                                    <th
                                        key={col.key}
                                        style={col.width ? { width: col.width } : undefined}
                                    >
                                        {index === 0 ? (
                                            <div className={styles.filterCellWithClear}>
                                                <input
                                                    type="text"
                                                    className={`${styles.filterInput} ${columnFilters[col.key].trim() ? styles.filterInputActive : ''}`}
                                                    placeholder={col.placeholder}
                                                    value={columnFilters[col.key]}
                                                    onChange={(e) => updateColumnFilter(col.key, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                {hasActiveColumnFilters && (
                                                    <button
                                                        type="button"
                                                        className={styles.clearFiltersBtn}
                                                        title="Фильтрни тозалаш"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            clearColumnFilters();
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                className={`${styles.filterInput} ${columnFilters[col.key].trim() ? styles.filterInputActive : ''}`}
                                                placeholder={col.placeholder}
                                                value={columnFilters[col.key]}
                                                onChange={(e) => updateColumnFilter(col.key, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                    </th>
                                ))}
                            </tr>
                        )}
                    </thead>
                    <tbody className={styles.tbody}>
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={10} className={styles.emptyRow}>
                                    Фильтр бўйича натижа йўқ
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map(order => {
                                const now = Date.now();
                                const deadline = order.deadlineDate ? Number(order.deadlineDate) : null;
                                const isOverdue = deadline != null && Number.isFinite(deadline) && deadline < now && order.currentStage !== 'COMPLETED';
                                return (
                                    <tr
                                        key={order.id}
                                        className={`${styles.trRow} ${isOverdue ? styles.trOverdue : ''}`}
                                        onClick={() => openOrder(order)}
                                    >
                                        <td>{order.id}</td>
                                        <td><strong>{order.orderNumber}</strong></td>
                                        <td>{getOrderTypeLabel(order)}</td>
                                        <td>{getClientLabel(order)}</td>
                                        <td>{order.analitic?.name ?? '—'}</td>
                                        <td>
                                            <span
                                                className={styles.stageBadge}
                                                style={{ background: STAGE_BG[order.currentStage] ?? '#9e9e9e' }}
                                            >
                                                {STAGE_LABELS[order.currentStage]}
                                            </span>
                                        </td>
                                        <td>{formatDate(order.orderDate ?? order.createdDate)}</td>
                                        <td className={isOverdue ? styles.overdueDate : ''}>{formatDate(order.deadlineDate)}</td>
                                        <td>{getTotalLabel(order)}</td>
                                        <td className={styles.commentCell} title={order.comment || ''}>{order.comment || '—'}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                </div>
            )}

            <PrintOrdersRegistry
                ref={printRef}
                orders={filteredOrders}
                dateStart={dateStartForUrl}
                dateEnd={dateEndForUrl}
                stageFilterLabel={stageFilterLabel}
            />

            {showForm && (
                <div className={styles.overlay}>
                    <FurnitureOrderForm
                        onClose={() => setShowForm(false)}
                        onCreated={() => { setShowForm(false); mutate(); }}
                    />
                </div>
            )}

            {selectedOrder && (
                <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setSelectedOrder(null)}>
                    <FurnitureOrderCard
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        onUpdated={(updated) => { setSelectedOrder(updated); mutate(); }}
                        onDeleted={() => { setSelectedOrder(null); mutate(); }}
                    />
                </div>
            )}

            {editingOrder && (
                <div className={styles.overlay}>
                    <FurnitureOrderForm
                        order={editingOrder}
                        onClose={() => setEditingOrder(null)}
                        onCreated={() => { setEditingOrder(null); mutate(); }}
                        onUpdated={(updated) => {
                            setEditingOrder(null);
                            if (updated.currentStage !== 'TALABGOR') {
                                setSelectedOrder(updated);
                            }
                            mutate();
                        }}
                    />
                </div>
            )}
        </div>
    );
}
