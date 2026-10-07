import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { OrderHalfstuff } from "src/orderHalfstuffs/orderHalfstuff.model";

export const WRITEOFF_QTY_EPSILON = 0.001;

export function resolvePlannedMaterialQty(
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

export function resolvePlannedHalfstuffQty(
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

export function isQtyComplete(writtenOff: number, planned: number): boolean {
  if (planned <= WRITEOFF_QTY_EPSILON) return true;
  return writtenOff >= planned - WRITEOFF_QTY_EPSILON;
}

export function calcRemaining(planned: number, writtenOff: number): number {
  return Math.max(0, Math.round((planned - writtenOff) * 1000) / 1000);
}

export interface WriteoffSnapshotLine {
  materialId?: number;
  halfstuffId?: number;
  balance?: number;
}

export function getMaxWriteoffSnapshotBalance(
  writeoffs: WriteoffSnapshotLine[],
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
