'use client';

import { Fragment, useMemo, useState } from 'react';
import styles from './workTimeReport.module.css';
import { useAppContext } from '@/app/context/app.context';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { WorkTimeReportOrder } from '@/app/interfaces/furnitureOrder.interface';

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDateInputValue(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function dateInputToStartMs(value: string): number {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function dateInputToEndMs(value: string): number {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function formatHours(hours: number): string {
    const n = Math.round(hours * 100) / 100;
    return `${n} ч`;
}

function formatDateTime(ts?: number): string {
    if (!ts) return '—';
    const d = new Date(Number(ts));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function WorkTimeReport() {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const token = user?.token;
    const enterpriseId = user?.enterpriseId;

    const today = useMemo(() => new Date(), []);
    const [dateFrom, setDateFrom] = useState(toDateInputValue(startOfMonth(today)));
    const [dateTo, setDateTo] = useState(toDateInputValue(today));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [orders, setOrders] = useState<WorkTimeReportOrder[]>([]);
    const [totalLaborHours, setTotalLaborHours] = useState(0);
    const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

    const loadReport = async () => {
        if (!token || !enterpriseId) return;
        setLoading(true);
        setError('');
        try {
            const data = await foApi.getWorkTimeReport(
                token,
                enterpriseId,
                dateInputToStartMs(dateFrom),
                dateInputToEndMs(dateTo),
            );
            setOrders(data.orders || []);
            setTotalLaborHours(Number(data.summary?.totalLaborHours || 0));
            setCollapsed({});
        } catch (e: any) {
            setError(e?.message || 'Ошибка загрузки');
            setOrders([]);
            setTotalLaborHours(0);
        } finally {
            setLoading(false);
        }
    };

    const toggleOrder = (orderId: number) => {
        setCollapsed((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
    };

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
                <h2>Иш вақти ҳисоботи</h2>
                <p>Заказ → иш → ходим бўйича трудозатратлар (сумма соатлар)</p>
            </div>

            <div className={styles.filterRow}>
                <label className={styles.filterField}>
                    Дан
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </label>
                <label className={styles.filterField}>
                    Гача
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </label>
                <button
                    type="button"
                    className={styles.btnLoad}
                    onClick={loadReport}
                    disabled={loading}
                >
                    {loading ? 'Юкланмоқда...' : 'Кўрсатиш'}
                </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {orders.length > 0 && (
                <div className={styles.summary}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Жами трудозатрат</div>
                        <div className={styles.summaryValue}>{formatHours(totalLaborHours)}</div>
                    </div>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Заказлар</div>
                        <div className={styles.summaryValue}>{orders.length}</div>
                    </div>
                </div>
            )}

            {!loading && orders.length === 0 && !error && (
                <div className={styles.empty}>
                    Даврни танланг ва «Кўрсатиш» ни босинг
                </div>
            )}

            {orders.length > 0 && (
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Заказ / иш / ходим</th>
                                <th className={styles.hoursCell}>Соат</th>
                                <th>Давр сессии</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => {
                                const isCollapsed = collapsed[order.orderId];
                                return (
                                    <Fragment key={`order-block-${order.orderId}`}>
                                        <tr
                                            className={styles.orderRow}
                                            onClick={() => toggleOrder(order.orderId)}
                                        >
                                            <td>
                                                <span className={styles.toggle}>
                                                    {isCollapsed ? '▸' : '▾'}
                                                </span>
                                                <strong>#{order.orderNumber}</strong>
                                                <div className={styles.orderMeta}>
                                                    {order.productName || '—'}
                                                    {order.clientName ? ` · ${order.clientName}` : ''}
                                                </div>
                                            </td>
                                            <td className={styles.hoursCell}>
                                                <strong>{formatHours(order.totalLaborHours)}</strong>
                                            </td>
                                            <td />
                                        </tr>
                                        {!isCollapsed &&
                                            order.works.map((work) => (
                                                <Fragment key={`work-block-${order.orderId}-${work.workId}`}>
                                                    <tr className={styles.workRow}>
                                                        <td>
                                                            {work.workName}
                                                            {work.assignedDeptName
                                                                ? ` (${work.assignedDeptName})`
                                                                : ''}
                                                        </td>
                                                        <td className={styles.hoursCell}>
                                                            {formatHours(work.totalLaborHours)}
                                                        </td>
                                                        <td />
                                                    </tr>
                                                    {work.workers.map((worker) =>
                                                        worker.sessions.map((session, idx) => (
                                                            <tr
                                                                key={`worker-${session.logId}`}
                                                                className={styles.workerRow}
                                                            >
                                                                <td>
                                                                    {idx === 0
                                                                        ? worker.workerName
                                                                        : ''}
                                                                </td>
                                                                <td className={styles.hoursCell}>
                                                                    {formatHours(session.hoursSpent)}
                                                                </td>
                                                                <td>
                                                                    {formatDateTime(session.startedAt)}
                                                                    {' — '}
                                                                    {formatDateTime(session.finishedAt)}
                                                                </td>
                                                            </tr>
                                                        )),
                                                    )}
                                                </Fragment>
                                            ))}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
