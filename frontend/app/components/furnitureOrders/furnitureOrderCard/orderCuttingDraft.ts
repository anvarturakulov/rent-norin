import type { CuttingBalanceRow, OrderCuttingLine } from '@/app/interfaces/furnitureOrder.interface';

export interface DraftCuttingRow {
    draftId: string;
    serverId?: number;
    materialId: string;
    length: string;
    width: string;
    quantity: string;
    comment: string;
}

const num = (s: unknown): number | undefined => {
    const t = String(s ?? '').trim();
    if (t === '') return undefined;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
};

const str = (n: number | undefined | null): string =>
    n == null || !Number.isFinite(Number(n)) ? '' : String(n);

export function cuttingLineToDraft(line: OrderCuttingLine): DraftCuttingRow {
    return {
        draftId: `s-${line.id}`,
        serverId: line.id,
        materialId: String(line.materialId),
        length: str(line.length),
        width: str(line.width),
        quantity: str(line.quantity),
        comment: line.comment ?? '',
    };
}

export function emptyCuttingDraftRow(draftId: string): DraftCuttingRow {
    return {
        draftId,
        materialId: '',
        length: '',
        width: '',
        quantity: '1',
        comment: '',
    };
}

export function draftCuttingToPayload(orderId: number, row: DraftCuttingRow) {
    const materialId = Number(row.materialId);
    const length = num(row.length);
    const width = num(row.width);
    const quantity = num(row.quantity);
    if (!Number.isFinite(materialId) || materialId <= 0) throw new Error('Материални танланг');
    if (length == null || length <= 0) throw new Error('Узунликни киритинг (мм)');
    if (width == null || width <= 0) throw new Error('Энигни киритинг (мм)');
    if (quantity == null || quantity <= 0) throw new Error('Миқдорни киритинг');
    return {
        orderId,
        materialId,
        length,
        width,
        quantity,
        comment: row.comment.trim() || undefined,
    };
}

export function draftCuttingToUpdateBody(row: DraftCuttingRow) {
    const materialId = Number(row.materialId);
    const length = num(row.length);
    const width = num(row.width);
    const quantity = num(row.quantity);
    if (!Number.isFinite(materialId) || materialId <= 0) throw new Error('Материални танланг');
    if (length == null || length <= 0) throw new Error('Узунликни киритинг (мм)');
    if (width == null || width <= 0) throw new Error('Энигни киритинг (мм)');
    if (quantity == null || quantity <= 0) throw new Error('Миқдорни киритинг');
    return {
        materialId,
        length,
        width,
        quantity,
        comment: row.comment.trim() || undefined,
    };
}

function snapshotComparable(line: OrderCuttingLine) {
    return JSON.stringify({
        materialId: line.materialId,
        length: line.length,
        width: line.width,
        quantity: line.quantity,
        comment: line.comment ?? '',
    });
}

function snapshotComparableFromDraft(row: DraftCuttingRow) {
    const mid = Number(row.materialId);
    return JSON.stringify({
        materialId: Number.isFinite(mid) && mid > 0 ? mid : null,
        length: num(row.length) ?? null,
        width: num(row.width) ?? null,
        quantity: num(row.quantity) ?? null,
        comment: row.comment.trim(),
    });
}

export function buildCuttingDiff(
    baseline: OrderCuttingLine[],
    rows: DraftCuttingRow[],
): { toDelete: number[]; toCreate: DraftCuttingRow[]; toUpdate: { id: number; row: DraftCuttingRow }[] } {
    const byServer = new Map(baseline.map(m => [m.id, m]));
    const currentIds = new Set<number>();
    for (const r of rows) {
        if (r.serverId != null) currentIds.add(r.serverId);
    }
    const toDelete = baseline.map(m => m.id).filter(id => !currentIds.has(id));

    const toCreate: DraftCuttingRow[] = [];
    const toUpdate: { id: number; row: DraftCuttingRow }[] = [];

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

export function isCuttingRowFilled(row: DraftCuttingRow): boolean {
    return Boolean(row.materialId.trim() || row.length.trim() || row.width.trim());
}

export const parseCuttingQty = (s: unknown): number | undefined => {
    const t = String(s ?? '').trim();
    if (t === '') return undefined;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
};

const parseQty = parseCuttingQty;

/** Площадь в м²: (длина мм) × (ширина мм) × кол-во / 1_000_000 */
export function calcCuttingAreaM2(
    length: string | number,
    width: string | number,
    quantity: string | number,
): number | null {
    const l = typeof length === 'number' ? length : parseCuttingQty(length);
    const w = typeof width === 'number' ? width : parseCuttingQty(width);
    const q = typeof quantity === 'number' ? quantity : parseCuttingQty(quantity);
    if (l == null || w == null || q == null || l <= 0 || w <= 0 || q <= 0) return null;
    return (l * w * q) / 1_000_000;
}

/** Ключ остатка: materialId + длина + ширина (мм). */
export function cuttingBalanceKey(
    materialId: string | number,
    length: string | number,
    width: string | number,
): string | null {
    const mid = Number(materialId);
    const l = typeof length === 'number' ? length : parseQty(length);
    const w = typeof width === 'number' ? width : parseQty(width);
    if (!Number.isFinite(mid) || mid <= 0 || l == null || l <= 0 || w == null || w <= 0) return null;
    const roundMm = (x: number) => Math.round(x * 1000) / 1000;
    return `${mid}|${roundMm(l)}|${roundMm(w)}`;
}

export interface CuttingBalanceGroup {
    materialId: number;
    name: string;
    article: string;
    totalQty: number;
    totalAreaM2: number;
    sizes: CuttingBalanceRow[];
}

/**
 * Группировка остатков по материалу (= артикулу). Внутри группы — размеры
 * (длина × ширина), отсортированные по длине, затем по ширине. Нулевые остатки
 * отфильтрованы. Группы сортируются по имени материала.
 */
export function groupBalancesByMaterial(rows: CuttingBalanceRow[]): CuttingBalanceGroup[] {
    const byMaterial = new Map<number, CuttingBalanceRow[]>();
    for (const row of rows) {
        if (Math.abs(row.remainQty) <= 0.000001) continue;
        const list = byMaterial.get(row.materialId);
        if (list) list.push(row);
        else byMaterial.set(row.materialId, [row]);
    }

    const groups: CuttingBalanceGroup[] = [];
    for (const [materialId, sizes] of byMaterial) {
        sizes.sort((a, b) => a.length - b.length || a.width - b.width);
        const totalQty = sizes.reduce((acc, s) => acc + s.remainQty, 0);
        const totalAreaM2 = sizes.reduce(
            (acc, s) => acc + (calcCuttingAreaM2(s.length, s.width, s.remainQty) ?? 0),
            0,
        );
        const first = sizes[0];
        groups.push({
            materialId,
            name: first.material?.name ?? `ID ${materialId}`,
            article: first.material?.article?.trim() ?? '',
            totalQty,
            totalAreaM2,
            sizes,
        });
    }

    groups.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return groups;
}

export function sumCuttingQtyByKey(
    rows: Array<{ materialId: string | number; length: string | number; width: string | number; quantity: string | number }>,
): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
        const key = cuttingBalanceKey(row.materialId, row.length, row.width);
        const q = typeof row.quantity === 'number' ? row.quantity : parseQty(row.quantity);
        if (!key || q == null || q <= 0) continue;
        map.set(key, (map.get(key) ?? 0) + q);
    }
    return map;
}
