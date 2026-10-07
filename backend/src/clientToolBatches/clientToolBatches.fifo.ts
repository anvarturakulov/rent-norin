export interface FifoBatchLike {
  id?: number;
  transferDocId: number;
  toolId: number;
  openQty: number;
}

export interface FifoConsumptionPlan {
  batchIndex: number;
  qty: number;
}

export const planFifoConsumptions = (
  batches: FifoBatchLike[],
  toolId: number,
  qty: number,
  transferDocId?: number | null,
): FifoConsumptionPlan[] => {
  const plans: FifoConsumptionPlan[] = [];
  let left = qty;

  const consumePass = (pinnedId: number | null | undefined) => {
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (batch.toolId !== toolId || batch.openQty <= 0) continue;
      if (pinnedId && batch.transferDocId !== pinnedId) continue;

      const take = Math.min(batch.openQty, left);
      if (take <= 0) continue;

      batch.openQty -= take;
      left -= take;
      plans.push({ batchIndex: i, qty: take });
      if (left <= 0) break;
      if (pinnedId) break;
    }
  };

  consumePass(transferDocId ?? null);
  if (transferDocId && left > 0) {
    consumePass(null);
  }

  if (left > 0) {
    throw new Error(
      `Insufficient open batches for tool ${toolId}: missing ${left}`,
    );
  }

  return plans;
};
