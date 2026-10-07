import {
  DocTableItem,
  DocumentModel,
  ReceiveToolsPreviewRow,
  getBrakItems,
  getReturnItems,
  getSaleItems,
  getTovarItems,
} from '@/app/interfaces/document.interface';
import { buildReceiveToolsReturnRow } from '@/app/service/documents/receiveToolsRent';
import {
  getBatchKey,
  getPickerRemainQty,
} from '@/app/service/documents/receiveToolsBatchRemain';

const round2 = (n: number) => Math.round(n * 100) / 100;

export { getBatchKey };

export interface PickerSelectionRow extends ReceiveToolsPreviewRow {
  remainQty: number;
  returnQty: number;
}

export const buildPickerRowsFromPreview = (
  previewRows: ReceiveToolsPreviewRow[],
  allDocItems: DocTableItem[],
): PickerSelectionRow[] =>
  previewRows
    .map((row) => {
      const remainQty = getPickerRemainQty(row, allDocItems);
      return { ...row, remainQty, returnQty: 0 };
    })
    .filter((row) => row.remainQty > 0);

export const mergePickerSelectionsIntoDocument = (
  currentDocument: DocumentModel,
  selections: PickerSelectionRow[],
  returnDateTime: number,
): { docTableItems: DocTableItem[]; addedCount: number } | { error: string } => {
  const toApply = selections.filter((row) => (Number(row.returnQty) || 0) > 0);

  if (!toApply.length) {
    return { error: 'Укажите количество возврата хотя бы для одной строки' };
  }

  for (const row of toApply) {
    const returnQty = Number(row.returnQty) || 0;
    if (returnQty > row.remainQty + 0.0001) {
      return { error: 'Количество возврата не может превышать остаток' };
    }
  }

  const currentItems = currentDocument.docTableItems || [];
  const returnItems = [...getReturnItems(currentItems)];
  const brak = getBrakItems(currentItems);
  const sale = getSaleItems(currentItems);
  const tovar = getTovarItems(currentItems);

  let addedCount = 0;

  for (const selection of toApply) {
    const returnQty = Number(selection.returnQty) || 0;
    const key = getBatchKey(selection.sourceTransferDocId, selection.analiticId);
    const existingIndex = returnItems.findIndex(
      (item) =>
        item.sourceTransferDocId &&
        item.analiticId &&
        getBatchKey(item.sourceTransferDocId, item.analiticId) === key,
    );

    if (existingIndex >= 0) {
      const existing = returnItems[existingIndex];
      const newCount = round2((Number(existing.count) || 0) + returnQty);
      returnItems[existingIndex] = buildReceiveToolsReturnRow(
        selection,
        newCount,
        returnDateTime,
        { preservePrice: Number(existing.price) || 0 },
      );
    } else {
      returnItems.push(buildReceiveToolsReturnRow(selection, returnQty, returnDateTime));
      addedCount += 1;
    }
  }

  return {
    docTableItems: [...returnItems, ...brak, ...sale, ...tovar],
    addedCount,
  };
};
