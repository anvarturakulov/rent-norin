export interface RentalOrderNeedLine {
  toolId: number;
  toolName?: string;
  qty: number;
}

export interface RentalOrderNeed {
  id: number;
  clientId: number;
  clientName?: string;
  warehouseId: number;
  lines: RentalOrderNeedLine[];
}

export interface ReadyRentalOrderMatch {
  ready: RentalOrderNeed[];
  enoughForAll: boolean;
}

const EPS = 0.0001;

export const orderHasFullStock = (
  lines: RentalOrderNeedLine[],
  remainByToolId: Record<number, number>,
): boolean =>
  lines.every((line) => (remainByToolId[line.toolId] || 0) + EPS >= line.qty);

export const matchReadyRentalOrders = (
  orders: RentalOrderNeed[],
  remainByToolId: Record<number, number>,
): ReadyRentalOrderMatch => {
  const ready = orders.filter((order) =>
    orderHasFullStock(order.lines, remainByToolId),
  );

  const summed: Record<number, number> = {};
  for (const order of ready) {
    for (const line of order.lines) {
      summed[line.toolId] = (summed[line.toolId] || 0) + line.qty;
    }
  }

  const enoughForAll = Object.entries(summed).every(
    ([toolId, qty]) => (remainByToolId[Number(toolId)] || 0) + EPS >= qty,
  );

  return { ready, enoughForAll };
};

export const missingStockLines = (
  lines: RentalOrderNeedLine[],
  remainByToolId: Record<number, number>,
): Array<{ toolId: number; toolName?: string; need: number; remain: number }> =>
  lines
    .map((line) => {
      const remain = remainByToolId[line.toolId] || 0;
      return {
        toolId: line.toolId,
        toolName: line.toolName,
        need: line.qty,
        remain,
      };
    })
    .filter((row) => row.need > row.remain + EPS);
