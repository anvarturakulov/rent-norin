import type { OrderHalfstuff } from '@/app/interfaces/furnitureOrder.interface';
import { roundNorma } from '@/app/utils/norma';

export interface DraftHalfstuffRow {
    draftId: string;
    serverId?: number;
    halfstuffId: string;
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

export function deriveHalfstuffCountInOrder(row: DraftHalfstuffRow): string {
    const q = num(row.countPlanned);
    const fpq = num(row.finishedProductQty);
    if (q == null || fpq == null) return '';
    return String(roundNorma(q * fpq));
}

export function deriveHalfstuffTotal(row: DraftHalfstuffRow): string {
    const q = num(row.countInOrder);
    const p = num(row.price);
    if (q == null || p == null) return '';
    return String(round2(q * p));
}

export function withDerivedHalfstuffTotal(row: DraftHalfstuffRow): DraftHalfstuffRow {
    const countInOrder = deriveHalfstuffCountInOrder(row);
    const next = { ...row, countInOrder };
    return { ...next, total: deriveHalfstuffTotal(next) };
}

export function orderHalfstuffToDraft(
    h: OrderHalfstuff,
    orderCount?: number,
): DraftHalfstuffRow {
    const defaultFinishedQty = h.finishedProductQty ?? orderCount ?? undefined;
    const base: DraftHalfstuffRow = {
        draftId: `s-${h.id}`,
        serverId: h.id,
        halfstuffId: String(h.halfstuffId),
        finishedProductQty: str(defaultFinishedQty),
        countPlanned: str(h.countPlanned),
        countInOrder: str(h.countInOrder),
        price: str(h.price),
        total: str(h.total),
    };
    if (base.countInOrder.trim() !== '' && base.total.trim() !== '') {
        return base;
    }
    return withDerivedHalfstuffTotal({ ...base, countInOrder: '', total: '' });
}

export function emptyHalfstuffDraftRow(draftId: string): DraftHalfstuffRow {
    return {
        draftId,
        halfstuffId: '',
        finishedProductQty: '',
        countPlanned: '',
        countInOrder: '',
        price: '',
        total: '',
    };
}

export type PersistHalfstuffCreatePayload = {
    orderId: number;
    halfstuffId: number;
    price?: number;
    countPlanned?: number;
    finishedProductQty?: number;
    countInOrder?: number;
    total?: number;
};

export function draftHalfstuffToCreatePayload(
    orderId: number,
    row: DraftHalfstuffRow,
): PersistHalfstuffCreatePayload {
    const halfstuffId = Number(row.halfstuffId);
    if (!Number.isFinite(halfstuffId) || halfstuffId <= 0) {
        throw new Error('Полуфабрикатни танланг');
    }
    const r = withDerivedHalfstuffTotal(row);
    return {
        orderId,
        halfstuffId,
        price: num(r.price),
        countPlanned: num(r.countPlanned),
        finishedProductQty: num(r.finishedProductQty),
        countInOrder: num(r.countInOrder),
        total: num(r.total),
    };
}

export function draftHalfstuffToUpdateBody(row: DraftHalfstuffRow): {
    halfstuffId: number;
    price?: number;
    countPlanned?: number;
    finishedProductQty?: number;
    countInOrder?: number;
    total?: number;
} {
    const halfstuffId = Number(row.halfstuffId);
    if (!Number.isFinite(halfstuffId) || halfstuffId <= 0) {
        throw new Error('Полуфабрикатни танланг');
    }
    const r = withDerivedHalfstuffTotal(row);
    const out: {
        halfstuffId: number;
        price?: number;
        countPlanned?: number;
        finishedProductQty?: number;
        countInOrder?: number;
        total?: number;
    } = { halfstuffId };
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

function snapshotComparable(h: OrderHalfstuff) {
    const q = h.countPlanned;
    const fpq = h.finishedProductQty;
    const cio = h.countInOrder;
    const p = h.price;
    let totalNorm: number | null = null;
    if (cio != null && p != null && Number.isFinite(Number(cio)) && Number.isFinite(Number(p))) {
        totalNorm = round2(Number(cio) * Number(p));
    } else if (h.total != null && Number.isFinite(Number(h.total))) {
        totalNorm = round2(Number(h.total));
    }
    return JSON.stringify({
        halfstuffId: h.halfstuffId,
        price: p ?? null,
        countPlanned: q ?? null,
        finishedProductQty: fpq ?? null,
        countInOrder: cio ?? null,
        total: totalNorm,
    });
}

function snapshotComparableFromDraft(r: DraftHalfstuffRow) {
    const hid = Number(r.halfstuffId);
    const r0 = withDerivedHalfstuffTotal(r);
    return JSON.stringify({
        halfstuffId: Number.isFinite(hid) && hid > 0 ? hid : null,
        price: num(r0.price) ?? null,
        countPlanned: num(r0.countPlanned) ?? null,
        finishedProductQty: num(r0.finishedProductQty) ?? null,
        countInOrder: num(r0.countInOrder) ?? null,
        total: num(r0.total) ?? null,
    });
}

export function buildHalfstuffsDiff(
    baseline: OrderHalfstuff[],
    rows: DraftHalfstuffRow[],
): {
    toDelete: number[];
    toCreate: DraftHalfstuffRow[];
    toUpdate: { id: number; row: DraftHalfstuffRow }[];
} {
    const byServer = new Map(baseline.map((h) => [h.id, h]));
    const currentIds = new Set<number>();
    for (const r of rows) {
        if (r.serverId != null) currentIds.add(r.serverId);
    }
    const toDelete = baseline.map((h) => h.id).filter((id) => !currentIds.has(id));

    const toCreate: DraftHalfstuffRow[] = [];
    const toUpdate: { id: number; row: DraftHalfstuffRow }[] = [];

    for (const r of rows) {
        if (r.serverId == null) {
            if (r.halfstuffId.trim()) toCreate.push(r);
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
