import type { OrderMaterial } from '@/app/interfaces/furnitureOrder.interface';
import { roundNorma } from '@/app/utils/norma';

export interface DraftMaterialRow {
    draftId: string;
    serverId?: number;
    /** ID из справочника MATERIALS, строка для `<select>` */
    materialId: string;
    finishedProductQty: string;
    countPlanned: string;
    countInOrder: string;
    price: string;
    total: string;
}

const num = (s: unknown): number | undefined => {
    const t = String(s ?? '').trim();
    if (t === '') return undefined;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
};

const str = (n: number | undefined | null): string =>
    n == null || !Number.isFinite(Number(n)) ? '' : String(n);

function round2(x: number) {
    return Math.round(x * 100) / 100;
}

/** Количество из каталога → строка draft (до 3 знаков после запятой). */
export function formatMaterialQtyFromCatalog(quantity: number): string {
    return String(roundNorma(quantity));
}

/** Количество в заказе: норма на 1 изделие × количество готовой продукции. */
export function deriveMaterialCountInOrder(row: DraftMaterialRow): string {
    const q = num(row.countPlanned);
    const fpq = num(row.finishedProductQty);
    if (q == null || fpq == null) return '';
    return String(roundNorma(q * fpq));
}

/** Сумма строки: количество в заказе × цена (без ручного ввода). */
export function deriveMaterialTotal(row: DraftMaterialRow): string {
    const q = num(row.countInOrder);
    const p = num(row.price);
    if (q == null || p == null) return '';
    return String(round2(q * p));
}

export function withDerivedMaterialTotal(row: DraftMaterialRow): DraftMaterialRow {
    const countInOrder = deriveMaterialCountInOrder(row);
    const next = { ...row, countInOrder };
    return { ...next, total: deriveMaterialTotal(next) };
}

export function orderMaterialToDraft(m: OrderMaterial, orderCount?: number): DraftMaterialRow {
    const defaultFinishedQty = m.finishedProductQty ?? orderCount ?? undefined;
    const base: DraftMaterialRow = {
        draftId: `s-${m.id}`,
        serverId: m.id,
        materialId: String(m.materialId),
        finishedProductQty: str(defaultFinishedQty),
        countPlanned: str(m.countPlanned),
        countInOrder: str(m.countInOrder),
        price: str(m.price),
        total: str(m.total),
    };
    if (base.countInOrder.trim() !== '' && base.total.trim() !== '') {
        return base;
    }
    return withDerivedMaterialTotal({ ...base, countInOrder: '', total: '' });
}

export function emptyMaterialDraftRow(draftId: string): DraftMaterialRow {
    return {
        draftId,
        materialId: '',
        finishedProductQty: '',
        countPlanned: '',
        countInOrder: '',
        price: '',
        total: '',
    };
}

export type PersistMaterialCreatePayload = {
    orderId: number;
    materialId: number;
    price?: number;
    countPlanned?: number;
    finishedProductQty?: number;
    countInOrder?: number;
    total?: number;
};

export function draftMaterialToCreatePayload(orderId: number, row: DraftMaterialRow): PersistMaterialCreatePayload {
    const materialId = Number(row.materialId);
    if (!Number.isFinite(materialId) || materialId <= 0) {
        throw new Error('Материални танланг');
    }
    const r = withDerivedMaterialTotal(row);
    return {
        orderId,
        materialId,
        price: num(r.price),
        countPlanned: num(r.countPlanned),
        finishedProductQty: num(r.finishedProductQty),
        countInOrder: num(r.countInOrder),
        total: num(r.total),
    };
}

export function draftMaterialToUpdateBody(row: DraftMaterialRow): {
    materialId: number;
    price?: number;
    countPlanned?: number;
    finishedProductQty?: number;
    countInOrder?: number;
    total?: number;
} {
    const materialId = Number(row.materialId);
    if (!Number.isFinite(materialId) || materialId <= 0) {
        throw new Error('Материални танланг');
    }
    const r = withDerivedMaterialTotal(row);
    const out: {
        materialId: number;
        price?: number;
        countPlanned?: number;
        finishedProductQty?: number;
        countInOrder?: number;
        total?: number;
    } = { materialId };
    const pr = num(r.price);
    const cp = num(r.countPlanned);
    const fpq = num(r.finishedProductQty);
    const cio = num(r.countInOrder);
    const tt = num(r.total);
    if (pr !== undefined) out.price = pr;
    if (cp !== undefined) out.countPlanned = cp;
    if (fpq !== undefined) out.finishedProductQty = fpq;
    if (cio !== undefined) out.countInOrder = cio;
    if (tt !== undefined) out.total = tt;
    return out;
}

function snapshotComparable(m: OrderMaterial) {
    const q = m.countPlanned;
    const fpq = m.finishedProductQty;
    const cio = m.countInOrder;
    const p = m.price;
    let totalNorm: number | null = null;
    if (cio != null && p != null && Number.isFinite(Number(cio)) && Number.isFinite(Number(p))) {
        totalNorm = round2(Number(cio) * Number(p));
    } else if (m.total != null && Number.isFinite(Number(m.total))) {
        totalNorm = round2(Number(m.total));
    }
    return JSON.stringify({
        materialId: m.materialId,
        price: p ?? null,
        countPlanned: q ?? null,
        finishedProductQty: fpq ?? null,
        countInOrder: cio ?? null,
        total: totalNorm,
    });
}

function snapshotComparableFromDraft(r: DraftMaterialRow) {
    const mid = Number(r.materialId);
    const r0 = withDerivedMaterialTotal(r);
    return JSON.stringify({
        materialId: Number.isFinite(mid) && mid > 0 ? mid : null,
        price: num(r0.price) ?? null,
        countPlanned: num(r0.countPlanned) ?? null,
        finishedProductQty: num(r0.finishedProductQty) ?? null,
        countInOrder: num(r0.countInOrder) ?? null,
        total: num(r0.total) ?? null,
    });
}

export function buildMaterialsDiff(
    baseline: OrderMaterial[],
    rows: DraftMaterialRow[],
): { toDelete: number[]; toCreate: DraftMaterialRow[]; toUpdate: { id: number; row: DraftMaterialRow }[] } {
    const byServer = new Map(baseline.map(m => [m.id, m]));
    const currentIds = new Set<number>();
    for (const r of rows) {
        if (r.serverId != null) currentIds.add(r.serverId);
    }
    const toDelete = baseline.map(m => m.id).filter(id => !currentIds.has(id));

    const toCreate: DraftMaterialRow[] = [];
    const toUpdate: { id: number; row: DraftMaterialRow }[] = [];

    for (const r of rows) {
        if (r.serverId == null) {
            if (r.materialId.trim()) toCreate.push(r);
            continue;
        }
        const prev = byServer.get(r.serverId);
        if (!prev) continue;
        if (snapshotComparable(prev) !== snapshotComparableFromDraft(r)) {
            toUpdate.push({ id: r.serverId, row: r });
        }
    }

    return { toDelete, toCreate, toUpdate };
}
