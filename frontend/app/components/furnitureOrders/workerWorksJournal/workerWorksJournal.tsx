'use client'
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './workerWorksJournal.module.css';
import { useAppContext } from '@/app/context/app.context';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { FurnitureOrder, OrderWork, WORK_STATUS_LABELS } from '@/app/interfaces/furnitureOrder.interface';
import { getApiDomain, withApiDomain } from '@/app/service/common/getApiDomain';
import { getActiveLogForWorker, getActiveWorkersCount } from '../productionWorkBoard/workExecutionHelpers';
import { useWorkExecution } from '../productionWorkBoard/useWorkExecution';
import FinishWorkQtyModal from '../FinishWorkQtyModal';

type ViewLevel = 'depts' | 'orders' | 'works';

const STATUS_COLOR: Record<string, string> = {
    OPEN: '#9e9e9e', PENDING: '#ff9800', IN_PROGRESS: '#2196f3', PAUSE: '#ff5722', DONE: '#4caf50',
};

export default function WorkerWorksJournal() {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const token = user?.token!;
    const allowedStorageIds = Array.isArray(user?.allowedStorageIds)
        ? user.allowedStorageIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : [];
    const deptIdsFromProfile: number[] = allowedStorageIds;

    const [selectedDeptId, setSelectedDeptId] = useState<number | null>(
        deptIdsFromProfile.length === 1 ? deptIdsFromProfile[0] : null,
    );
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [view, setView] = useState<ViewLevel>(
        deptIdsFromProfile.length === 1 ? 'orders' : 'depts',
    );

    const worksUrl = token && selectedDeptId
        ? withApiDomain(`/api/order-works/by-dept?deptId=${selectedDeptId}`)
        : null;

    const { data: works, mutate, error } = useSWR(worksUrl, (u) => getDataForSwr(u, token));

    const execution = useWorkExecution({
        token,
        userId: user?.id!,
        onRefresh: mutate,
    });
    const { busy, myWorkerId, handleStart, handlePause, handleFinish, getMyActiveLog } = execution;

    const workshopsUrl = token && user?.enterpriseId
        ? withApiDomain(`/api/references/byType/STORAGES?enterpriseId=${user.enterpriseId}`)
        : null;
    const { data: workshopsRaw, error: workshopsError } = useSWR(
        workshopsUrl,
        (url) => getDataForSwr(url, token),
    );
    const workshops = (workshopsRaw || []).filter((w: any) =>
        w?.refValues?.typeSection === 'PRODUCTION' && !w?.refValues?.markToDeleted,
    );

    useEffect(() => {
        if (deptIdsFromProfile.length === 1 && selectedDeptId == null) {
            setSelectedDeptId(deptIdsFromProfile[0]);
            setView('orders');
        }
    }, [deptIdsFromProfile, selectedDeptId]);

    const formatDate = (value?: number | string | null) => {
        if (!value) return '—';
        const date = new Date(Number(value));
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('ru-RU');
    };

    const visibleWorkshops = (workshops || []).filter((w: any) =>
        deptIdsFromProfile.length === 0 || deptIdsFromProfile.includes(Number(w.id)),
    );
    const availableWorkshopIds = (workshops || []).map((w: any) => Number(w.id)).filter((id: number) => Number.isFinite(id));
    const matchedAllowedIds = deptIdsFromProfile.filter((id) => availableWorkshopIds.includes(Number(id)));
    const selectedWorkshopName =
        selectedDeptId != null
            ? (visibleWorkshops || []).find((w: any) => Number(w.id) === Number(selectedDeptId))?.name ?? `Цех #${selectedDeptId}`
            : '';

    const worksByOrder = useMemo(() => Object.entries(
        ((works as OrderWork[] | undefined) || []).reduce<Record<number, OrderWork[]>>((acc, work) => {
            if (!acc[work.orderId]) acc[work.orderId] = [];
            acc[work.orderId].push(work);
            return acc;
        }, {}),
    )
        .map(([orderId, orderWorks]) => ({
            orderId: Number(orderId),
            works: [...orderWorks].sort((a, b) => {
                const aIndex = a.lineIndex ?? Number.MAX_SAFE_INTEGER;
                const bIndex = b.lineIndex ?? Number.MAX_SAFE_INTEGER;
                if (aIndex !== bIndex) return aIndex - bIndex;
                return a.id - b.id;
            }),
        }))
        .sort((a, b) => {
            const aHasReady = a.works.some((work) => work.canStartByQueue !== false);
            const bHasReady = b.works.some((work) => work.canStartByQueue !== false);
            if (aHasReady !== bHasReady) return aHasReady ? -1 : 1;
            return b.orderId - a.orderId;
        }), [works]);

    const orderIds = worksByOrder.map(({ orderId }) => orderId);
    const { data: ordersDetails } = useSWR(
        token && selectedDeptId && orderIds.length > 0 ? ['orders-details', token, ...orderIds] : null,
        async () => {
            const orders = await Promise.all(orderIds.map((orderId) => foApi.getOrder(token, orderId)));
            return orders.reduce<Record<number, FurnitureOrder>>((acc, order) => {
                acc[order.id] = order;
                return acc;
            }, {});
        },
    );

    const selectedOrderWorks = useMemo(
        () => worksByOrder.find((g) => g.orderId === selectedOrderId)?.works ?? [],
        [worksByOrder, selectedOrderId],
    );

    const openDept = (deptId: number) => {
        setSelectedDeptId(deptId);
        setSelectedOrderId(null);
        setView('orders');
    };

    const openOrder = (orderId: number) => {
        setSelectedOrderId(orderId);
        setView('works');
    };

    const goBack = () => {
        if (view === 'works') {
            setSelectedOrderId(null);
            setView('orders');
            return;
        }
        if (view === 'orders') {
            setSelectedDeptId(null);
            setSelectedOrderId(null);
            setView(deptIdsFromProfile.length === 1 ? 'orders' : 'depts');
            if (deptIdsFromProfile.length === 1) {
                setSelectedDeptId(deptIdsFromProfile[0]);
            }
        }
    };

    const renderWorkRow = (work: OrderWork) => {
        const activeLog = getMyActiveLog(work);
        const otherWorkersCount = Math.max(0, getActiveWorkersCount(work) - (activeLog?.status === 'STARTED' ? 1 : 0));
        const isDone = work.workStatus === 'DONE';
        const canStartByQueue = work.canStartByQueue !== false;
        const queueViewStatus = work.queueViewStatus ?? (canStartByQueue ? 'READY' : 'WAITING_QUEUE');
        const waitingQueue = !canStartByQueue || queueViewStatus === 'WAITING_QUEUE';

        return (
            <div
                key={work.id}
                className={`${styles.workRow} ${activeLog?.status === 'STARTED' ? styles.workCardStarted : ''} ${activeLog?.status === 'PAUSED' ? styles.workCardPaused : ''} ${isDone ? styles.workCardDone : ''} ${waitingQueue ? styles.workCardWaiting : styles.workCardReady}`}
            >
                <div className={styles.workHeader}>
                    <div className={styles.workHeaderMain}>
                        <div className={`${styles.workTitle} ${styles.workTitleBlue}`}>{work.workName}</div>
                        <div className={styles.workOrder}>Иш #{work.lineIndex}</div>
                    </div>
                    <div className={styles.statusColumn}>
                        <span
                            className={styles.statusBadge}
                            style={{ background: STATUS_COLOR[work.workStatus] }}
                        >
                            {WORK_STATUS_LABELS[work.workStatus]}
                        </span>
                        {otherWorkersCount > 0 && (
                            <span className={styles.activeWorkersBadge}>{otherWorkersCount} чел.</span>
                        )}
                    </div>
                </div>

                <div className={styles.workMeta}>
                    {work.countInOrder != null && <span>Режа: {work.countInOrder}{work.unit ? ` ${work.unit}` : ''}</span>}
                </div>
                {waitingQueue && !activeLog && !isDone && (
                    <div className={styles.queueHint}>Ожидает очередь по технологик харита</div>
                )}

                {!isDone && !waitingQueue && myWorkerId != null && (
                    <div className={styles.actions}>
                        {!activeLog && (
                            <button className={styles.btnStart} onClick={() => handleStart(work)} disabled={busy}>
                                ▶ Бошлаш
                            </button>
                        )}
                        {activeLog?.status === 'STARTED' && (
                            <div className={styles.actionsTwoCols}>
                                <button className={styles.btnPause} onClick={() => handlePause(activeLog)} disabled={busy}>⏸ Пауза</button>
                                <button className={styles.btnFinish} onClick={() => handleFinish(work, activeLog)} disabled={busy}>✓ Якунлаш</button>
                            </div>
                        )}
                        {activeLog?.status === 'PAUSED' && (
                            <div className={styles.actionsTwoCols}>
                                <button className={styles.btnStart} onClick={() => handleStart(work)} disabled={busy}>▶ Давом эттириш</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (deptIdsFromProfile.length === 0 && (!visibleWorkshops || visibleWorkshops.length === 0)) return (
        <div className={styles.container}>
            <div className={styles.header}><h2>Менинг ишларим</h2></div>
            <div className={styles.empty}>Сизнинг профилингизда цехлар кўрсатилмаган. Администраторга мурожаат қилинг.</div>
        </div>
    );

    if (deptIdsFromProfile.length > 0 && (!visibleWorkshops || visibleWorkshops.length === 0)) return (
        <div className={styles.container}>
            <div className={styles.header}><h2>Менинг ишларим</h2></div>
            <div className={styles.empty}>
                Сизга рухсат берилган цехлар топилмади. Рухсат берилган омборхоналар рўйхатини текширинг (фақат PRODUCTION туридаги цехлар чиқади).
            </div>
            <div className={`${styles.empty} ${styles.debugBox}`}>
                <div>Диагностика:</div>
                <div>enterpriseId: {user?.enterpriseId ?? 'null'}</div>
                <div>apiDomain: {getApiDomain() || '—'}</div>
                <div>allowedStorageIds: {deptIdsFromProfile.length ? deptIdsFromProfile.join(', ') : '—'}</div>
                <div>PRODUCTION_DEPTS ids: {availableWorkshopIds.length ? availableWorkshopIds.join(', ') : '—'}</div>
                <div>Пересечение: {matchedAllowedIds.length ? matchedAllowedIds.join(', ') : 'пусто'}</div>
                <div>workshopsError: {workshopsError?.message || '—'}</div>
            </div>
        </div>
    );

    const selectedOrder = selectedOrderId != null ? ordersDetails?.[selectedOrderId] : undefined;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Менинг ишларим</h2>
                <p>
                    {view === 'depts' && 'Цехни танланг'}
                    {view === 'orders' && `Цех: ${selectedWorkshopName}`}
                    {view === 'works' && selectedOrder && (
                        <>Заказ #{selectedOrder.orderNumber} · {(selectedOrder.client?.name || '—').toUpperCase()}</>
                    )}
                </p>
                {view !== 'depts' && (deptIdsFromProfile.length !== 1 || view === 'works') && (
                    <div className={styles.headerActions}>
                        {view === 'orders' && selectedDeptId && (
                            <div className={styles.currentWorkshopBadge}>
                                Жорий цех: {selectedWorkshopName}
                            </div>
                        )}
                        <button className={styles.backToWorkshopsBtn} onClick={goBack}>
                            ← Ортга
                        </button>
                    </div>
                )}
            </div>

            {view === 'depts' && (
                <div className={styles.deptGrid}>
                    {(visibleWorkshops || []).map((shop: any) => (
                        <div key={shop.id} className={styles.workCard}>
                            <div className={styles.workHeader}>
                                <div>
                                    <div className={styles.workTitle}>{shop.name}</div>
                                    <div className={styles.workOrder}>Цех #{shop.id}</div>
                                </div>
                            </div>
                            <div className={styles.actions}>
                                <button className={styles.btnStart} onClick={() => openDept(Number(shop.id))}>
                                    Ишларни очиш
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {view === 'orders' && selectedDeptId && (
                <>
                    {error && <div style={{ color: 'red', padding: 20 }}>Хатолик: {error.message}</div>}
                    {!works && !error && <div className={styles.loading}>Юкланмоқда...</div>}
                    {works && worksByOrder.length === 0 && <div className={styles.empty}>Ҳозирча ишлар йўқ</div>}
                    {worksByOrder.length > 0 && (
                        <div className={styles.orderList}>
                            {worksByOrder.map(({ orderId, works: orderWorks }) => {
                                const activeCount = orderWorks.filter((w) => w.workStatus !== 'DONE').length;
                                const readyCount = orderWorks.filter((w) => w.canStartByQueue !== false && w.workStatus !== 'DONE').length;
                                return (
                                    <button
                                        key={orderId}
                                        type="button"
                                        className={`${styles.orderRowBtn} ${readyCount > 0 ? styles.orderCardReady : styles.orderCardWaiting}`}
                                        onClick={() => openOrder(orderId)}
                                    >
                                        <div className={styles.orderRowTop}>
                                            <span className={styles.orderNumber}>Заказ #{ordersDetails?.[orderId]?.orderNumber ?? orderId}</span>
                                            <span className={styles.orderWorksBadge}>{activeCount} иш</span>
                                        </div>
                                        <div className={styles.orderProductName}>
                                            {(ordersDetails?.[orderId]?.analitic?.name || 'НАИМЕНОВАНИЕ НЕ УКАЗАНО').toUpperCase()}
                                        </div>
                                        <div className={styles.orderClientName}>
                                            Мижоз: {(ordersDetails?.[orderId]?.client?.name || 'КЛИЕНТ НЕ УКАЗАН').toUpperCase()}
                                        </div>
                                        <div className={styles.orderDates}>
                                            <span>Топшириш: {formatDate(ordersDetails?.[orderId]?.deadlineDate)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {view === 'works' && selectedOrderId != null && (
                <div className={styles.worksLevel}>
                    <div className={styles.orderHeader}>
                        <div className={styles.orderNumber}>Заказ #{selectedOrder?.orderNumber ?? selectedOrderId}</div>
                        <div className={styles.orderProductName}>
                            {(selectedOrder?.analitic?.name || '—').toUpperCase()}
                        </div>
                        <div className={styles.orderClientName}>
                            Мижоз: {(selectedOrder?.client?.name || '—').toUpperCase()}
                        </div>
                        <div className={styles.orderDates}>
                            <span>Сана: {formatDate(selectedOrder?.orderDate ?? selectedOrder?.createdDate)}</span>
                            <span>Топшириш муддати: {formatDate(selectedOrder?.deadlineDate)}</span>
                        </div>
                    </div>
                    <div className={styles.orderWorksList}>
                        {selectedOrderWorks.length === 0 ? (
                            <div className={styles.empty}>Ишлар топилмади</div>
                        ) : (
                            selectedOrderWorks.map(renderWorkRow)
                        )}
                    </div>
                </div>
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
