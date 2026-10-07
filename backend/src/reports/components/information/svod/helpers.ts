import { DocumentsService } from "src/documents/documents.service";
import { DocumentType } from "src/interfaces/document.interface";
import { Document } from "src/documents/document.model";
import { DocSTATUS } from "src/interfaces/document.interface";

export const getValuesFromJournal = async (
  documentType: DocumentType,
  startDate: number | null,
  endDate: number | null,
  documentsService: DocumentsService,
  enterpriseId?: number | null,
) => {
  if (!startDate || !endDate) {
    return [];
  }

  const docs = await documentsService.getAllDocumentsByTypeForDate(
    documentType,
    startDate,
    endDate,
    enterpriseId ?? undefined,
  );
  const { total, count, docCount } = getTotals(docs, totals);

  return {
    total,
    count,
    docCount,
  };
};

const totals = (item: Document) => {
  let total = item.docValues?.total ?? 0;
  let count = item.docValues?.count ?? 0;

  if (item.docTableItems?.length) {
    // Для ComeProduct берем только элементы с tableType === 'income' (приход готовой продукции)
    let itemsToSum = item.docTableItems;
    if (item.documentType === DocumentType.ComeProduct) {
      itemsToSum = item.docTableItems.filter(
        (item) => item.tableType === "income" || !item.tableType,
      );
    }

    const t = itemsToSum.reduce((summa, item) => summa + item.total, 0);
    total = t;
  }

  if (item.docTableItems?.length) {
    // Для ComeProduct берем только элементы с tableType === 'income' (приход готовой продукции)
    let itemsToSum = item.docTableItems;
    if (item.documentType === DocumentType.ComeProduct) {
      itemsToSum = item.docTableItems.filter(
        (item) => item.tableType === "income" || !item.tableType,
      );
    }

    const c = itemsToSum.reduce((count, item) => count + item.count, 0);
    count = c;
  }

  return { t: total, c: count };
};

/** Строки прихода ГП: из таблицы (legacy) или из шапки документа */
export type ComeProductIncomeLine = {
  analiticId: number;
  count: number;
};

export function getComeProductIncomeLines(
  doc: Document,
): ComeProductIncomeLine[] {
  if (doc.docTableItems?.length) {
    return doc.docTableItems
      .filter((item) => !item.tableType || item.tableType === "income")
      .map((item) => ({
        analiticId: Number(item.analiticId),
        count: Number(item.count) || 0,
      }))
      .filter((row) => row.analiticId > 0 && row.count > 0);
  }

  const analiticId = Number(doc.docValues?.analiticId) || 0;
  const count = Number(doc.docValues?.count) || 0;
  if (analiticId > 0 && count > 0) {
    return [{ analiticId, count }];
  }

  return [];
}

export function getTotals(
  filteredDocuments: Document[],
  totalsFn: (item: Document) => { t: number; c: number },
) {
  let total = 0,
    count = 0,
    docCount = 0;
  filteredDocuments.forEach((item) => {
    if (item.docStatus == DocSTATUS.PROVEDEN) {
      const { t, c } = totalsFn(item);
      total += t;
      count += c;
      docCount += 1;
    }
  });
  return { total, count, docCount };
}
