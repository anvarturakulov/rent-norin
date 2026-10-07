import {
    CreateFurnitureOrderPayload,
    FurnitureOrder,
    MyWorkerResponse,
    OrderMaterial,
    OrderHalfstuff,
    normalizeOrderStage,
    OrderStageType,
    OrderWork,
    ProductionBoardResponse,
    UpdateFurnitureOrderPayload,
    WorkLeaveMaterialJournal,
    WorkTimeReportResponse,
    StoreWorkResponse,
    WriteoffStocksResponse,
} from '@/app/interfaces/furnitureOrder.interface';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';

const BASE = () => withApiDomain('/api');

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
    let message = fallback;
    try {
        const body = await res.json();
        if (typeof body?.message === 'string') message = body.message;
        else if (Array.isArray(body?.message)) message = body.message.join('. ');
    } catch {
        const text = await res.text().catch(() => '');
        if (text) message = text;
    }
    return message;
}

const normalizeOrder = (order: FurnitureOrder): FurnitureOrder => {
    const normalizedCurrentStage = normalizeOrderStage(order.currentStage) ?? 'TALABGOR';
    const normalizedPipelineStages = order.pipelineStages?.map((stage) => ({
        ...stage,
        stageName: normalizeOrderStage(stage.stageName) ?? 'TEXNOLOG',
    }));
    const normalizedHistory = order.stageHistory?.map((item) => ({
        ...item,
        fromStage: normalizeOrderStage(item.fromStage),
        toStage: normalizeOrderStage(item.toStage),
    }));

    return {
        ...order,
        currentStage: normalizedCurrentStage,
        pipelineStages: normalizedPipelineStages,
        stageHistory: normalizedHistory,
    };
};

const headers = (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
});

export const foApi = {
    getOrders: async (
        token: string,
        enterpriseId: number,
        stage?: string,
        clientId?: number,
        options?: {
            dateStart?: number;
            dateEnd?: number;
            excludeCompleted?: boolean;
        },
    ): Promise<FurnitureOrder[]> => {
        const clientParam = clientId != null ? `&clientId=${clientId}` : '';
        const dateStartParam =
            options?.dateStart != null ? `&dateStart=${options.dateStart}` : '';
        const dateEndParam =
            options?.dateEnd != null ? `&dateEnd=${options.dateEnd}` : '';
        const excludeParam = options?.excludeCompleted
            ? '&excludeCompleted=true'
            : '';
        const url = `${BASE()}/furniture-orders?enterpriseId=${enterpriseId}${stage ? `&stage=${stage}` : ''}${clientParam}${dateStartParam}${dateEndParam}${excludeParam}`;
        const res = await fetch(url, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки заявок');
        const data: FurnitureOrder[] = await res.json();
        return data.map(normalizeOrder);
    },

    getOrder: async (token: string, id: number): Promise<FurnitureOrder> => {
        const res = await fetch(`${BASE()}/furniture-orders/${id}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Заявка не найдена');
        return normalizeOrder(await res.json());
    },

    createOrder: async (token: string, payload: CreateFurnitureOrderPayload): Promise<FurnitureOrder> => {
        const res = await fetch(`${BASE()}/furniture-orders`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Ошибка создания заявки');
        return normalizeOrder(await res.json());
    },

    updateOrder: async (token: string, id: number, data: UpdateFurnitureOrderPayload): Promise<FurnitureOrder> => {
        const res = await fetch(`${BASE()}/furniture-orders/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Ошибка обновления заявки');
        return normalizeOrder(await res.json());
    },

    deleteOrder: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/furniture-orders/${id}`, {
            method: 'DELETE',
            headers: headers(token),
        });
        if (!res.ok) {
            throw new Error(await readApiErrorMessage(res, 'Ошибка удаления заявки'));
        }
    },

    updateProductionQueue: async (
        token: string,
        id: number,
        items: Array<{ deptId: number; sequence: number }>,
    ): Promise<FurnitureOrder> => {
        const res = await fetch(`${BASE()}/furniture-orders/${id}/production-queue`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify({ items }),
        });
        if (!res.ok) {
            throw new Error(await readApiErrorMessage(res, 'Ошибка обновления техкарты цехов'));
        }
        return normalizeOrder(await res.json());
    },

    productionQueueAction: async (
        token: string,
        orderId: number,
        payload: {
            action: 'ACTIVATE' | 'COMPLETE' | 'RESET_PENDING' | 'RECALCULATE';
            deptId?: number;
            userId: number;
            comment?: string;
            force?: boolean;
        },
    ): Promise<{ order: FurnitureOrder; warnings: string[] }> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/production-queue/action`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            throw new Error(await readApiErrorMessage(res, 'Ошибка действия с очередью цехов'));
        }
        const data = await res.json();
        return {
            order: normalizeOrder(data.order),
            warnings: Array.isArray(data.warnings) ? data.warnings : [],
        };
    },

    advanceStage: async (token: string, id: number, userId: number, comment?: string): Promise<FurnitureOrder> => {
        const res = await fetch(`${BASE()}/furniture-orders/${id}/advance`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({ userId, comment }),
        });
        if (!res.ok) {
            throw new Error(await readApiErrorMessage(res, 'Ошибка перехода этапа'));
        }
        return normalizeOrder(await res.json());
    },

    revertStage: async (token: string, id: number, userId: number, comment?: string): Promise<FurnitureOrder> => {
        const res = await fetch(`${BASE()}/furniture-orders/${id}/revert`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({ userId, comment }),
        });
        if (!res.ok) {
            throw new Error(await readApiErrorMessage(res, 'Ошибка возврата на предыдущий этап'));
        }
        return normalizeOrder(await res.json());
    },

    importFromCard: async (token: string, id: number): Promise<FurnitureOrder> => {
        const res = await fetch(`${BASE()}/furniture-orders/${id}/import-from-card`, {
            method: 'POST',
            headers: headers(token),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка импорта из карточки');
        }
        return normalizeOrder(await res.json());
    },

    getWorksByOrder: async (token: string, orderId: number): Promise<OrderWork[]> => {
        const res = await fetch(`${BASE()}/order-works?orderId=${orderId}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки работ');
        return res.json();
    },

    createWork: async (token: string, data: Partial<OrderWork> & { orderId: number }): Promise<OrderWork> => {
        const res = await fetch(`${BASE()}/order-works`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Ошибка создания работы');
        return res.json();
    },

    updateWork: async (token: string, id: number, data: Partial<OrderWork>): Promise<OrderWork> => {
        const res = await fetch(`${BASE()}/order-works/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Ошибка обновления работы');
        return res.json();
    },

    deleteWork: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/order-works/${id}`, { method: 'DELETE', headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка удаления работы');
    },

    /** Полный список id работ заявки в нужном порядке строк */
    setWorksLineOrder: async (token: string, orderId: number, workIds: number[]): Promise<void> => {
        const res = await fetch(`${BASE()}/order-works/order/${orderId}/line-order`, {
            method: 'PUT',
            headers: headers(token),
            body: JSON.stringify({ workIds }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            const hint = body ? ` — ${body.slice(0, 280)}` : '';
            throw new Error(`Ошибка сохранения порядка работ${hint}`);
        }
    },

    getMaterialsByOrder: async (token: string, orderId: number): Promise<OrderMaterial[]> => {
        const res = await fetch(`${BASE()}/order-materials?orderId=${orderId}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки материалов');
        return res.json();
    },

    createMaterial: async (
        token: string,
        data: {
            orderId: number;
            materialId: number;
            price?: number;
            countPlanned?: number;
            finishedProductQty?: number;
            countInOrder?: number;
            total?: number;
        },
    ): Promise<OrderMaterial> => {
        const res = await fetch(`${BASE()}/order-materials`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Ошибка создания материала');
        return res.json();
    },

    deleteMaterial: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/order-materials/${id}`, { method: 'DELETE', headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка удаления материала');
    },

    updateMaterial: async (
        token: string,
        id: number,
        data: {
            materialId?: number;
            price?: number;
            countPlanned?: number;
            finishedProductQty?: number;
            countInOrder?: number;
            total?: number;
        },
    ): Promise<OrderMaterial> => {
        const res = await fetch(`${BASE()}/order-materials/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Ошибка обновления материала');
        return res.json();
    },

    getHalfstuffsByOrder: async (token: string, orderId: number): Promise<OrderHalfstuff[]> => {
        const res = await fetch(`${BASE()}/order-halfstuffs?orderId=${orderId}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки полуфабрикатов');
        return res.json();
    },

    createHalfstuff: async (
        token: string,
        data: {
            orderId: number;
            halfstuffId: number;
            price?: number;
            countPlanned?: number;
            finishedProductQty?: number;
            countInOrder?: number;
            total?: number;
        },
    ): Promise<OrderHalfstuff> => {
        const res = await fetch(`${BASE()}/order-halfstuffs`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Ошибка создания полуфабриката');
        return res.json();
    },

    deleteHalfstuff: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/order-halfstuffs/${id}`, { method: 'DELETE', headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка удаления полуфабриката');
    },

    updateHalfstuff: async (
        token: string,
        id: number,
        data: {
            halfstuffId?: number;
            price?: number;
            countPlanned?: number;
            finishedProductQty?: number;
            countInOrder?: number;
            total?: number;
        },
    ): Promise<OrderHalfstuff> => {
        const res = await fetch(`${BASE()}/order-halfstuffs/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Ошибка обновления полуфабриката');
        return res.json();
    },

    getWorksByDept: async (token: string, deptId: number): Promise<OrderWork[]> => {
        const res = await fetch(`${BASE()}/order-works/by-dept?deptId=${deptId}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки работ цеха');
        return res.json();
    },

    getProductionBoard: async (
        token: string,
        enterpriseId: number,
    ): Promise<ProductionBoardResponse> => {
        const res = await fetch(
            `${BASE()}/order-works/production-board?enterpriseId=${enterpriseId}`,
            { headers: headers(token) },
        );
        if (!res.ok) throw new Error('Ошибка загрузки доски производства');
        return res.json();
    },

    startWork: async (token: string, data: { orderId: number; workId: number; date: number }) => {
        const res = await fetch(`${BASE()}/order-work-logs/start`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || 'Ошибка старта работы');
        }
        return res.json();
    },

    getMyWorker: async (token: string): Promise<MyWorkerResponse> => {
        const res = await fetch(`${BASE()}/order-work-logs/my-worker`, {
            headers: headers(token),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || 'Не найден сотрудник для пользователя');
        }
        return res.json();
    },

    getWorkTimeReport: async (
        token: string,
        enterpriseId: number,
        dateFrom: number,
        dateTo: number,
    ): Promise<WorkTimeReportResponse> => {
        const res = await fetch(
            `${BASE()}/order-work-logs/time-report?enterpriseId=${enterpriseId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
            { headers: headers(token) },
        );
        if (!res.ok) throw new Error('Ошибка загрузки отчёта по времени');
        return res.json();
    },

    pauseWork: async (token: string, logId: number) => {
        const res = await fetch(`${BASE()}/order-work-logs/${logId}/pause`, {
            method: 'POST',
            headers: headers(token),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || 'Ошибка паузы');
        }
        return res.json();
    },

    finishWork: async (
        token: string,
        logId: number,
        userId: number,
        data: {
            workerIds?: number[];
            countFact?: number;
            notes?: string;
            materials?: { materialId: number; consumedQty: number; consumedTotal?: number }[];
            withoutMaterials?: boolean;
        },
    ) => {
        const res = await fetch(`${BASE()}/order-work-logs/${logId}/finish`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({ ...data, userId }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || 'Ошибка завершения работы');
        }
        return res.json();
    },

    getWorkLogsByOrder: async (token: string, orderId: number) => {
        const res = await fetch(`${BASE()}/order-work-logs/by-order?orderId=${orderId}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки логов заказа');
        return res.json();
    },

    createLeaveMaterialDoc: async (
        token: string,
        logId: number,
        data: { userId: number; senderId?: number; receiverId?: number; idempotencyKey?: string },
    ) => {
        const res = await fetch(`${BASE()}/order-work-logs/${logId}/create-leave-material-doc`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка создания документа списания');
        }
        return res.json();
    },

    getWorkLeaveMaterialJournal: async (token: string, workId: number): Promise<WorkLeaveMaterialJournal> => {
        const res = await fetch(`${BASE()}/order-works/${workId}/leave-material-documents`, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки журнала списаний');
        return res.json();
    },

    createWorkLeaveMaterialDoc: async (
        token: string,
        workId: number,
        data: {
            userId: number;
            senderId?: number;
            receiverId?: number;
            materialId: number;
            count: number;
            price: number;
            total: number;
            remainCount: number;
        },
    ) => {
        const res = await fetch(`${BASE()}/order-works/${workId}/leave-material`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка создания документа списания');
        }
        return res.json();
    },

    proveWorkLeaveMaterialDoc: async (token: string, workId: number) => {
        const res = await fetch(`${BASE()}/order-works/${workId}/leave-material/prove`, {
            method: 'POST',
            headers: headers(token),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка проведения документа');
        }
        return res.json();
    },

    getDeptLoadAnalysis: async (token: string, enterpriseId: number, currentOrderId: number) => {
        const url = `${BASE()}/furniture-orders/dept-load-analysis?enterpriseId=${enterpriseId}&currentOrderId=${currentOrderId}`;
        const res = await fetch(url, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки анализа загруженности');
        return res.json();
    },

    getSalaryReport: async (token: string, enterpriseId: number, dateFrom: number, dateTo: number) => {
        const url = `${BASE()}/furniture-orders/salary-report?enterpriseId=${enterpriseId}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        const res = await fetch(url, { headers: headers(token) });
        if (!res.ok) throw new Error('Ошибка загрузки отчёта ЗП');
        return res.json();
    },

    // type: 'CLIENTS'|'DEPARTMENTS'|'SUPPLIERS' — из PARTNERS по typePartners
    //       'WORKERS'                            — из WORKERS
    //       'PRODUCTION_DEPTS'                   — из STORAGES по typeSection === PRODUCTION
    //       'WORKS'                              — отдельный справочник работ
    //       'MATERIALS'|'PRODUCTS'               — из TMZ по typeTMZ
    getReferences: async (
        token: string,
        type: 'CLIENTS' | 'DEPARTMENTS' | 'SUPPLIERS' | 'WORKERS' | 'PRODUCTION_DEPTS' | 'WORKS' | 'MATERIALS' | 'PRODUCTS' | 'HALFSTUFFS',
        enterpriseId?: number,
    ): Promise<
        Array<{
            id: number;
            name: string;
            article?: string;
            norma?: number;
            unit?: string;
            /** Только для WORKS — цех из карточки работы (refValues.workDeptId) */
            workDeptId?: number;
            /** Только для MATERIALS — fallback цены как в карточке ТМЗ */
            costPriceInStart?: number;
            firstPrice?: number;
            /** Только для MATERIALS — листовой материал (раскрой) */
            isSheetMaterial?: boolean;
            /** Только для MATERIALS — путь к картинке из карточки ТМЗ */
            imagePath?: string;
        }>
    > => {
        let refType: string;
        let filterFn: (r: any) => boolean;

        if (type === 'WORKERS') {
            refType = 'WORKERS';
            filterFn = (r) => !r.isFolder && !r.refValues?.markToDeleted;
        } else if (type === 'WORKS') {
            refType = 'WORKS';
            filterFn = (r) => !r.refValues?.markToDeleted;
        } else if (type === 'MATERIALS') {
            refType = 'TMZ';
            filterFn = (r) => r.refValues?.typeTMZ === 'MATERIAL' && !r.refValues?.markToDeleted;
        } else if (type === 'PRODUCTS') {
            refType = 'TMZ';
            filterFn = (r) => r.refValues?.typeTMZ === 'PRODUCT' && !r.refValues?.markToDeleted;
        } else if (type === 'HALFSTUFFS') {
            refType = 'TMZ';
            filterFn = (r) => r.refValues?.typeTMZ === 'HALFSTUFF' && !r.refValues?.markToDeleted;
        } else if (type === 'PRODUCTION_DEPTS') {
            refType = 'STORAGES';
            filterFn = (r) => r.refValues?.typeSection === 'PRODUCTION' && !r.refValues?.markToDeleted;
        } else {
            refType = 'PARTNERS';
            filterFn = (r) => r.refValues?.typePartners === type && !r.refValues?.markToDeleted;
        }

        const url = `${BASE()}/references/byType/${refType}${enterpriseId ? `?enterpriseId=${enterpriseId}` : ''}`;
        const res = await fetch(url, { headers: headers(token) });
        if (!res.ok) return [];
        const data: any[] = await res.json();
        return data.filter(filterFn).map(r => ({
            id: r.id,
            name: r.name,
            article: r.article,
            ...(type === 'WORKS'
                ? {
                      norma: r.refValues?.norma,
                      unit: r.refValues?.unit,
                      workDeptId:
                          r.refValues?.workDeptId != null && Number(r.refValues.workDeptId) > 0
                              ? Number(r.refValues.workDeptId)
                              : undefined,
                  }
                : {}),
            ...(type === 'MATERIALS' || type === 'HALFSTUFFS'
                ? {
                      costPriceInStart:
                          r.refValues?.costPriceInStart != null
                              ? Number(r.refValues.costPriceInStart)
                              : undefined,
                      firstPrice:
                          r.refValues?.firstPrice != null ? Number(r.refValues.firstPrice) : undefined,
                      ...(type === 'MATERIALS'
                          ? {
                                unit: r.refValues?.unit,
                                isSheetMaterial: Boolean(r.refValues?.isSheetMaterial),
                                imagePath: r.refValues?.imagePath ?? r.imagePath ?? undefined,
                            }
                          : {}),
                  }
                : {}),
        }));
    },

    getStoreWork: async (
        token: string,
        orderId: number,
        date?: number,
        options?: { lite?: boolean },
    ): Promise<StoreWorkResponse> => {
        const params = new URLSearchParams();
        if (date != null && Number.isFinite(date) && date > 0) {
            params.set('date', String(date));
        }
        if (options?.lite) {
            params.set('lite', '1');
        }
        const qs = params.toString();
        const res = await fetch(
            `${BASE()}/furniture-orders/${orderId}/store-work${qs ? `?${qs}` : ''}`,
            {
                headers: headers(token),
            },
        );
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка загрузки омбор ишлари');
        }
        return res.json();
    },

    getStoreWriteoffStocks: async (
        token: string,
        orderId: number,
        date?: number,
    ): Promise<WriteoffStocksResponse> => {
        const params =
            date != null && Number.isFinite(date) && date > 0
                ? `?date=${encodeURIComponent(String(date))}`
                : '';
        const res = await fetch(
            `${BASE()}/furniture-orders/${orderId}/store-work/writeoff-stocks${params}`,
            { headers: headers(token) },
        );
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка загрузки остатков для списания');
        }
        return res.json();
    },

    createStoreReceipt: async (
        token: string,
        orderId: number,
        userId: number,
        count: number,
        costTotal?: number,
        date?: number,
    ): Promise<StoreWorkResponse> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/store-work/receipt`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({ userId, count, costTotal, date }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка создания прихода');
        }
        return res.json();
    },

    proveStoreReceipt: async (
        token: string,
        orderId: number,
        docId?: number,
    ): Promise<StoreWorkResponse> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/store-work/receipt/prove`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(docId != null ? { docId } : {}),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка проведения прихода');
        }
        return res.json();
    },

    createStoreSale: async (
        token: string,
        orderId: number,
        userId: number,
        count: number,
        saleTotal?: number,
        date?: number,
    ): Promise<StoreWorkResponse> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/store-work/sale`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({
                userId,
                count,
                saleTotal,
                date: date != null ? Number(date) : undefined,
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка создания накладной');
        }
        return res.json();
    },

    proveStoreSale: async (
        token: string,
        orderId: number,
        docId?: number,
    ): Promise<StoreWorkResponse> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/store-work/sale/prove`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(docId != null ? { docId } : {}),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка проведения накладной');
        }
        return res.json();
    },

    createStoreMaterialWriteoff: async (
        token: string,
        orderId: number,
        userId: number,
        lines: { materialId: number; count: number; price: number; total: number }[],
        date?: number,
    ): Promise<StoreWorkResponse> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/store-work/material-writeoff`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({ userId, lines, date }),
        });
        if (!res.ok) {
            throw new Error(
                await readApiErrorMessage(res, 'Ошибка создания списания материалов'),
            );
        }
        return res.json();
    },

    proveStoreMaterialWriteoff: async (
        token: string,
        orderId: number,
        docId?: number,
    ): Promise<StoreWorkResponse> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/store-work/material-writeoff/prove`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(docId != null ? { docId } : {}),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка проведения списания материалов');
        }
        return res.json();
    },

    createStoreHalfstuffWriteoff: async (
        token: string,
        orderId: number,
        userId: number,
        lines: { halfstuffId: number; count: number; price: number; total: number }[],
        date?: number,
    ): Promise<StoreWorkResponse> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/store-work/halfstuff-writeoff`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({ userId, lines, date }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка создания списания полуфабрикатов');
        }
        return res.json();
    },

    proveStoreHalfstuffWriteoff: async (
        token: string,
        orderId: number,
        docId?: number,
    ): Promise<StoreWorkResponse> => {
        const res = await fetch(`${BASE()}/furniture-orders/${orderId}/store-work/halfstuff-writeoff/prove`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(docId != null ? { docId } : {}),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || 'Ошибка проведения списания полуфабрикатов');
        }
        return res.json();
    },

    uploadFurnitureOrderFile: async (token: string, file: File): Promise<{ url: string; filename: string }> => {
        const fd = new FormData();
        fd.append('file', file);

        const res = await fetch(`${BASE()}/upload/furniture-order-file`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                ...getNgrokBypassHeaders(),
            },
            body: fd,
        });
        if (!res.ok) throw new Error('Ошибка загрузки файла');
        return res.json();
    },
};
