import type { OrderWork, WorkStatus } from '@/app/interfaces/furnitureOrder.interface';

export type CalcOverrideKey = 'timeInUnit' | 'timeInOrder' | 'salaryInUnit' | 'salaryInOrder';

export interface DraftWorkRow {
    draftId: string;
    serverId?: number;
    workRefId: string;
    workName: string;
    workArticle: string;
    assignedDeptId: string;
    unit: string;
    hourRate: string;
    countInUnit: string;
    finishedProductQty: string;
    countInOrder: string;
    timeInUnit: string;
    timeInOrder: string;
    salaryRate: string;
    salaryInUnit: string;
    salaryInOrder: string;
    workStatus: WorkStatus;
    overrides: Partial<Record<CalcOverrideKey, true>>;
}

const num = (s: string): number | undefined => {
    const t = s.trim();
    if (t === '') return undefined;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
};

/** Объём в заказе = объём в изделии × кол-во готовой продукции (как в syncNormsToOrder). */
export function countInOrderFromUnitAndFinished(countInUnit: string, finishedProductQty: string): string {
    const cu = num(countInUnit);
    const fp = num(finishedProductQty);
    if (cu == null || fp == null) return '';
    return String(Math.round(cu * fp * 10000) / 10000);
}

/** Справочник WORKS в API может приходить как number или string (BIGINT). */
function normalizeWorkRefId(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

const str = (n: number | undefined | null): string =>
    n == null || !Number.isFinite(Number(n)) ? '' : String(n);

export function orderWorkToDraft(w: OrderWork): DraftWorkRow {
    const wr = normalizeWorkRefId(w.workRefId);
    return {
        draftId: `s-${w.id}`,
        serverId: w.id,
        workRefId: wr != null ? String(wr) : '',
        workName: w.workName ?? '',
        workArticle: w.workArticle ?? '',
        assignedDeptId: w.assignedDeptId != null ? String(w.assignedDeptId) : '',
        unit: w.unit ?? '',
        hourRate: str(w.hourRate),
        countInUnit: str(w.countInUnit),
        finishedProductQty: str(w.finishedProductQty),
        countInOrder: str(w.countInOrder),
        timeInUnit: str(w.timeInUnit),
        timeInOrder: str(w.timeInOrder),
        salaryRate: str(w.salaryRate),
        salaryInUnit: str(w.salaryInUnit),
        salaryInOrder: str(w.salaryInOrder),
        workStatus: w.workStatus,
        overrides: {},
    };
}

export function emptyDraftRow(draftId: string): DraftWorkRow {
    return {
        draftId,
        workRefId: '',
        workName: '',
        workArticle: '',
        assignedDeptId: '',
        unit: '',
        hourRate: '',
        countInUnit: '',
        finishedProductQty: '',
        countInOrder: '',
        timeInUnit: '',
        timeInOrder: '',
        salaryRate: '',
        salaryInUnit: '',
        salaryInOrder: '',
        workStatus: 'OPEN',
        overrides: {},
    };
}

/** hourRate — норма (множитель): Тр. изд./зак. = норма × объём; стоимость = нормо-час × трудоёмкость (или объём × расценка). */
export function recomputeDerived(
    row: DraftWorkRow,
    changedBase: 'hourRate' | 'countInUnit' | 'countInOrder' | 'salaryRate' | null,
): DraftWorkRow {
    const next = { ...row, overrides: { ...row.overrides } };

    const clearOverride = (k: CalcOverrideKey) => {
        delete next.overrides[k];
    };

    if (changedBase === 'hourRate' || changedBase === 'countInUnit') {
        clearOverride('timeInUnit');
    }
    if (changedBase === 'hourRate' || changedBase === 'countInOrder') {
        clearOverride('timeInOrder');
    }
    if (changedBase === 'hourRate' || changedBase === 'countInUnit' || changedBase === 'salaryRate') {
        clearOverride('salaryInUnit');
    }
    if (changedBase === 'hourRate' || changedBase === 'countInOrder' || changedBase === 'salaryRate') {
        clearOverride('salaryInOrder');
    }

    const hourRate = num(next.hourRate);
    const cUnit = num(next.countInUnit);
    const cOrder = num(next.countInOrder);
    const salRate = num(next.salaryRate);

    if (!next.overrides.timeInUnit) {
        if (hourRate != null && cUnit != null) {
            next.timeInUnit = String(round4(hourRate * cUnit));
        } else {
            next.timeInUnit = '';
        }
    }
    if (!next.overrides.timeInOrder) {
        if (hourRate != null && cOrder != null) {
            next.timeInOrder = String(round4(hourRate * cOrder));
        } else {
            next.timeInOrder = '';
        }
    }

    const tUnit = num(next.timeInUnit);
    const tOrder = num(next.timeInOrder);

    if (!next.overrides.salaryInUnit) {
        if (tUnit != null && salRate != null) {
            next.salaryInUnit = String(round2(tUnit * salRate));
        } else {
            next.salaryInUnit = '';
        }
    }
    if (!next.overrides.salaryInOrder) {
        if (tOrder != null && salRate != null) {
            next.salaryInOrder = String(round2(tOrder * salRate));
        } else {
            next.salaryInOrder = '';
        }
    }

    return next;
}

function round4(x: number) {
    return Math.round(x * 10000) / 10000;
}
function round2(x: number) {
    return Math.round(x * 100) / 100;
}

export type PersistWorkCreatePayload = {
    orderId: number;
    workRefId?: number;
    workName: string;
    workArticle?: string;
    assignedDeptId?: number;
    unit?: string;
    hourRate?: number;
    countInUnit?: number;
    finishedProductQty?: number;
    countInOrder?: number;
    timeInUnit?: number;
    timeInOrder?: number;
    salaryRate?: number;
    salaryInUnit?: number;
    salaryInOrder?: number;
};

export function draftRowToCreatePayload(orderId: number, row: DraftWorkRow): PersistWorkCreatePayload {
    const workName = row.workName.trim();
    if (!workName) throw new Error('Укажите наименование операции');
    return {
        orderId,
        workRefId: normalizeWorkRefId(row.workRefId) ?? undefined,
        workName,
        workArticle: row.workArticle.trim() || undefined,
        assignedDeptId: row.assignedDeptId ? Number(row.assignedDeptId) : undefined,
        unit: row.unit.trim() || undefined,
        hourRate: num(row.hourRate),
        countInUnit: num(row.countInUnit),
        finishedProductQty: num(row.finishedProductQty),
        countInOrder: num(row.countInOrder),
        timeInUnit: num(row.timeInUnit),
        timeInOrder: num(row.timeInOrder),
        salaryRate: num(row.salaryRate),
        salaryInUnit: num(row.salaryInUnit),
        salaryInOrder: num(row.salaryInOrder),
    };
}

export function draftRowToUpdatePayload(row: DraftWorkRow): Record<string, unknown> {
    return {
        workRefId: normalizeWorkRefId(row.workRefId),
        workName: row.workName.trim() || undefined,
        workArticle: row.workArticle.trim() || undefined,
        assignedDeptId: row.assignedDeptId ? Number(row.assignedDeptId) : undefined,
        unit: row.unit.trim() || undefined,
        hourRate: num(row.hourRate),
        countInUnit: num(row.countInUnit),
        finishedProductQty: num(row.finishedProductQty),
        countInOrder: num(row.countInOrder),
        timeInUnit: num(row.timeInUnit),
        timeInOrder: num(row.timeInOrder),
        salaryRate: num(row.salaryRate),
        salaryInUnit: num(row.salaryInUnit),
        salaryInOrder: num(row.salaryInOrder),
    };
}

function snapshotComparable(w: OrderWork) {
    return JSON.stringify({
        workRefId: normalizeWorkRefId(w.workRefId),
        workName: w.workName,
        workArticle: w.workArticle ?? '',
        assignedDeptId: w.assignedDeptId ?? null,
        unit: w.unit ?? '',
        hourRate: w.hourRate ?? null,
        countInUnit: w.countInUnit ?? null,
        finishedProductQty: w.finishedProductQty ?? null,
        countInOrder: w.countInOrder ?? null,
        timeInUnit: w.timeInUnit ?? null,
        timeInOrder: w.timeInOrder ?? null,
        salaryRate: w.salaryRate ?? null,
        salaryInUnit: w.salaryInUnit ?? null,
        salaryInOrder: w.salaryInOrder ?? null,
    });
}

export function buildWorksDiff(
    baseline: OrderWork[],
    rows: DraftWorkRow[],
): { toDelete: number[]; toCreate: DraftWorkRow[]; toUpdate: { id: number; row: DraftWorkRow }[] } {
    const byServer = new Map(baseline.map(w => [w.id, w]));
    const currentIds = new Set<number>();
    for (const r of rows) {
        if (r.serverId != null) currentIds.add(r.serverId);
    }
    const toDelete = baseline.map(w => w.id).filter(id => !currentIds.has(id));

    const toCreate: DraftWorkRow[] = [];
    const toUpdate: { id: number; row: DraftWorkRow }[] = [];

    for (const r of rows) {
        if (r.serverId == null) {
            if (r.workName.trim()) toCreate.push(r);
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

function snapshotComparableFromDraft(r: DraftWorkRow) {
    return JSON.stringify({
        workRefId: normalizeWorkRefId(r.workRefId),
        workName: r.workName.trim(),
        workArticle: r.workArticle.trim(),
        assignedDeptId: r.assignedDeptId ? Number(r.assignedDeptId) : null,
        unit: r.unit.trim(),
        hourRate: num(r.hourRate) ?? null,
        countInUnit: num(r.countInUnit) ?? null,
        finishedProductQty: num(r.finishedProductQty) ?? null,
        countInOrder: num(r.countInOrder) ?? null,
        timeInUnit: num(r.timeInUnit) ?? null,
        timeInOrder: num(r.timeInOrder) ?? null,
        salaryRate: num(r.salaryRate) ?? null,
        salaryInUnit: num(r.salaryInUnit) ?? null,
        salaryInOrder: num(r.salaryInOrder) ?? null,
    });
}
