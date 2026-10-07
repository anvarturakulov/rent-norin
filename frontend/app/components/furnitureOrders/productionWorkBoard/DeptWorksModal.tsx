'use client';

import { useEffect, useMemo } from 'react';
import {
    OrderWork,
    OrderWorkLog,
    ProductionBoardOrder,
} from '@/app/interfaces/furnitureOrder.interface';
import styles from './productionWorkBoard.module.css';
import WorkCellActions from './WorkCellActions';
import { formatBoardDate, isWorkWaitingOrActive } from './workExecutionHelpers';

interface Props {
    order: ProductionBoardOrder;
    deptId: number;
    deptName: string;
    myWorkerId?: number | null;
    canExecuteActions: boolean;
    busy: boolean;
    onStart: (work: OrderWork) => void;
    onPause: (log: OrderWorkLog) => void;
    onFinish: (work: OrderWork, log: OrderWorkLog) => void;
    onClose: () => void;
}

function getDeptWorks(order: ProductionBoardOrder, deptId: number) {
    return order.works.filter((w) => {
        const assignedId = Number(w.assignedDeptId ?? w.assignedDept?.id);
        return assignedId === deptId && isWorkWaitingOrActive(w);
    });
}

export default function DeptWorksModal({
    order,
    deptId,
    deptName,
    myWorkerId,
    canExecuteActions,
    busy,
    onStart,
    onPause,
    onFinish,
    onClose,
}: Props) {
    const deptWorks = useMemo(() => getDeptWorks(order, deptId), [order, deptId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            className={styles.overlay}
            onClick={onClose}
            role="presentation"
        >
            <div
                className={`${styles.modal} ${styles.deptWorksModal}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dept-works-modal-title"
            >
                <div className={styles.modalHeader}>
                    <div>
                        <h3 id="dept-works-modal-title" className={styles.modalTitle}>
                            {deptName}
                        </h3>
                        <div className={styles.modalOrderMeta}>
                            <span>Заказ #{order.orderNumber}</span>
                            <span>{(order.productName || '—').toUpperCase()}</span>
                            <span>Мижоз: {(order.clientName || '—').toUpperCase()}</span>
                            <span>Муддат: {formatBoardDate(order.deadlineDate)}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={styles.modalCloseBtn}
                        onClick={onClose}
                        aria-label="Yopish"
                    >
                        ×
                    </button>
                </div>

                {deptWorks.length === 0 ? (
                    <div className={styles.modalEmpty}>Бу цехда фаол ишлар йўқ</div>
                ) : (
                    <div className={styles.modalWorksList}>
                        {deptWorks.map((work) => (
                            <div key={work.id} className={styles.modalWorkRow}>
                                <WorkCellActions
                                    work={work}
                                    deptId={deptId}
                                    myWorkerId={myWorkerId}
                                    canExecuteActions={canExecuteActions}
                                    busy={busy}
                                    onStart={onStart}
                                    onPause={onPause}
                                    onFinish={onFinish}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
