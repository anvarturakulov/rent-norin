'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './productionWorkBoard.module.css';
import { useAppContext } from '@/app/context/app.context';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import {
    ProductionBoardOrder,
    ProductionBoardResponse,
} from '@/app/interfaces/furnitureOrder.interface';
import { ReferenceModel, TypeSECTION } from '@/app/interfaces/reference.interface';
import { withApiDomain } from '@/app/service/common/getApiDomain';
import DeptWorksModal from './DeptWorksModal';
import FinishWorkQtyModal from '../FinishWorkQtyModal';
import { useWorkExecution } from './useWorkExecution';
import {
    formatBoardDate,
    isWorkWaitingOrActive,
} from './workExecutionHelpers';

type WorksModalState = { orderId: number; deptId: number } | null;

export default function ProductionWorkBoard() {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const token = user?.token!;
    const enterpriseId = user?.enterpriseId;

    const allowedStorageIds = Array.isArray(user?.allowedStorageIds)
        ? user.allowedStorageIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : [];

    const [orderFilter, setOrderFilter] = useState('');
    const [onlyReady, setOnlyReady] = useState(false);
    const [worksModal, setWorksModal] = useState<WorksModalState>(null);

    const boardUrl =
        token && enterpriseId
            ? withApiDomain(`/api/order-works/production-board?enterpriseId=${enterpriseId}`)
            : null;

    const { data: board, mutate, error, isLoading } = useSWR<ProductionBoardResponse>(
        boardUrl,
        (url: string) => getDataForSwr(url, token),
    );

    const workshopsUrl =
        token && enterpriseId
            ? withApiDomain(`/api/references/byType/STORAGES?enterpriseId=${enterpriseId}`)
            : null;

    const { data: workshopsRaw } = useSWR<ReferenceModel[]>(
        workshopsUrl,
        (url: string) => getDataForSwr(url, token),
    );

    const departments = useMemo((): { id: number; name: string }[] => {
        return (workshopsRaw || [])
            .filter(
                (w) =>
                    w?.refValues?.typeSection === TypeSECTION.PRODUCTION &&
                    !w?.refValues?.markToDeleted,
            )
            .map((w) => ({
                id: Number(w.id),
                name: w.name,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru-RU'));
    }, [workshopsRaw]);

    const execution = useWorkExecution({
        token,
        userId: user?.id!,
        onRefresh: mutate,
    });

    const filteredOrders = useMemo(() => {
        let list: ProductionBoardOrder[] = board?.orders ?? [];
        const q = orderFilter.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (o) =>
                    String(o.orderNumber).toLowerCase().includes(q) ||
                    (o.productName || '').toLowerCase().includes(q) ||
                    (o.clientName || '').toLowerCase().includes(q),
            );
        }
        if (onlyReady) {
            list = list.filter((o) =>
                o.works.some((w) => w.canStartByQueue !== false && w.workStatus !== 'DONE'),
            );
        }
        return list;
    }, [board?.orders, orderFilter, onlyReady]);

    const deptNameById = useMemo(() => {
        const m = new Map<number, string>();
        for (const d of departments) m.set(d.id, d.name);
        return m;
    }, [departments]);

    const visibleDepartments = useMemo(() => {
        const deptIdsWithActiveWorks = new Set<number>();
        for (const order of filteredOrders) {
            for (const work of order.works) {
                if (!isWorkWaitingOrActive(work)) continue;
                const deptId = Number(work.assignedDeptId ?? work.assignedDept?.id);
                if (Number.isFinite(deptId) && deptId > 0) {
                    deptIdsWithActiveWorks.add(deptId);
                }
            }
        }
        return departments.filter((d) => deptIdsWithActiveWorks.has(d.id));
    }, [departments, filteredOrders]);

    const canExecuteInDept = (deptId: number) =>
        allowedStorageIds.length === 0 || allowedStorageIds.includes(deptId);

    const modalOrder = worksModal
        ? filteredOrders.find((o) => o.id === worksModal.orderId)
        : undefined;

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
                <h2>Ишлар доскаси</h2>
                <p>Заказлар ва ишлар — цехлар бўйича. Амаллар фақат ўз цехингизда (рухсат бўйича).</p>
            </div>

            <div className={styles.filterRow}>
                <input
                    className={styles.filterInput}
                    placeholder="Қидирув: заказ №, маҳсулот, мижоз"
                    value={orderFilter}
                    onChange={(e) => setOrderFilter(e.target.value)}
                />
                <label className={styles.filterCheck}>
                    <input
                        type="checkbox"
                        checked={onlyReady}
                        onChange={(e) => setOnlyReady(e.target.checked)}
                    />
                    Фақат навбатга тайёр
                </label>
            </div>

            {error && (
                <div style={{ color: 'red', padding: 12 }}>Хатолик: {error.message}</div>
            )}
            {isLoading && !board && <div className={styles.loading}>Юкланмоқда...</div>}
            {!isLoading && filteredOrders.length === 0 && (
                <div className={styles.empty}>Ишлаб чиқаришдаги заказлар ёки ишлар топилмади</div>
            )}

            {visibleDepartments.length > 0 && filteredOrders.length > 0 && (
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={`${styles.stickyColHeader} ${styles.stickyCol}`}>
                                    Заказ
                                </th>
                                {visibleDepartments.map((dept) => (
                                    <th key={dept.id} className={styles.deptCol}>
                                        {dept.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => {
                                const activeWorksCount = order.works.filter(isWorkWaitingOrActive).length;
                                return (
                                    <tr key={order.id} className={styles.orderRow}>
                                        <td className={styles.stickyCol}>
                                            <div className={styles.orderTitleRow}>
                                                <span>Заказ #{order.orderNumber}</span>
                                                <span className={styles.worksCountBadge}>
                                                    {activeWorksCount} иш
                                                </span>
                                            </div>
                                            <div className={styles.orderMeta}>
                                                {(order.productName || '—').toUpperCase()}
                                            </div>
                                            <div className={styles.orderMeta}>
                                                Мижоз: {(order.clientName || '—').toUpperCase()}
                                            </div>
                                            <div className={styles.orderMeta}>
                                                Муддат: {formatBoardDate(order.deadlineDate)}
                                            </div>
                                            {order.activeDeptIds.length > 0 && (
                                                <span className={styles.activeDeptBadge}>
                                                    Жорий:{' '}
                                                    {order.activeDeptIds
                                                        .map((id) => deptNameById.get(id) ?? `#${id}`)
                                                        .join(', ')}
                                                </span>
                                            )}
                                        </td>
                                        {visibleDepartments.map((dept) => {
                                            const isActive = order.activeDeptIds.includes(dept.id);
                                            const deptWorksCount = order.works.filter((w) => {
                                                const assignedId = Number(
                                                    w.assignedDeptId ?? w.assignedDept?.id,
                                                );
                                                return (
                                                    assignedId === dept.id &&
                                                    isWorkWaitingOrActive(w)
                                                );
                                            }).length;
                                            return (
                                                <td
                                                    key={dept.id}
                                                    className={`${styles.deptCol} ${isActive ? styles.deptColActive : ''}`}
                                                >
                                                    {deptWorksCount > 0 ? (
                                                        <button
                                                            type="button"
                                                            className={styles.orderDeptWorksCount}
                                                            onClick={() =>
                                                                setWorksModal({
                                                                    orderId: order.id,
                                                                    deptId: dept.id,
                                                                })
                                                            }
                                                        >
                                                            {deptWorksCount} иш
                                                        </button>
                                                    ) : (
                                                        <span className={styles.cellEmpty}>—</span>
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
            {departments.length > 0 &&
                filteredOrders.length > 0 &&
                visibleDepartments.length === 0 && (
                    <div className={styles.empty}>
                        Кўрсатиш учун фаол ёки кутилаётган ишлар бўйича цех топилмади
                    </div>
                )}

            {worksModal && modalOrder && (
                <DeptWorksModal
                    order={modalOrder}
                    deptId={worksModal.deptId}
                    deptName={deptNameById.get(worksModal.deptId) ?? `#${worksModal.deptId}`}
                    myWorkerId={execution.myWorkerId}
                    canExecuteActions={canExecuteInDept(worksModal.deptId)}
                    busy={execution.busy}
                    onStart={execution.handleStart}
                    onPause={execution.handlePause}
                    onFinish={execution.handleFinish}
                    onClose={() => setWorksModal(null)}
                />
            )}

            {execution.finishTarget && (
                <FinishWorkQtyModal
                    work={execution.finishTarget.work}
                    busy={execution.busy}
                    onConfirm={execution.confirmFinish}
                    onClose={execution.closeFinishModal}
                />
            )}
        </div>
    );
}
