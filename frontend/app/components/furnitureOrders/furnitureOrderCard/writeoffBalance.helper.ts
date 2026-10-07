import {
    MaterialWriteoffLine,
    StoreWorkResponse,
    WriteoffProgressLine,
} from '@/app/interfaces/furnitureOrder.interface';

const WRITEOFF_QTY_EPSILON = 0.001;

export function getMaxWriteoffSnapshotBalance(
    writeoffs: MaterialWriteoffLine[],
    itemId: number,
): number | null {
    let max = 0;
    let found = false;
    for (const row of writeoffs) {
        const id = Number(row.materialId ?? row.halfstuffId ?? 0);
        if (id !== itemId) continue;
        const b = Number(row.balance ?? 0);
        if (b > WRITEOFF_QTY_EPSILON) {
            found = true;
            max = Math.max(max, b);
        }
    }
    return found ? Math.round(max * 1000) / 1000 : null;
}

export function resolveEffectiveWarehouseBalance(
    warehouseBalance: number,
    writtenOffInOrder: number,
    snapshotBalance: number | null,
): number {
    const raw = Math.max(0, Math.round(warehouseBalance * 1000) / 1000);
    const writtenOff = Math.max(0, Math.round(writtenOffInOrder * 1000) / 1000);
    if (writtenOff <= WRITEOFF_QTY_EPSILON) return raw;
    if (snapshotBalance == null || snapshotBalance <= WRITEOFF_QTY_EPSILON) {
        return Math.max(0, Math.round((raw - writtenOff) * 1000) / 1000);
    }
    const snapshot = Math.round(snapshotBalance * 1000) / 1000;
    return Math.max(
        0,
        Math.round(Math.min(raw, snapshot - writtenOff) * 1000) / 1000,
    );
}

export function resolveEffectiveBalanceForLine(
    rawBalance: number,
    itemId: number,
    storeData: StoreWorkResponse | undefined,
    kind: 'material' | 'halfstuff',
    progress?: WriteoffProgressLine,
): number {
    if (!storeData) return Math.max(0, rawBalance);

    const writtenOffInOrder = progress?.writtenOff ?? 0;
    const writeoffs =
        kind === 'material'
            ? storeData.materialWriteoffs
            : storeData.halfstuffWriteoffs;
    const snapshotBalance = getMaxWriteoffSnapshotBalance(writeoffs, itemId);

    return resolveEffectiveWarehouseBalance(
        rawBalance,
        writtenOffInOrder,
        snapshotBalance,
    );
}
