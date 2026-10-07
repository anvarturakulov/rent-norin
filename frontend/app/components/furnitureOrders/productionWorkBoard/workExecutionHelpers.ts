import {
    OrderHalfstuff,
    OrderMaterial,
    OrderWork,
    OrderWorkLog,
} from '@/app/interfaces/furnitureOrder.interface';
import { TypeSECTION } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { withApiDomain } from '@/app/service/common/getApiDomain';
import { getHalfstuffCostPriceClient } from '@/app/service/productCalculations/calculateMaterialsClient';

type StorageRef = {
    id?: number;
    refValues?: { typeSection?: string; markToDeleted?: boolean };
};

/** Единый склад материалов (STORAGES / COMMON) для остатков и списания. */
export function getCommonMaterialStorageId(
    storages: StorageRef[] | undefined | null,
): number | null {
    const found = (storages || []).find(
        (w) => w?.refValues?.typeSection === TypeSECTION.COMMON && !w?.refValues?.markToDeleted,
    );
    const id = found ? Number(found.id) : 0;
    return Number.isFinite(id) && id > 0 ? id : null;
}

/** Склад готовой продукции / полуфабриката (STORAGES / STORAGE). */
export function getProductStorageId(
    storages: StorageRef[] | undefined | null,
): number | null {
    const found = (storages || []).find(
        (w) => w?.refValues?.typeSection === TypeSECTION.STORAGE && !w?.refValues?.markToDeleted,
    );
    const id = found ? Number(found.id) : 0;
    return Number.isFinite(id) && id > 0 ? id : null;
}

export const COMMON_STORAGE_MISSING_MSG =
    'Не найден склад материалов (COMMON) в справочнике';

/** Загружает STORAGES предприятия и возвращает id склада материалов (COMMON). */
export async function fetchCommonMaterialStorageId(
    token: string,
    enterpriseId: number,
): Promise<number | null> {
    const url = withApiDomain(
        `/api/references/byType/STORAGES?enterpriseId=${enterpriseId}`,
    );
    try {
        const storages = (await getDataForSwr(url, token)) as StorageRef[];
        return getCommonMaterialStorageId(storages);
    } catch (e) {
        console.warn('[fetchCommonMaterialStorageId] не удалось загрузить склады', e);
        return null;
    }
}

export async function fetchProductStorageId(
    token: string,
    enterpriseId: number,
): Promise<number | null> {
    const url = withApiDomain(
        `/api/references/byType/STORAGES?enterpriseId=${enterpriseId}`,
    );
    try {
        const storages = (await getDataForSwr(url, token)) as StorageRef[];
        return getProductStorageId(storages);
    } catch (e) {
        console.warn('[fetchProductStorageId] не удалось загрузить склады', e);
        return null;
    }
}

/** Склад полуфабрикатов в проекте — STORAGES / COMMON (как списание на Омбор). */
export function resolveHalfstuffWarehouseId(
    storages: StorageRef[] | undefined | null,
): number | null {
    return getCommonMaterialStorageId(storages);
}

export async function fetchHalfstuffWarehouseId(
    token: string,
    enterpriseId: number,
): Promise<number | null> {
    return fetchCommonMaterialStorageId(token, enterpriseId);
}

type HalfstuffRefPriceSource = {
    firstPrice?: number | string | null;
    costPriceInStart?: number | string | null;
};

/** AVEKO (S21 / COMMON) с fallback на цену из карточки ТМЗ. */
export async function resolveHalfstuffStockPrice(
    token: string,
    enterpriseId: number,
    halfstuffId: number,
    asOfDateMs: number,
    refFallback?: HalfstuffRefPriceSource | null,
): Promise<{ price: number; balance: number }> {
    let balance = 0;
    let price = 0;

    const warehouseId = await fetchHalfstuffWarehouseId(token, enterpriseId);
    if (warehouseId) {
        try {
            const stock = await getHalfstuffCostPriceClient(
                asOfDateMs,
                halfstuffId,
                warehouseId,
                token,
                enterpriseId,
            );
            balance = Number(stock.balance ?? 0);
            price = Number(stock.costPrice ?? 0);
        } catch (e) {
            console.warn(
                `[resolveHalfstuffStockPrice] halfstuffId=${halfstuffId} warehouseId=${warehouseId}`,
                e,
            );
        }
    }

    if (price <= 0 && refFallback) {
        const fb =
            Number(refFallback.firstPrice ?? 0) ||
            Number(refFallback.costPriceInStart ?? 0);
        if (fb > 0) price = fb;
    }

    return { price, balance };
}

export function getTmzTypeLabel(typeTMZ?: string): string {
    if (typeTMZ === 'HALFSTUFF') return 'Я.Т.М';
    if (typeTMZ === 'PRODUCT') return 'Тайёр';
    return 'Материал';
}

export const STATUS_COLOR: Record<string, string> = {
    OPEN: '#9e9e9e',
    PENDING: '#ff9800',
    IN_PROGRESS: '#2196f3',
    PAUSE: '#ff5722',
    DONE: '#4caf50',
};

export const WRITE_OFF_BADGE: Record<string, string> = {
    PROVEDEN: 'Списание: проведено',
    OPEN: 'Списание: черновик',
    PENDING: 'Списание: ожидает',
    REJECTED: 'Списание: отклонено',
    DELETED: 'Списание: удалено',
};

export function getActiveLog(work: OrderWork): OrderWorkLog | undefined {
    if (!work.logs?.length) return undefined;
    const startedLog = work.logs.find((log) => log.status === 'STARTED');
    if (startedLog) return startedLog;
    const pausedLogs = work.logs
        .filter((log) => log.status === 'PAUSED')
        .sort((a, b) => {
            const aTs = Number(a.finishedAt ?? a.startedAt ?? a.date ?? a.id ?? 0);
            const bTs = Number(b.finishedAt ?? b.startedAt ?? b.date ?? b.id ?? 0);
            return bTs - aTs;
        });
    return pausedLogs[0];
}

export function getActiveLogForWorker(
    work: OrderWork,
    workerId?: number | null,
): OrderWorkLog | undefined {
    if (!workerId || !work.logs?.length) return undefined;
    const wid = Number(workerId);
    const startedLog = work.logs.find(
        (log) => log.status === 'STARTED' && Number(log.workerId) === wid,
    );
    if (startedLog) return startedLog;
    const pausedLogs = work.logs
        .filter((log) => log.status === 'PAUSED' && Number(log.workerId) === wid)
        .sort((a, b) => {
            const aTs = Number(a.finishedAt ?? a.startedAt ?? a.date ?? a.id ?? 0);
            const bTs = Number(b.finishedAt ?? b.startedAt ?? b.date ?? b.id ?? 0);
            return bTs - aTs;
        });
    return pausedLogs[0];
}

export function getActiveWorkersCount(work: OrderWork): number {
    if (!work.logs?.length) return 0;
    return work.logs.filter((log) => log.status === 'STARTED').length;
}

export function getWorkLaborHours(work: OrderWork): number {
    if (!work.logs?.length) return 0;
    return work.logs.reduce((sum, log) => sum + Number(log.hoursSpent || 0), 0);
}

/** Работа ожидает или выполняется (не завершена). */
export function isWorkWaitingOrActive(work: OrderWork): boolean {
    if (work.workStatus === 'DONE') return false;
    const log = getActiveLog(work);
    if (log?.status === 'STARTED') return true;
    return (
        work.workStatus === 'OPEN' ||
        work.workStatus === 'PENDING' ||
        work.workStatus === 'IN_PROGRESS' ||
        work.workStatus === 'PAUSE'
    );
}

export function getMaterialUnit(m: OrderMaterial): string {
    const unit = m.material?.refValues?.unit?.trim();
    return unit || '';
}

export function formatQtyWithUnit(qty: string, unit: string): string {
    if (qty === '—') return '—';
    return unit ? `${qty} ${unit}` : qty;
}

function formatOrderMaterialQty(raw: number | undefined | null): string {
    if (raw == null) return '—';
    const n = Number(raw);
    return Number.isFinite(n) ? formatWriteoffQty(n) : '—';
}

/** Норма (режа) на 1 изделие */
export function getOrderMaterialNormQty(m: OrderMaterial): string {
    return formatOrderMaterialQty(m.countPlanned);
}

/** Количество по плану в заказе */
export function getOrderMaterialOrderPlannedQty(m: OrderMaterial): string {
    return formatOrderMaterialQty(m.countInOrder);
}

/** Итого к списанию: countInOrder или countPlanned × тираж ГП. */
export function resolveOrderMaterialWriteoffQty(
    m: OrderMaterial,
    orderCount?: number,
): number {
    const countInOrder = Number(m.countInOrder);
    if (Number.isFinite(countInOrder) && countInOrder > 0) return countInOrder;
    const countPlanned = Number(m.countPlanned ?? 0);
    const finishedProductQty = Number(m.finishedProductQty ?? orderCount ?? 0);
    if (countPlanned > 0 && finishedProductQty > 0) {
        return Math.round(countPlanned * finishedProductQty * 1000) / 1000;
    }
    return countPlanned || finishedProductQty || 0;
}

/** Итого к списанию полуфабриката: countInOrder или countPlanned × тираж ГП. */
export function resolveOrderHalfstuffWriteoffQty(
    h: OrderHalfstuff,
    orderCount?: number,
): number {
    const countInOrder = Number(h.countInOrder);
    if (Number.isFinite(countInOrder) && countInOrder > 0) return countInOrder;
    const countPlanned = Number(h.countPlanned ?? 0);
    const finishedProductQty = Number(h.finishedProductQty ?? orderCount ?? 0);
    if (countPlanned > 0 && finishedProductQty > 0) {
        return Math.round(countPlanned * finishedProductQty * 1000) / 1000;
    }
    return countPlanned || finishedProductQty || 0;
}

/** @deprecated используйте getOrderMaterialNormQty / getOrderMaterialOrderPlannedQty */
export function getOrderMaterialPlannedQty(m: OrderMaterial): string {
    const raw = m.countPlanned ?? m.countInOrder;
    return formatOrderMaterialQty(raw);
}

export function formatOrderMaterialNormWithUnit(m: OrderMaterial): string {
    return formatQtyWithUnit(getOrderMaterialNormQty(m), getMaterialUnit(m));
}

export function formatOrderMaterialOrderPlannedWithUnit(m: OrderMaterial): string {
    return formatQtyWithUnit(getOrderMaterialOrderPlannedQty(m), getMaterialUnit(m));
}

export function findOrderMaterialByMaterialId(
    materials: OrderMaterial[] | undefined,
    materialId: number,
): OrderMaterial | undefined {
    return materials?.find((m) => Number(m.materialId) === Number(materialId));
}

export function formatWriteoffQty(value: number): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 1000) / 1000;
    return String(rounded);
}

export function formatBoardDate(value?: number | string | null) {
    if (!value) return '—';
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU');
}

/** Разбор введённого количества (пробелы, запятая/точка). */
export function parseWorkQtyInput(raw: string): number | null {
    const t = raw.replace(/\s/g, '').replace(',', '.').trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

/** Округление количества до целого для проверки при завершении работы. */
export function roundWorkQtyToInt(value: number): number {
    return Math.round(value);
}

/** Сравнение введённого количества с плановым по целым числам. */
export function isWorkQtyMatchingPlan(entered: string, planned?: number | null): boolean {
    const enteredNum = parseWorkQtyInput(entered);
    const plannedNum = planned != null ? Number(planned) : NaN;
    if (enteredNum == null || !Number.isFinite(plannedNum) || plannedNum <= 0) return false;
    return roundWorkQtyToInt(enteredNum) === roundWorkQtyToInt(plannedNum);
}

export function getWorkPlannedCount(work: OrderWork): number | null {
    const n = work.countInOrder != null ? Number(work.countInOrder) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
}
