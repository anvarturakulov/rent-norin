'use client';

import { useEffect, useState } from 'react';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { OrderWork, OrderWorkLog } from '@/app/interfaces/furnitureOrder.interface';
import { getActiveLogForWorker, getWorkPlannedCount } from './workExecutionHelpers';

export type FinishWorkTarget = { work: OrderWork; log: OrderWorkLog };

export function useWorkExecution(params: {
    token: string;
    userId: number;
    onRefresh: () => Promise<unknown>;
}) {
    const { token, userId, onRefresh } = params;

    const [busy, setBusy] = useState(false);
    const [finishTarget, setFinishTarget] = useState<FinishWorkTarget | null>(null);
    const [myWorkerId, setMyWorkerId] = useState<number | null>(null);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        foApi
            .getMyWorker(token)
            .then((res) => {
                if (!cancelled) setMyWorkerId(Number(res.workerId));
            })
            .catch(() => {
                if (!cancelled) setMyWorkerId(null);
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    const handleStart = async (work: OrderWork) => {
        setBusy(true);
        try {
            await foApi.startWork(token, {
                orderId: work.orderId,
                workId: work.id,
                date: Date.now(),
            });
            await onRefresh();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const handlePause = async (log: OrderWorkLog) => {
        setBusy(true);
        try {
            await foApi.pauseWork(token, log.id);
            await onRefresh();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleFinish = (work: OrderWork, log: OrderWorkLog) => {
        setFinishTarget({ work, log });
    };

    const closeFinishModal = () => {
        if (!busy) setFinishTarget(null);
    };

    const confirmFinish = async () => {
        if (!finishTarget) return;
        const { work, log } = finishTarget;
        const countFact = getWorkPlannedCount(work);
        if (countFact == null) return;

        setBusy(true);
        try {
            await foApi.finishWork(token, log.id, userId, { countFact });
            setFinishTarget(null);
            await onRefresh();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const getMyActiveLog = (work: OrderWork) =>
        getActiveLogForWorker(work, myWorkerId);

    return {
        busy,
        finishTarget,
        myWorkerId,
        handleStart,
        handlePause,
        handleFinish,
        closeFinishModal,
        confirmFinish,
        getMyActiveLog,
    };
}
