import { Op } from "sequelize";
import { ClientContract } from "src/clientContracts/clientContract.model";
import { ClientContractItemLine } from "src/clientContracts/clientContractItemLine.model";
import { ClientContractOrderLine } from "src/clientContracts/clientContractOrderLine.model";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import {
  ClientContractItemKind,
  ClientContractStatus,
} from "src/interfaces/client-contract.interface";
import { DocSTATUS } from "src/interfaces/document.interface";
import { Reference } from "src/references/reference.model";
import { qtyPriceFromFurnitureOrder } from "src/clientContracts/client-contracts.utils";

export type FulfillmentState =
  | "FULFILLED"
  | "IN_PROGRESS"
  | "NOT_STARTED"
  | "EMPTY";

export type ContractFulfillmentSaleDoc = {
  id: number;
  date: number | null;
  documentType: string | null;
  docStatus: string | null;
};

export type ContractFulfillmentOrderLine = {
  lineId: number;
  furnitureOrderId: number;
  orderNumber: string;
  productName: string;
  count: number;
  price: number;
  total: number;
  orderPrice: number;
  currentStage: string | null;
  saleDoc: ContractFulfillmentSaleDoc | null;
  fulfilled: boolean;
};

export type ContractFulfillmentItemLine = {
  lineId: number;
  lineKind: string;
  analiticName: string;
  count: number;
  price: number;
  total: number;
  saleDoc: ContractFulfillmentSaleDoc | null;
  fulfilled: boolean;
};

export type ContractFulfillmentRow = {
  contractId: number;
  contractNumber: string;
  contractDate: number;
  status: ClientContractStatus | string;
  clientId: number;
  clientName: string;
  fulfillment: {
    done: number;
    total: number;
    state: FulfillmentState;
  };
  amountTotal: number;
  amountFulfilled: number;
  orderLines: ContractFulfillmentOrderLine[];
  itemLines: ContractFulfillmentItemLine[];
  serviceLines: ContractFulfillmentItemLine[];
};

export type ContractFulfillmentSummary = {
  contractsTotal: number;
  fullyFulfilled: number;
  inProgress: number;
  notStarted: number;
  empty: number;
  linesTotal: number;
  linesDone: number;
  amountTotal: number;
  amountFulfilled: number;
};

export type ContractFulfillmentValues = {
  summary: ContractFulfillmentSummary;
  contracts: ContractFulfillmentRow[];
};

export function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toAmount(value: unknown): number {
  const n = toNum(value);
  return n ?? 0;
}

export function fulfillmentState(done: number, total: number): FulfillmentState {
  if (total <= 0) return "EMPTY";
  if (done >= total) return "FULFILLED";
  if (done <= 0) return "NOT_STARTED";
  return "IN_PROGRESS";
}

function mapSaleDoc(doc?: Document | null): ContractFulfillmentSaleDoc | null {
  if (!doc) return null;
  const id = toNum(doc.id);
  if (!id) return null;
  return {
    id,
    date: toNum(doc.date),
    documentType: doc.documentType ?? null,
    docStatus: doc.docStatus ?? null,
  };
}

function isLineFulfilled(
  saleDocId: number | null,
  saleDoc: ContractFulfillmentSaleDoc | null,
): boolean {
  if (!saleDocId) return false;
  if (saleDoc?.docStatus === DocSTATUS.DELETED) return false;
  return true;
}

const contractInclude = [
  { model: Reference, as: "client", attributes: ["id", "name"] },
  {
    model: ClientContractOrderLine,
    include: [
      {
        model: FurnitureOrder,
        as: "furnitureOrder",
        attributes: [
          "id",
          "orderNumber",
          "currentStage",
          "analiticId",
          "saleDocId",
          "count",
          "price",
          "total",
        ],
        include: [
          { model: Reference, as: "analitic", attributes: ["id", "name"] },
        ],
      },
    ],
  },
  {
    model: ClientContractItemLine,
    include: [
      { model: Reference, as: "analitic", attributes: ["id", "name"] },
    ],
  },
];

function collectSaleDocIds(contracts: ClientContract[]): Set<number> {
  const extraSaleIds = new Set<number>();
  for (const contract of contracts) {
    for (const line of contract.orderLines ?? []) {
      const lineSaleId = toNum(line.saleDocId);
      const orderSaleId = toNum(line.furnitureOrder?.saleDocId);
      if (lineSaleId) extraSaleIds.add(lineSaleId);
      else if (orderSaleId) extraSaleIds.add(orderSaleId);
    }
    for (const line of contract.itemLines ?? []) {
      const lineSaleId = toNum(line.saleDocId);
      if (lineSaleId) extraSaleIds.add(lineSaleId);
    }
  }
  return extraSaleIds;
}

export function mapContractToRow(
  contract: ClientContract,
  extraDocMap: Map<number, Document>,
): ContractFulfillmentRow {
  const orderLines: ContractFulfillmentOrderLine[] = (
    contract.orderLines ?? []
  ).map((line) => {
    const order = line.furnitureOrder;
    const lineSaleId = toNum(line.saleDocId);
    const orderSaleId = toNum(order?.saleDocId);
    const saleDocId = lineSaleId ?? orderSaleId;
    const saleDoc = saleDocId
      ? mapSaleDoc(extraDocMap.get(saleDocId) ?? null)
      : null;
    const live = qtyPriceFromFurnitureOrder(order, {
      qty: line.qty,
      orderPrice: line.orderPrice,
    });
    const count = live.count;
    const price = live.orderPrice;
    const total = live.amount;
    return {
      lineId: toNum(line.id) ?? 0,
      furnitureOrderId: toNum(line.furnitureOrderId) ?? 0,
      orderNumber: order?.orderNumber ?? String(line.furnitureOrderId ?? ""),
      productName: order?.analitic?.name ?? "—",
      count,
      price,
      total,
      orderPrice: price,
      currentStage: order?.currentStage ?? null,
      saleDoc,
      fulfilled: isLineFulfilled(saleDocId, saleDoc),
    };
  });

  const mappedItems = (contract.itemLines ?? []).map((line) => {
    const saleDocId = toNum(line.saleDocId);
    const saleDoc = saleDocId
      ? mapSaleDoc(extraDocMap.get(saleDocId) ?? null)
      : null;
    const total = toAmount(line.total);
    const item: ContractFulfillmentItemLine = {
      lineId: toNum(line.id) ?? 0,
      lineKind: line.lineKind,
      analiticName: line.analitic?.name ?? "—",
      count: toAmount(line.count),
      price: toAmount(line.price),
      total,
      saleDoc,
      fulfilled: isLineFulfilled(saleDocId, saleDoc),
    };
    return item;
  });

  const itemLines = mappedItems.filter(
    (l) => l.lineKind !== ClientContractItemKind.SERVICE,
  );
  const serviceLines = mappedItems.filter(
    (l) => l.lineKind === ClientContractItemKind.SERVICE,
  );

  const allLines = [...orderLines, ...itemLines, ...serviceLines];
  const done = allLines.filter((l) => l.fulfilled).length;
  const total = allLines.length;
  const amountTotal =
    orderLines.reduce((s, l) => s + l.total, 0) +
    itemLines.reduce((s, l) => s + l.total, 0) +
    serviceLines.reduce((s, l) => s + l.total, 0);
  const amountFulfilled =
    orderLines.reduce((s, l) => s + (l.fulfilled ? l.total : 0), 0) +
    itemLines.reduce((s, l) => s + (l.fulfilled ? l.total : 0), 0) +
    serviceLines.reduce((s, l) => s + (l.fulfilled ? l.total : 0), 0);

  return {
    contractId: toNum(contract.id) ?? 0,
    contractNumber: contract.contractNumber ?? "",
    contractDate: toNum(contract.contractDate) ?? 0,
    status: contract.status ?? ClientContractStatus.DRAFT,
    clientId: toNum(contract.clientId) ?? 0,
    clientName: contract.client?.name ?? "—",
    fulfillment: {
      done,
      total,
      state: fulfillmentState(done, total),
    },
    amountTotal,
    amountFulfilled,
    orderLines,
    itemLines,
    serviceLines,
  };
}

export async function loadMappedContracts(options: {
  startDate?: number | null;
  endDate?: number | null;
  enterpriseId?: number | null;
}): Promise<ContractFulfillmentRow[]> {
  const where: Record<string, unknown> = {};
  if (options.startDate && options.endDate) {
    where.contractDate = { [Op.between]: [options.startDate, options.endDate] };
  }
  if (options.enterpriseId !== undefined && options.enterpriseId !== null) {
    where.enterpriseId = options.enterpriseId;
  }

  const contracts = await ClientContract.findAll({
    where,
    include: contractInclude as any,
    order: [
      ["contractDate", "DESC"],
      ["id", "DESC"],
    ],
    subQuery: false,
  });

  const extraSaleIds = collectSaleDocIds(contracts);
  const extraDocs =
    extraSaleIds.size > 0
      ? await Document.findAll({
          where: { id: [...extraSaleIds] },
          include: [{ model: DocValues, required: false }],
        })
      : [];
  const extraDocMap = new Map<number, Document>();
  for (const doc of extraDocs) {
    const id = toNum(doc.id);
    if (id) extraDocMap.set(id, doc);
  }

  return contracts.map((contract) => mapContractToRow(contract, extraDocMap));
}
