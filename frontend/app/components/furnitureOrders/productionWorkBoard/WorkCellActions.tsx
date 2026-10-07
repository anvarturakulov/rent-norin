'use client';

import { OrderWork } from '@/app/interfaces/furnitureOrder.interface';
import { WORK_STATUS_LABELS } from '@/app/interfaces/furnitureOrder.interface';
import styles from './productionWorkBoard.module.css';
import {
    STATUS_COLOR,
    getActiveLogForWorker,
    getActiveWorkersCount,
} from './workExecutionHelpers';

interface Props {
    work: OrderWork;
    deptId: number;
    myWorkerId?: number | null;
    canExecuteActions: boolean;
    busy: boolean;
    onStart: (work: OrderWork) => void;
    onPause: (log: import('@/app/interfaces/furnitureOrder.interface').OrderWorkLog) => void;
    onFinish: (work: OrderWork, log: import('@/app/interfaces/furnitureOrder.interface').OrderWorkLog) => void;
}

export default function WorkCellActions({
    work,
    deptId,
    myWorkerId,
    canExecuteActions,
    busy,
    onStart,
    onPause,
    onFinish,
}: Props) {
    const assignedId = Number(work.assignedDeptId ?? work.assignedDept?.id ?? 0);
    if (assignedId !== deptId) {
        return <span className={styles.cellEmpty}>—</span>;
    }

    const myLog = getActiveLogForWorker(work, myWorkerId);
    const activeWorkersCount = getActiveWorkersCount(work);
    const otherWorkersCount =
        myLog?.status === 'STARTED'
            ? Math.max(0, activeWorkersCount - 1)
            : activeWorkersCount;

    const isDone = work.workStatus === 'DONE';
    const canStartByQueue = work.canStartByQueue !== false;
    const waitingQueue = !canStartByQueue && !myLog && !isDone;

    const hasQty = work.countInOrder != null || work.lineIndex != null;

    return (
        <div
            className={`${styles.workCard} ${myLog?.status === 'STARTED' ? styles.cellStarted : ''} ${myLog?.status === 'PAUSED' ? styles.cellPaused : ''} ${waitingQueue ? styles.cellWaiting : ''}`}
        >
            <div className={styles.workCardStatusRow}>
                <span
                    className={styles.statusDot}
                    style={{ background: STATUS_COLOR[work.workStatus] }}
                />
                <span className={styles.workCardStatusLabel}>
                    {WORK_STATUS_LABELS[work.workStatus]}
                </span>
                {otherWorkersCount > 0 && (
                    <span className={styles.activeWorkersBadge}>
                        {otherWorkersCount} чел.
                    </span>
                )}
            </div>

            <div className={styles.workCardTitle} title={work.workName}>
                {work.workName}
            </div>

            {hasQty && (
                <div className={styles.workCardQty}>
                    {work.countInOrder != null && (
                        <span>
                            <strong>Миқдор:</strong> {work.countInOrder}
                            {work.unit ? ` ${work.unit}` : ''}
                        </span>
                    )}
                    {work.lineIndex != null && (
                        <span className={styles.workCardLine}>#{work.lineIndex}</span>
                    )}
                </div>
            )}

            {waitingQueue && <div className={styles.queueHint}>Навбат (техкарта)</div>}

            <div className={styles.workCardActions}>
                {!isDone && !waitingQueue && canExecuteActions && myWorkerId != null && (
                    <>
                        {!myLog && (
                            <button
                                type="button"
                                className={`${styles.btnAction} ${styles.btnStart}`}
                                disabled={busy}
                                onClick={() => onStart(work)}
                            >
                                Бошлаш
                            </button>
                        )}
                        {myLog?.status === 'STARTED' && (
                            <div className={styles.workCardActionsPair}>
                                <button
                                    type="button"
                                    className={`${styles.btnAction} ${styles.btnPause}`}
                                    disabled={busy}
                                    onClick={() => onPause(myLog)}
                                >
                                    Пауза
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.btnAction} ${styles.btnFinish}`}
                                    disabled={busy}
                                    onClick={() => onFinish(work, myLog)}
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
                                onClick={() => onStart(work)}
                            >
                                Давом
                            </button>
                        )}
                    </>
                )}

                {!canExecuteActions && !isDone && (
                    <span className={styles.readOnlyHint}>Фақат кўриш</span>
                )}
            </div>
        </div>
    );
}
