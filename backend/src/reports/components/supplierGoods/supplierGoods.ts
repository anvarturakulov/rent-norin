import { Op } from "sequelize";
import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocumentType, DocSTATUS } from "src/interfaces/document.interface";
import { Reference } from "src/references/reference.model";
import { TypeReference } from "src/interfaces/reference.interface";

const RECEIPT_DOCUMENT_TYPES = [
  DocumentType.ComeMaterial,
  DocumentType.ComeOS,
  DocumentType.ComeTovar,
];

export interface SupplierGoodsRow {
  docId: string;
  date: number;
  itemId: number;
  itemName: string;
  article: string;
  typeTMZ: string;
  unit: string;
  count: number;
  price: number;
  total: number;
}

export interface SupplierGoodsTotals {
  documentsCount: number;
  operationsCount: number;
  totalCount: number;
  totalSum: number;
}

export interface SupplierGoodsValues {
  supplierId: number | null;
  supplierName: string;
  periodStart: number | null;
  periodEnd: number | null;
  items: SupplierGoodsRow[];
  totals: SupplierGoodsTotals;
}

const emptyTotals = (): SupplierGoodsTotals => ({
  documentsCount: 0,
  operationsCount: 0,
  totalCount: 0,
  totalSum: 0,
});

const buildDocumentWhere = (
  startDate: number,
  endDate: number,
  enterpriseId?: number | null,
) => {
  const dateFilter = {
    date: { [Op.gte]: startDate, [Op.lte]: endDate },
  };
  const provedStatus = { docStatus: DocSTATUS.PROVEDEN };

  const typeFilter = {
    [Op.or]: [
      {
        enterpriseId,
        documentType: { [Op.in]: RECEIPT_DOCUMENT_TYPES },
      },
      {
        isInterEnterprise: true,
        sourceEnterpriseId: enterpriseId,
        documentType: { [Op.in]: RECEIPT_DOCUMENT_TYPES },
      },
      {
        isInterEnterprise: true,
        targetEnterpriseId: enterpriseId,
        documentTypeForReceiver: { [Op.in]: RECEIPT_DOCUMENT_TYPES },
      },
    ],
  };

  if (enterpriseId !== undefined && enterpriseId !== null) {
    return {
      [Op.and]: [dateFilter, typeFilter, provedStatus],
    };
  }

  return {
    [Op.and]: [
      dateFilter,
      {
        [Op.or]: [
          { documentType: { [Op.in]: RECEIPT_DOCUMENT_TYPES } },
          {
            isInterEnterprise: true,
            documentTypeForReceiver: { [Op.in]: RECEIPT_DOCUMENT_TYPES },
          },
          {
            isInterEnterprise: true,
            documentType: { [Op.in]: RECEIPT_DOCUMENT_TYPES },
          },
        ],
      },
      provedStatus,
    ],
  };
};

export const supplierGoods = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  supplierId: number | null,
  enterpriseId?: number | null,
): Promise<{ reportType: string; values: SupplierGoodsValues }> => {
  const supplierRef = supplierId
    ? data.find((ref) => ref.id === supplierId)
    : undefined;

  const emptyValues: SupplierGoodsValues = {
    supplierId,
    supplierName: supplierRef?.name ?? "",
    periodStart: startDate,
    periodEnd: endDate,
    items: [],
    totals: emptyTotals(),
  };

  if (!startDate || !endDate || !supplierId) {
    return { reportType: "SUPPLIER_GOODS", values: emptyValues };
  }

  const tmzRefs = new Map<number, Reference>();
  for (const ref of data) {
    if (ref.typeReference !== TypeReference.TMZ || ref.isFolder) continue;
    if (ref.id) tmzRefs.set(ref.id, ref);
  }

  const documents = await Document.findAll({
    where: buildDocumentWhere(startDate, endDate, enterpriseId),
    attributes: ["id", "date"],
    include: [
      { model: DocValues, required: true },
      { model: DocTableItems, required: false },
    ],
  });

  const matchingDocuments = documents.filter(
    (doc) => Number(doc.docValues?.senderId) === supplierId,
  );

  const items: SupplierGoodsRow[] = [];

  for (const doc of matchingDocuments) {
    const docId = String(doc.id);
    const date = Number(doc.date) || 0;
    const docItems = doc.docTableItems ?? [];

    for (const item of docItems) {
      const itemId = Number(item.analiticId);
      if (!itemId || !tmzRefs.has(itemId)) continue;

      const ref = tmzRefs.get(itemId)!;
      const count = Number(item.count) || 0;
      const price = Number(item.price) || 0;
      const total = Number(item.total) || 0;

      items.push({
        docId,
        date,
        itemId,
        itemName: ref.name ?? "",
        article: (ref.article ?? "").trim(),
        typeTMZ: ref.refValues?.typeTMZ ?? "",
        unit: ref.refValues?.unit ?? "",
        count: Math.round(count * 1000) / 1000,
        price: Math.round(price * 100) / 100,
        total: Math.round(total * 100) / 100,
      });
    }
  }

  items.sort((a, b) => {
    if (a.date !== b.date) return a.date - b.date;
    const articleCmp = a.article.localeCompare(b.article, "ru");
    if (articleCmp !== 0) return articleCmp;
    return a.itemName.localeCompare(b.itemName, "ru");
  });

  const totals: SupplierGoodsTotals = {
    documentsCount: matchingDocuments.length,
    operationsCount: items.length,
    totalCount:
      Math.round(items.reduce((sum, item) => sum + item.count, 0) * 1000) /
      1000,
    totalSum:
      Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) /
      100,
  };

  return {
    reportType: "SUPPLIER_GOODS",
    values: {
      supplierId,
      supplierName: supplierRef?.name ?? "",
      periodStart: startDate,
      periodEnd: endDate,
      items,
      totals,
    },
  };
};
