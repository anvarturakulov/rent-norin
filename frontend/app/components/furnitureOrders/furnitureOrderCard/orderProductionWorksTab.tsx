'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './orderProductionWorksTab.module.css';
import {
    FurnitureOrder,
    OrderProductionQueue,
    OrderWork,
    QueueStatus,
    WORK_STATUS_LABELS,
} from '@/app/interfaces/furnitureOrder.interface';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { useWorkExecution } from '@/app/components/furnitureOrders/productionWorkBoard/useWorkExecution';
import {
    getActiveWorkersCount,
    STATUS_COLOR,
} from '@/app/components/furnitureOrders/productionWorkBoard/workExecutionHelpers';
import FinishWorkQtyModal from '@/app/components/furnitureOrders/FinishWorkQtyModal';

type QueueActionKind = 'ACTIVATE' | 'COMPLETE' | 'RESET_PENDING' | 'RECALCULATE';

interface Props {
    order: FurnitureOrder;
    token: string;
    userId: number;
    canManageQueue?: boolean;
    onOrderUpdated?: (order: FurnitureOrder) => void;
}

interface DeptSection {
    deptId: number;
    deptName: string;
    sequence: number;
    queueStatus: QueueStatus;
    works: OrderWork[];
}

interface PendingQueueAction {
    action: QueueActionKind;
    deptId?: number;
    deptName?: string;
    blockerMessage: string;
}

const QUEUE_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Кутилмоқда',
    ACTIVE: 'Жараёнда',
    DONE: 'Тугатилди',
};

const QUEUE_STATUS_CLASS: Record<string, string> = {
    PENDING: styles.queueStatusPending,
    ACTIVE: styles.queueStatusActive,
    DONE: styles.queueStatusDone,
};

const SECTION_CLASS: Record<string, string> = {
    PENDING: styles.sectionPending,
    ACTIVE: styles.sectionActive,
    DONE: styles.sectionDone,
};

function enrichWorksWithQueue(
    works: OrderWork[],
    productionQueue: OrderProductionQueue[],
): OrderWork[] {
    const activeDeptIds = new Set(
        productionQueue
            .filter((q) => q.status === 'ACTIVE')
            .map((q) => Number(q.deptId)),
    );
    return works.map((work) => {
        const deptId = Number(work.assignedDeptId ?? work.assignedDept?.id ?? 0);
        const canStartByQueue = activeDeptIds.has(deptId);
        return {
            ...work,
            canStartByQueue,
            queueViewStatus: canStartByQueue ? ('READY' as const) : ('WAITING_QUEUE' as const),
        };
    });
}

function buildDeptSections(order: FurnitureOrder, works: OrderWork[]): DeptSection[] {
    const queue = (order.productionQueue ?? [])
        .slice()
        .sort((a, b) => Number(a.sequence) - Number(b.sequence));
    const enriched = enrichWorksWithQueue(works, order.productionQueue ?? []);

    return queue.map((q) => {
        const deptId = Number(q.deptId);
        const deptWorks = enriched
            .filter((w) => Number(w.assignedDeptId ?? w.assignedDept?.id) === deptId)
            .sort((a, b) => {
                const aIndex = a.lineIndex ?? Number.MAX_SAFE_INTEGER;
                const bIndex = b.lineIndex ?? Number.MAX_SAFE_INTEGER;
                if (aIndex !== bIndex) return aIndex - bIndex;
                return a.id - b.id;
            });

        const filteredWorks =
            q.status === 'DONE'
                ? deptWorks
                : deptWorks.filter((w) => w.workStatus !== 'DONE');

        return {
            deptId,
            deptName: q.dept?.name?.trim() || `Цех #${deptId}`,
            sequence: Number(q.sequence),
            queueStatus: q.status,
            works: filteredWorks,
        };
    });
}

function buildOrphanWorks(order: FurnitureOrder, works: OrderWork[]): OrderWork[] {
    const queueDeptIds = new Set(
        (order.productionQueue ?? [])
            .map((q) => Number(q.deptId))
            .filter((id) => Number.isFinite(id)),
    );
    return works
        .filter((work) => {
            if (work.workStatus === 'DONE') return false;
            const deptId = Number(work.assignedDeptId ?? work.assignedDept?.id ?? 0);
            return Number.isFinite(deptId) && deptId > 0 && !queueDeptIds.has(deptId);
        })
        .sort((a, b) => {
            const aIndex = a.lineIndex ?? Number.MAX_SAFE_INTEGER;
            const bIndex = b.lineIndex ?? Number.MAX_SAFE_INTEGER;
            if (aIndex !== bIndex) return aIndex - bIndex;
            return a.id - b.id;
        });
}

export default function OrderProductionWorksTab({
    order,
    token,
    userId,
    canManageQueue = false,
    onOrderUpdated,
}: Props) {
    const [queueBusy, setQueueBusy] = useState(false);
    const [actionWarnings, setActionWarnings] = useState<string[]>([]);
    const [forceModal, setForceModal] = useState<PendingQueueAction | null>(null);
    const [forceComment, setForceComment] = useState('');
    const [forceChecked, setForceChecked] = useState(false);

    const worksKey = token && order.id ? ['order-production-works', order.id, token] : null;
    const {
        data: worksRaw,
        mutate: mutateWorks,
        error: worksError,
        isLoading,
    } = useSWR(worksKey, () => foApi.getWorksByOrder(token, order.id));

    const onRefresh = useCallback(async () => {
        await mutateWorks();
        const updated = await foApi.getOrder(token, order.id);
        onOrderUpdated?.(updated);
    }, [mutateWorks, onOrderUpdated, order.id, token]);

    const execution = useWorkExecution({ token, userId, onRefresh });
    const {
        busy,
        finishTarget,
        myWorkerId,
        handleStart,
        handlePause,
        handleFinish,
        closeFinishModal,
        confirmFinish,
        getMyActiveLog,
    } = execution;

    const showQueueControls =
        canManageQueue && order.currentStage === 'IN_PRODUCTION';

    const runQueueAction = useCallback(
        async (
            action: QueueActionKind,
            options?: { deptId?: number; comment?: string; force?: boolean },
        ) => {
            setQueueBusy(true);
            try {
                const result = await foApi.productionQueueAction(token, order.id, {
                    action,
                    deptId: options?.deptId,
                    userId,
                    comment: options?.comment,
                    force: options?.force,
                });
                if (result.warnings.length > 0) {
                    setActionWarnings(result.warnings);
                }
                onOrderUpdated?.(result.order);
                await mutateWorks();
                return true;
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Ошибка действия с очередью';
                throw new Error(message);
            } finally {
                setQueueBusy(false);
            }
        },
        [mutateWorks, onOrderUpdated, order.id, token, userId],
    );

    const handleQueueActionClick = useCallback(
        async (action: QueueActionKind, section?: DeptSection) => {
            try {
                await runQueueAction(action, { deptId: section?.deptId });
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Ошибка действия с очередью';
                setForceModal({
                    action,
                    deptId: section?.deptId,
                    deptName: section?.deptName,
                    blockerMessage: message,
                });
                setForceComment('');
                setForceChecked(false);
            }
        },
        [runQueueAction],
    );

    const confirmForceAction = useCallback(async () => {
        if (!forceModal || !forceChecked || !forceComment.trim()) return;
        try {
            await runQueueAction(forceModal.action, {
                deptId: forceModal.deptId,
                comment: forceComment.trim(),
                force: true,
            });
            setForceModal(null);
            setForceComment('');
            setForceChecked(false);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Ошибка принудительного действия';
            setForceModal((prev) =>
                prev ? { ...prev, blockerMessage: message } : null,
            );
        }
    }, [forceChecked, forceComment, forceModal, runQueueAction]);

    const sections = useMemo(
        () => buildDeptSections(order, (worksRaw as OrderWork[] | undefined) ?? []),
        [order, worksRaw],
    );

    const orphanWorks = useMemo(
        () => buildOrphanWorks(order, (worksRaw as OrderWork[] | undefined) ?? []),
        [order, worksRaw],
    );

    const renderSectionQueueActions = (section: DeptSection) => {
        if (!showQueueControls) return null;

        const disabled = queueBusy || busy;

        if (section.queueStatus === 'PENDING') {
            return (
                <button
                    type="button"
                    className={styles.queueAdminBtn}
                    disabled={disabled}
                    onClick={() => handleQueueActionClick('ACTIVATE', section)}
                >
                    Активлаш
                </button>
            );
        }
        if (section.queueStatus === 'ACTIVE') {
            return (
                <button
                    type="button"
                    className={styles.queueAdminBtn}
                    disabled={disabled}
                    onClick={() => handleQueueActionClick('COMPLETE', section)}
                >
                    Тугатиш / утказиб юбориш
                </button>
            );
        }
        return (
            <button
                type="button"
                className={styles.queueAdminBtn}
                disabled={disabled}
                onClick={() => handleQueueActionClick('RESET_PENDING', section)}
            >
                Вернуть в ожидание
            </button>
        );
    };

    const renderActions = (work: OrderWork, queueStatus: QueueStatus) => {
        const isDone = work.workStatus === 'DONE';
        if (isDone) return <span>—</span>;

        if (myWorkerId == null) {
            return <span className={styles.queueHint}>Ишчи профили богланмаган</span>;
        }

        const myLog = getMyActiveLog(work);
        const canStartByQueue = work.canStartByQueue !== false && queueStatus === 'ACTIVE';
        const waitingQueue = !canStartByQueue && !myLog;

        if (waitingQueue) {
            return <span className={styles.queueHint}>Навбат (техкарта)</span>;
        }

        return (
            <div className={styles.actions}>
                {!myLog && (
                    <button
                        type="button"
                        className={`${styles.btnAction} ${styles.btnStart}`}
                        disabled={busy}
                        onClick={() => handleStart(work)}
                    >
                        Бошлаш
                    </button>
                )}
                {myLog?.status === 'STARTED' && (
                    <div className={styles.actionsPair}>
                        <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnPause}`}
                            disabled={busy}
                            onClick={() => handlePause(myLog)}
                        >
                            Пауза
                        </button>
                        <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnFinish}`}
                            disabled={busy}
                            onClick={() => handleFinish(work, myLog)}
                        >
                            Якунлаш
                        </button>
                    </div>
                )}
                {myLog?.status === 'PAUSED' && (
                    <button
                        type="button"
                        className={`${styles.btnAction} ${styles.btnStart}`}
                        disabled={busy}
                        onClick={() => handleStart(work)}
                    >
                        Давом
                    </button>
                )}
            </div>
        );
    };

    const renderWorkRow = (work: OrderWork, queueStatus: QueueStatus) => {
        const myLog = getMyActiveLog(work);
        const otherWorkersCount = Math.max(
            0,
            getActiveWorkersCount(work) - (myLog?.status === 'STARTED' ? 1 : 0),
        );
        const isDone = work.workStatus === 'DONE';
        const waitingQueue =
            queueStatus !== 'ACTIVE' &&
            work.canStartByQueue === false &&
            !myLog &&
            !isDone;

        const rowClass = [
            isDone ? styles.rowDone : '',
            myLog?.status === 'STARTED' ? styles.rowStarted : '',
            myLog?.status === 'PAUSED' ? styles.rowPaused : '',
            waitingQueue ? styles.rowWaiting : '',
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <tr key={work.id} className={rowClass || undefined}>
                <td>{work.lineIndex ?? '—'}</td>
                <td>
                    <div className={styles.workName}>{work.workName}</div>
                </td>
                <td>
                    <div className={styles.statusCell}>
                        <span
                            className={styles.statusDot}
                            style={{ background: STATUS_COLOR[work.workStatus] }}
                        />
                        {WORK_STATUS_LABELS[work.workStatus]}
                    </div>
                </td>
                <td>
                    {work.countInOrder != null
                        ? `${work.countInOrder}${work.unit ? ` ${work.unit}` : ''}`
                        : '—'}
                </td>
                <td>
                    {otherWorkersCount > 0 ? (
                        <span className={styles.workersBadge}>{otherWorkersCount} чел.</span>
                    ) : (
                        '—'
                    )}
                </td>
                <td>{renderActions(work, queueStatus)}</td>
            </tr>
        );
    };

    if (isLoading) {
        return <div className={styles.loading}>Юкланмоқда...</div>;
    }

    if (worksError) {
        return <div className={styles.error}>Ишларни юклаб бўлмади</div>;
    }

    if (!order.productionQueue?.length) {
        return (
            <div className={styles.emptyGlobal}>
                Технологик харита бўш. Цехлар ketma-ketligini «Технологик харита» ёрлиғида belgilang.
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {showQueueControls && (
                <div className={styles.queueToolbar}>
                    <button
                        type="button"
                        className={styles.queueRecalcBtn}
                        disabled={queueBusy || busy}
                        onClick={() => handleQueueActionClick('RECALCULATE')}
                    >
                        Пересчитать очередь
                    </button>
                    <span className={styles.queueToolbarHint}>
                        Автоматически догоняет статусы цехов по завершённым ишам
                    </span>
                </div>
            )}

            {actionWarnings.length > 0 && (
                <div className={styles.queueWarningBanner}>
                    {actionWarnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                    ))}
                    <button
                        type="button"
                        className={styles.queueWarningDismiss}
                        onClick={() => setActionWarnings([])}
                    >
                        Ёпиш
                    </button>
                </div>
            )}

            {myWorkerId == null && (
                <div className={styles.workerWarning}>
                    Сизнинг профилингиз WORKERS справочнигига bog&apos;lanmagan. Бошлаш / Пауза / Якунлаш
                    учун администраторга murojaat qiling.
                </div>
            )}

            {sections.map((section) => (
                <div
                    key={`${section.deptId}-${section.sequence}`}
                    className={`${styles.section} ${SECTION_CLASS[section.queueStatus] ?? styles.sectionPending}`}
                >
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>{section.deptName}</div>
                        <div className={styles.sectionMeta}>
                            <span className={styles.sequenceBadge}>Босқич {section.sequence}</span>
                            <span
                                className={
                                    QUEUE_STATUS_CLASS[section.queueStatus] ?? styles.queueStatusPending
                                }
                            >
                                {QUEUE_STATUS_LABELS[section.queueStatus] ?? section.queueStatus}
                            </span>
                            {renderSectionQueueActions(section)}
                        </div>
                    </div>

                    {section.works.length === 0 ? (
                        <div className={styles.sectionEmpty}>
                            {section.queueStatus === 'DONE'
                                ? 'Бу цехда ишлар якунланган'
                                : 'Фаол ишлар йўқ'}
                        </div>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Иш номи</th>
                                        <th>Статус</th>
                                        <th>Миқдор</th>
                                        <th>Ишчилар</th>
                                        <th>Амаллар</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {section.works.map((work) =>
                                        renderWorkRow(work, section.queueStatus),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ))}

            {orphanWorks.length > 0 && (
                <div className={`${styles.section} ${styles.sectionPending}`}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>Ишлар техкартадан ташқари</div>
                    </div>
                    <p className={styles.queueHint}>
                        Бу ишлар ҳозирги технологик харитада йўқ. Уларни «Ишлар» ёрлиғида бошқа цехга
                        ўтказинг ёки ўчиринг. Омборни якунлаш уларга боғлиқ эмас.
                    </p>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Иш номи</th>
                                    <th>Цех</th>
                                    <th>Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orphanWorks.map((work) => (
                                    <tr key={work.id}>
                                        <td>{work.lineIndex ?? '—'}</td>
                                        <td>
                                            <div className={styles.workName}>
                                                {work.workName?.trim() || `Иш #${work.id}`}
                                            </div>
                                        </td>
                                        <td>
                                            {work.assignedDept?.name?.trim() ||
                                                (work.assignedDeptId
                                                    ? `ID ${work.assignedDeptId}`
                                                    : '—')}
                                        </td>
                                        <td>{WORK_STATUS_LABELS[work.workStatus] ?? work.workStatus}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {finishTarget && (
                <FinishWorkQtyModal
                    work={finishTarget.work}
                    busy={busy}
                    onConfirm={confirmFinish}
                    onClose={closeFinishModal}
                />
            )}

            {forceModal && (
                <div
                    className={styles.forceOverlay}
                    onClick={queueBusy ? undefined : () => setForceModal(null)}
                    role="presentation"
                >
                    <div
                        className={styles.forceDialog}
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.forceTitle}>Принудительное действие</div>
                        {forceModal.deptName && (
                            <div className={styles.forceDept}>{forceModal.deptName}</div>
                        )}
                        <p className={styles.forceMessage}>{forceModal.blockerMessage}</p>
                        <label className={styles.forceCheckLabel}>
                            <input
                                type="checkbox"
                                checked={forceChecked}
                                onChange={(e) => setForceChecked(e.target.checked)}
                            />
                            Подтверждаю принудительное действие
                        </label>
                        <textarea
                            className={styles.forceComment}
                            placeholder="Комментарий (обязателен)"
                            value={forceComment}
                            onChange={(e) => setForceComment(e.target.value)}
                            rows={3}
                        />
                        <div className={styles.forceActions}>
                            <button
                                type="button"
                                className={styles.forceCancelBtn}
                                disabled={queueBusy}
                                onClick={() => setForceModal(null)}
                            >
                                Бекор
                            </button>
                            <button
                                type="button"
                                className={styles.forceConfirmBtn}
                                disabled={
                                    queueBusy || !forceChecked || !forceComment.trim()
                                }
                                onClick={() => void confirmForceAction()}
                            >
                                Выполнить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
