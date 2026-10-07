import { Op } from "sequelize";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import {
  DocSTATUS,
  DocumentType,
  RentTariffType,
} from "src/interfaces/document.interface";
import { Schet } from "src/interfaces/report.interface";
import { StocksService } from "src/stocks/stocks.service";
import {
  matchReadyRentalOrders,
  missingStockLines,
  orderHasFullStock,
  RentalOrderNeed,
} from "src/documents/helper/rentalOrderMatch";

const EPS = 0.0001;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RentalUnfulfilledOrderStatus =
  | "ready"
  | "missingStock"
  | "transferDraft";

export type RentalUnfulfilledOrderLine = {
  toolId: number;
  toolName: string;
  qty: number;
  remain: number;
  missing: number;
};

export type RentalUnfulfilledOrder = {
  id: number;
  date: number;
  daysWaiting: number;
  warehouseId: number;
  warehouseName: string;
  rentTariffType: string;
  comment: string | null;
  status: RentalUnfulfilledOrderStatus;
  canFulfillAlone: boolean;
  transferDraftDocId: number | null;
  transferDraftStatus: string | null;
  qtyTotal: number;
  lines: RentalUnfulfilledOrderLine[];
};

export type RentalUnfulfilledClient = {
  clientId: number;
  clientName: string;
  ordersCount: number;
  readyCount: number;
  waitingCount: number;
  transferDraftCount: number;
  qtyTotal: number;
  orders: RentalUnfulfilledOrder[];
};

export type RentalUnfulfilledShortage = {
  warehouseId: number;
  warehouseName: string;
  toolId: number;
  toolName: string;
  need: number;
  remain: number;
  missing: number;
};

export type RentalUnfulfilledSummary = {
  clientsTotal: number;
  ordersTotal: number;
  readyCount: number;
  waitingCount: number;
  transferDraftCount: number;
  qtyTotal: number;
  oldestWaitDays: number;
  enoughForAll: boolean;
};

export type RentalUnfulfilledOrdersValues = {
  asOf: number;
  summary: RentalUnfulfilledSummary;
  clients: RentalUnfulfilledClient[];
  shortages: RentalUnfulfilledShortage[];
};

const emptySummary = (): RentalUnfulfilledSummary => ({
  clientsTotal: 0,
  ordersTotal: 0,
  readyCount: 0,
  waitingCount: 0,
  transferDraftCount: 0,
  qtyTotal: 0,
  oldestWaitDays: 0,
  enoughForAll: true,
});

const emptyValues = (asOf: number): RentalUnfulfilledOrdersValues => ({
  asOf,
  summary: emptySummary(),
  clients: [],
  shortages: [],
});

const isToolOrderTableRow = (row: {
  tableType?: string | null;
  analiticId?: number | null;
  count?: number | null;
}): boolean => {
  if (!row?.analiticId || Number(row.count) <= 0) return false;
  if (row.tableType === "sale" || row.tableType === "tovar") return false;
  return true;
};

const refName = (data: any, id: number, fallbackPrefix = "ID"): string => {
  if (!id) return "—";
  if (Array.isArray(data)) {
    const item = data.find((ref: any) => Number(ref?.id) === id);
    if (item?.name) return String(item.name);
  }
  return `${fallbackPrefix} ${id}`;
};

const roundQty = (value: number): number =>
  Math.round((Number(value) || 0) * 1000) / 1000;

const daysBetween = (fromMs: number, toMs: number): number => {
  if (!fromMs || fromMs <= 0) return 0;
  return Math.max(0, Math.floor((toMs - fromMs) / DAY_MS));
};

const loadRemainByWarehouse = async (
  pairs: Array<{ warehouseId: number; toolId: number }>,
  asOf: number,
  enterpriseId: number,
  stocksService: StocksService,
): Promise<Map<number, Record<number, number>>> => {
  const remainByWarehouse = new Map<number, Record<number, number>>();
  const unique = new Map<string, { warehouseId: number; toolId: number }>();
  for (const pair of pairs) {
    if (pair.warehouseId <= 0 || pair.toolId <= 0) continue;
    unique.set(`${pair.warehouseId}:${pair.toolId}`, pair);
  }
  const targetDate = Number(asOf) + DAY_MS;
  await Promise.all(
    [...unique.values()].map(async ({ warehouseId, toolId }) => {
      const stock = await stocksService.getStockByDate(
        Schet.S11,
        warehouseId,
        toolId,
        targetDate,
        undefined,
        enterpriseId,
      );
      const current = remainByWarehouse.get(warehouseId) || {};
      current[toolId] = Number(stock.remainCount) || 0;
      remainByWarehouse.set(warehouseId, current);
    }),
  );
  return remainByWarehouse;
};

export const rentalUnfulfilledOrders = async (
  data: any,
  endDate: number | null,
  stocksService: StocksService,
  enterpriseId?: number | null,
): Promise<{ reportType: string; values: RentalUnfulfilledOrdersValues }> => {
  const asOf = Number(endDate) > 0 ? Number(endDate) : Date.now();
  const resolvedEnterpriseId =
    enterpriseId !== undefined && enterpriseId !== null
      ? Number(enterpriseId)
      : null;

  if (!resolvedEnterpriseId) {
    return { reportType: "RentalUnfulfilledOrders", values: emptyValues(asOf) };
  }

  const orders = await Document.findAll({
    where: {
      enterpriseId: resolvedEnterpriseId,
      documentType: DocumentType.OrderToolsToClient,
      docStatus: DocSTATUS.PROVEDEN,
    },
    include: [DocValues, DocTableItems],
    order: [
      ["date", "ASC"],
      ["id", "ASC"],
    ],
  });

  const openOrders = orders.filter((doc) => {
    const fulfilled = Number(doc.docValues?.fulfilledByTransferDocId) || 0;
    return fulfilled <= 0;
  });

  if (!openOrders.length) {
    return { reportType: "RentalUnfulfilledOrders", values: emptyValues(asOf) };
  }

  const orderIds = openOrders.map((doc) => Number(doc.id));
  const linkedTransfers = await Document.findAll({
    where: {
      enterpriseId: resolvedEnterpriseId,
      documentType: DocumentType.TransferToolsToClient,
      docStatus: { [Op.ne]: DocSTATUS.DELETED },
    },
    include: [
      {
        model: DocValues,
        where: { sourceRentalOrderDocId: { [Op.in]: orderIds } },
        required: true,
      },
    ],
  });

  const transferByOrderId = new Map<
    number,
    { id: number; status: string }
  >();
  for (const transfer of linkedTransfers) {
    const orderId = Number(transfer.docValues?.sourceRentalOrderDocId) || 0;
    if (orderId <= 0) continue;
    const current = transferByOrderId.get(orderId);
    const candidate = {
      id: Number(transfer.id),
      status: String(transfer.docStatus || ""),
    };
    if (!current || candidate.id < current.id) {
      transferByOrderId.set(orderId, candidate);
    }
  }

  const stockPairs: Array<{ warehouseId: number; toolId: number }> = [];
  const parsedOrders: Array<{
    doc: Document;
    clientId: number;
    warehouseId: number;
    lines: Array<{ toolId: number; qty: number }>;
  }> = [];

  for (const doc of openOrders) {
    const lines = (doc.docTableItems || [])
      .filter((row) => isToolOrderTableRow(row))
      .map((row) => ({
        toolId: Number(row.analiticId),
        qty: Number(row.count) || 0,
      }));
    if (!lines.length) continue;
    const warehouseId = Number(doc.docValues?.senderId) || 0;
    const clientId = Number(doc.docValues?.receiverId) || 0;
    parsedOrders.push({ doc, clientId, warehouseId, lines });
    for (const line of lines) {
      stockPairs.push({ warehouseId, toolId: line.toolId });
    }
  }

  if (!parsedOrders.length) {
    return { reportType: "RentalUnfulfilledOrders", values: emptyValues(asOf) };
  }

  const remainByWarehouse = await loadRemainByWarehouse(
    stockPairs,
    asOf,
    resolvedEnterpriseId,
    stocksService,
  );

  const builtOrders: Array<RentalUnfulfilledOrder & { clientId: number }> = [];
  const readyNeedsByWarehouse = new Map<number, RentalOrderNeed[]>();
  const demandByKey = new Map<
    string,
    { warehouseId: number; toolId: number; need: number }
  >();

  for (const item of parsedOrders) {
    const remain = remainByWarehouse.get(item.warehouseId) || {};
    const needLines = item.lines.map((line) => ({
      toolId: line.toolId,
      toolName: refName(data, line.toolId),
      qty: line.qty,
    }));
    const canFulfillAlone = orderHasFullStock(needLines, remain);
    const missing = missingStockLines(needLines, remain);
    const missingByTool = new Map(
      missing.map((row) => [row.toolId, Math.max(0, row.need - row.remain)]),
    );
    const transfer = transferByOrderId.get(Number(item.doc.id));
    const status: RentalUnfulfilledOrderStatus = transfer
      ? "transferDraft"
      : canFulfillAlone
        ? "ready"
        : "missingStock";

    const lines: RentalUnfulfilledOrderLine[] = needLines.map((line) => {
      const lineRemain = remain[line.toolId] || 0;
      return {
        toolId: line.toolId,
        toolName: line.toolName || `ID ${line.toolId}`,
        qty: roundQty(line.qty),
        remain: roundQty(lineRemain),
        missing: roundQty(missingByTool.get(line.toolId) || 0),
      };
    });

    const qtyTotal = roundQty(
      lines.reduce((sum, line) => sum + line.qty, 0),
    );
    const date = Number(item.doc.date) || 0;
    const rentTariffType =
      item.doc.docValues?.rentTariffType === RentTariffType.TRANSFER
        ? RentTariffType.TRANSFER
        : RentTariffType.CASH;
    const commentRaw = item.doc.docValues?.comment;
    const comment =
      typeof commentRaw === "string" && commentRaw.trim()
        ? commentRaw.trim()
        : null;

    builtOrders.push({
      id: Number(item.doc.id),
      date,
      daysWaiting: daysBetween(date, asOf),
      warehouseId: item.warehouseId,
      warehouseName: refName(data, item.warehouseId),
      rentTariffType,
      comment,
      status,
      canFulfillAlone,
      transferDraftDocId: transfer?.id ?? null,
      transferDraftStatus: transfer?.status ?? null,
      qtyTotal,
      lines,
      clientId: item.clientId,
    });

    if (status === "ready") {
      const list = readyNeedsByWarehouse.get(item.warehouseId) || [];
      list.push({
        id: Number(item.doc.id),
        clientId: item.clientId,
        warehouseId: item.warehouseId,
        lines: needLines,
      });
      readyNeedsByWarehouse.set(item.warehouseId, list);
    }

    for (const line of item.lines) {
      const key = `${item.warehouseId}:${line.toolId}`;
      const current = demandByKey.get(key);
      if (current) {
        current.need += line.qty;
      } else {
        demandByKey.set(key, {
          warehouseId: item.warehouseId,
          toolId: line.toolId,
          need: line.qty,
        });
      }
    }
  }

  let enoughForAll = true;
  for (const [warehouseId, needs] of readyNeedsByWarehouse.entries()) {
    const remain = remainByWarehouse.get(warehouseId) || {};
    const matched = matchReadyRentalOrders(needs, remain);
    if (!matched.enoughForAll) {
      enoughForAll = false;
      break;
    }
  }

  const shortages: RentalUnfulfilledShortage[] = [];
  for (const item of demandByKey.values()) {
    const remain =
      (remainByWarehouse.get(item.warehouseId) || {})[item.toolId] || 0;
    if (item.need <= remain + EPS) continue;
    shortages.push({
      warehouseId: item.warehouseId,
      warehouseName: refName(data, item.warehouseId),
      toolId: item.toolId,
      toolName: refName(data, item.toolId),
      need: roundQty(item.need),
      remain: roundQty(remain),
      missing: roundQty(item.need - remain),
    });
  }
  shortages.sort((a, b) => {
    if (b.missing !== a.missing) return b.missing - a.missing;
    return a.toolName.localeCompare(b.toolName, "uz");
  });

  const clientsMap = new Map<number, RentalUnfulfilledClient>();
  for (const order of builtOrders) {
    const { clientId, ...orderRow } = order;
    const existing = clientsMap.get(clientId);
    const client: RentalUnfulfilledClient = existing || {
      clientId,
      clientName: refName(data, clientId),
      ordersCount: 0,
      readyCount: 0,
      waitingCount: 0,
      transferDraftCount: 0,
      qtyTotal: 0,
      orders: [],
    };
    client.orders.push(orderRow);
    client.ordersCount += 1;
    client.qtyTotal = roundQty(client.qtyTotal + order.qtyTotal);
    if (order.status === "ready") client.readyCount += 1;
    else if (order.status === "transferDraft") client.transferDraftCount += 1;
    else client.waitingCount += 1;
    clientsMap.set(clientId, client);
  }

  const clients = [...clientsMap.values()].sort((a, b) =>
    a.clientName.localeCompare(b.clientName, "uz"),
  );

  const summary: RentalUnfulfilledSummary = {
    clientsTotal: clients.length,
    ordersTotal: builtOrders.length,
    readyCount: builtOrders.filter((order) => order.status === "ready").length,
    waitingCount: builtOrders.filter((order) => order.status === "missingStock")
      .length,
    transferDraftCount: builtOrders.filter(
      (order) => order.status === "transferDraft",
    ).length,
    qtyTotal: roundQty(
      builtOrders.reduce((sum, order) => sum + order.qtyTotal, 0),
    ),
    oldestWaitDays: builtOrders.reduce(
      (max, order) => Math.max(max, order.daysWaiting),
      0,
    ),
    enoughForAll,
  };

  return {
    reportType: "RentalUnfulfilledOrders",
    values: { asOf, summary, clients, shortages },
  };
};
