import {
  DocTableItem,
  DocumentModel,
  getBrakItems,
  getReturnItems,
  getSaleItems,
  getTovarItems,
} from '@/app/interfaces/document.interface';
import { getBatchKey } from '@/app/service/documents/receiveToolsBatchRemain';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ReceiveToolsCopyTarget = 'brak' | 'sale';

export const getReceiveToolsItemBatchKey = (item: DocTableItem): string => {
  if (item.sourceTransferDocId && item.analiticId) {
    return getBatchKey(item.sourceTransferDocId, item.analiticId);
  }
  return `a:${item.analiticId}`;
};

const sumSectionQtyByBatchKey = (
  items: DocTableItem[],
  batchKey: string,
  sections: ReceiveToolsCopyTarget[],
): number =>
  items
    .filter(
      (item) =>
        sections.includes(item.tableType as ReceiveToolsCopyTarget) &&
        getReceiveToolsItemBatchKey(item) === batchKey,
    )
    .reduce((sum, item) => sum + (Number(item.count) || 0), 0);

export const getReceiveToolsCopyRemainQty = (
  returnItem: DocTableItem,
  allItems: DocTableItem[],
): number => {
  const batchKey = getReceiveToolsItemBatchKey(returnItem);
  const returnQty = Number(returnItem.count) || 0;
  const allocated = sumSectionQtyByBatchKey(allItems, batchKey, ['brak', 'sale']);
  return Math.max(0, round2(returnQty - allocated));
};

const buildSectionRowFromReturn = (
  returnItem: DocTableItem,
  target: ReceiveToolsCopyTarget,
  qty: number,
): DocTableItem => {
  const costPrice = Number(returnItem.costPrice) || 0;
  const costTotal = round2(costPrice * qty);

  return {
    analiticId: returnItem.analiticId,
    count: qty,
    price: costPrice,
    total: costTotal,
    costPrice,
    costTotal,
    balance: returnItem.balance ?? 0,
    sourceTransferDocId: returnItem.sourceTransferDocId,
    tableType: target,
  };
};

const mergeIntoSection = (
  sectionItems: DocTableItem[],
  newRow: DocTableItem,
): DocTableItem[] => {
  const batchKey = getReceiveToolsItemBatchKey(newRow);
  const existingIndex = sectionItems.findIndex(
    (item) => getReceiveToolsItemBatchKey(item) === batchKey,
  );

  if (existingIndex < 0) {
    return [...sectionItems, newRow];
  }

  const existing = sectionItems[existingIndex];
  const newCount = round2((Number(existing.count) || 0) + (Number(newRow.count) || 0));
  const costPrice = Number(existing.costPrice) || Number(newRow.costPrice) || 0;
  const costTotal = round2(costPrice * newCount);

  const updated = [...sectionItems];
  updated[existingIndex] = {
    ...existing,
    count: newCount,
    price: costPrice,
    total: costTotal,
    costPrice,
    costTotal,
  };
  return updated;
};

export const copyReturnRowToSection = (
  currentDocument: DocumentModel,
  documentRowIndex: number,
  target: ReceiveToolsCopyTarget,
  qty: number,
): { docTableItems: DocTableItem[] } | { error: string } => {
  const allItems = currentDocument.docTableItems || [];
  const returnItem = allItems[documentRowIndex];

  if (
    !returnItem ||
    (returnItem.tableType && returnItem.tableType !== 'return')
  ) {
    return { error: 'Строка возврата не найдена' };
  }

  const returnItems = getReturnItems(allItems);

  const parsedQty = round2(Number(qty) || 0);
  if (parsedQty <= 0) {
    return { error: 'Укажите количество больше нуля' };
  }

  const remain = getReceiveToolsCopyRemainQty(returnItem, allItems);
  if (parsedQty > remain + 0.0001) {
    return { error: `Количество не может превышать остаток (${remain})` };
  }

  const newRow = buildSectionRowFromReturn(returnItem, target, parsedQty);
  let brak = getBrakItems(allItems);
  let sale = getSaleItems(allItems);

  if (target === 'brak') {
    brak = mergeIntoSection(brak, newRow);
  } else {
    sale = mergeIntoSection(sale, newRow);
  }

  return {
    docTableItems: [...returnItems, ...brak, ...sale, ...getTovarItems(allItems)],
  };
};
