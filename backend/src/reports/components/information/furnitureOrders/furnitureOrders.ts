import { Op, col, fn, where as sqlWhere } from "sequelize";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { DocumentType, DocSTATUS } from "src/interfaces/document.interface";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";

export type FurnitureOrderDocInfo = {
  documentId: number;
  date?: number;
  total: number;
};

export type FurnitureOrderFileInfo = {
  url: string;
  originalName?: string;
};

export type FurnitureOrderInformRow = {
  orderId: number;
  orderNumber: string;
  orderDate: number | null;
  deadlineDate: number | null;
  currentStage: string | null;
  productId: number | null;
  productName: string;
  /** Первое фото галереи ТМЗ (imagePath / imagePath2 / imagePath3). */
  productImagePath: string | null;
  count: number;
  clientName: string;
  materialWriteoffDocs: FurnitureOrderDocInfo[];
  halfstuffWriteoffDocs: FurnitureOrderDocInfo[];
  receiptDocs: FurnitureOrderDocInfo[];
  saleDocs: FurnitureOrderDocInfo[];
  files: FurnitureOrderFileInfo[];
};

const MATERIAL_WRITEOFF_TYPES: DocumentType[] = [
  DocumentType.LeaveMaterial,
  DocumentType.LeaveOnlyOneMaterial,
  DocumentType.LeaveProd,
];

const REPORT_DOC_TYPES: DocumentType[] = [
  ...MATERIAL_WRITEOFF_TYPES,
  DocumentType.LeaveHalfstuff,
  DocumentType.ComeProduct,
  DocumentType.SaleProd,
];

const FILE_FIELDS = [
  "filesFromScaling",
  "filesFromDrawing",
  "filesFromPricing",
  "filesFromStore",
  "filesFromDelivery",
] as const;

function effectiveOrderDateExpr() {
  return fn("COALESCE", fn("NULLIF", col("orderDate"), 0), col("createdDate"));
}

function parseFileList(raw?: string | null): FurnitureOrderFileInfo[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: FurnitureOrderFileInfo[] = [];
    for (const item of parsed) {
      if (typeof item === "string" && item.trim()) {
        result.push({ url: item.trim() });
        continue;
      }
      if (item && typeof item === "object") {
        const url = typeof item.url === "string" ? item.url.trim() : "";
        if (!url) continue;
        const originalName =
          typeof item.originalName === "string" && item.originalName.trim()
            ? item.originalName.trim()
            : undefined;
        result.push({ url, originalName });
      }
    }
    return result;
  } catch {
    return [];
  }
}

/** Как toStoreWorkDocInfo: без return/brak. */
function isCountableTableItem(tableType?: string | null): boolean {
  if (!tableType) return true;
  return tableType !== "return" && tableType !== "brak";
}

/** Первое непустое фото из галереи карточки ТМЗ. */
function pickProductImagePath(refValues?: {
  imagePath?: string | null;
  imagePath2?: string | null;
  imagePath3?: string | null;
} | null): string | null {
  if (!refValues) return null;
  for (const key of ["imagePath", "imagePath2", "imagePath3"] as const) {
    const value = refValues[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function lineAmount(item: {
  total?: number | null;
  costTotal?: number | null;
  count?: number | null;
  price?: number | null;
}): number {
  const total = Number(item.total || 0);
  if (total) return total;
  const costTotal = Number(item.costTotal || 0);
  if (costTotal) return costTotal;
  return Number(item.count || 0) * Number(item.price || 0);
}

/**
 * Сумма документа как в складской карточке / при открытии:
 * строки таблицы (total || costTotal || count*price), иначе шапка.
 */
function docTotal(
  doc: Document,
  tableTotalByDocId: Map<number, number>,
): number {
  const fromTable = tableTotalByDocId.get(Number(doc.id)) ?? 0;
  if (fromTable) {
    return Number(Number(fromTable).toFixed(2));
  }
  return Number(Number(doc.docValues?.total || 0).toFixed(2));
}

function toDocInfo(
  doc: Document,
  tableTotalByDocId: Map<number, number>,
): FurnitureOrderDocInfo {
  return {
    documentId: Number(doc.id),
    date: doc.date != null ? Number(doc.date) : undefined,
    total: docTotal(doc, tableTotalByDocId),
  };
}

async function loadTableTotalsByDocId(
  docIds: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!docIds.length) return map;

  const rows = await DocTableItems.findAll({
    where: { docId: { [Op.in]: docIds } },
    attributes: ["docId", "total", "price", "count", "costTotal", "tableType"],
  });

  for (const item of rows) {
    if (!isCountableTableItem(item.tableType)) continue;
    const docId = Number(item.docId);
    if (!docId) continue;
    map.set(docId, (map.get(docId) ?? 0) + lineAmount(item));
  }

  for (const [docId, sum] of map) {
    map.set(docId, Number(Number(sum).toFixed(2)));
  }
  return map;
}

async function loadProductImageByReferenceId(
  productIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!productIds.length) return map;

  const rows = await RefValues.findAll({
    where: { referenceId: { [Op.in]: productIds } },
    attributes: ["referenceId", "imagePath", "imagePath2", "imagePath3"],
  });

  for (const rv of rows) {
    const refId = Number(rv.referenceId);
    if (!refId) continue;
    const path = pickProductImagePath(rv);
    if (path) map.set(refId, path);
  }
  return map;
}

export const furnitureOrders = async (
  startDate: number | null,
  endDate: number | null,
  enterpriseId?: number | null,
): Promise<{ reportType: string; values: FurnitureOrderInformRow[] }> => {
  if (!startDate || !endDate) {
    return { reportType: "FurnitureOrders", values: [] };
  }

  const effectiveDate = effectiveOrderDateExpr();
  const orderWhere: any = {
    [Op.and]: [
      sqlWhere(effectiveDate, { [Op.gte]: startDate }),
      sqlWhere(effectiveDate, { [Op.lte]: endDate }),
    ],
  };
  if (enterpriseId !== undefined && enterpriseId !== null) {
    orderWhere.enterpriseId = enterpriseId;
  }

  const orders = await FurnitureOrder.findAll({
    where: orderWhere,
    attributes: [
      "id",
      "orderNumber",
      "orderDate",
      "createdDate",
      "deadlineDate",
      "currentStage",
      "analiticId",
      "clientId",
      "count",
      "filesFromScaling",
      "filesFromDrawing",
      "filesFromPricing",
      "filesFromStore",
      "filesFromDelivery",
    ],
    include: [
      { model: Reference, as: "client", attributes: ["id", "name"] },
      { model: Reference, as: "analitic", attributes: ["id", "name"] },
    ],
    order: [
      [effectiveDate, "ASC"],
      ["id", "ASC"],
    ],
  });

  if (!orders.length) {
    return { reportType: "FurnitureOrders", values: [] };
  }

  const orderIds = orders.map((o) => Number(o.id));
  const productIds = [
    ...new Set(
      orders
        .map((o) => Number(o.analiticId || 0))
        .filter((id) => id > 0),
    ),
  ];

  const [docs, productImageByRefId] = await Promise.all([
    Document.findAll({
      where: {
        documentType: { [Op.in]: REPORT_DOC_TYPES },
        docStatus: DocSTATUS.PROVEDEN,
      },
      attributes: ["id", "date", "documentType", "docStatus"],
      include: [
        {
          model: DocValues,
          where: { orderId: { [Op.in]: orderIds } },
          required: true,
          attributes: ["docId", "orderId", "total"],
        },
      ],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    }),
    loadProductImageByReferenceId(productIds),
  ]);

  const docIds = docs.map((d) => Number(d.id)).filter((id) => id > 0);
  const tableTotalByDocId = await loadTableTotalsByDocId(docIds);

  const materialDocsByOrder = new Map<number, FurnitureOrderDocInfo[]>();
  const halfstuffDocsByOrder = new Map<number, FurnitureOrderDocInfo[]>();
  const receiptDocsByOrder = new Map<number, FurnitureOrderDocInfo[]>();
  const saleDocsByOrder = new Map<number, FurnitureOrderDocInfo[]>();

  for (const doc of docs) {
    const orderId = Number(doc.docValues?.orderId || 0);
    if (!orderId) continue;

    const info = toDocInfo(doc, tableTotalByDocId);

    if (MATERIAL_WRITEOFF_TYPES.includes(doc.documentType)) {
      const list = materialDocsByOrder.get(orderId) ?? [];
      list.push(info);
      materialDocsByOrder.set(orderId, list);
      continue;
    }

    if (doc.documentType === DocumentType.LeaveHalfstuff) {
      const list = halfstuffDocsByOrder.get(orderId) ?? [];
      list.push(info);
      halfstuffDocsByOrder.set(orderId, list);
      continue;
    }

    if (doc.documentType === DocumentType.ComeProduct) {
      const list = receiptDocsByOrder.get(orderId) ?? [];
      list.push(info);
      receiptDocsByOrder.set(orderId, list);
      continue;
    }

    if (doc.documentType === DocumentType.SaleProd) {
      const list = saleDocsByOrder.get(orderId) ?? [];
      list.push(info);
      saleDocsByOrder.set(orderId, list);
    }
  }

  const values: FurnitureOrderInformRow[] = orders.map((order) => {
    const orderId = Number(order.id);
    const registrationDate =
      Number(order.orderDate || 0) > 0
        ? Number(order.orderDate)
        : Number(order.createdDate || 0) || null;
    const productId =
      order.analiticId != null ? Number(order.analiticId) : null;

    const files: FurnitureOrderFileInfo[] = [];
    for (const field of FILE_FIELDS) {
      files.push(...parseFileList((order as any)[field]));
    }

    return {
      orderId,
      orderNumber: order.orderNumber || String(orderId),
      orderDate: registrationDate,
      deadlineDate:
        Number(order.deadlineDate || 0) > 0 ? Number(order.deadlineDate) : null,
      currentStage: order.currentStage ?? null,
      productId,
      productName: order.analitic?.name || "—",
      productImagePath:
        productId != null ? productImageByRefId.get(productId) ?? null : null,
      count: Number(order.count || 0),
      clientName: order.client?.name || "—",
      materialWriteoffDocs: materialDocsByOrder.get(orderId) ?? [],
      halfstuffWriteoffDocs: halfstuffDocsByOrder.get(orderId) ?? [],
      receiptDocs: receiptDocsByOrder.get(orderId) ?? [],
      saleDocs: saleDocsByOrder.get(orderId) ?? [],
      files,
    };
  });

  // ASC: сначала ранние даты регистрации, потом поздние
  values.sort((a, b) => {
    const dateA = Number(a.orderDate || 0);
    const dateB = Number(b.orderDate || 0);
    if (dateA !== dateB) return dateA - dateB;
    return Number(a.orderId) - Number(b.orderId);
  });

  return { reportType: "FurnitureOrders", values };
};
