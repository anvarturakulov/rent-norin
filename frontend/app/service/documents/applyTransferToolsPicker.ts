import {
  DocTableItem,
  DocumentModel,
  TransferToolsPreviewRow,
} from '@/app/interfaces/document.interface';
import {
  buildTransferToolsRow,
  enrichTransferToolsRow,
  recalcTransferToolsRowTotals,
} from '@/app/service/documents/buildTransferToolsRow';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface TransferPickerSelectionRow extends TransferToolsPreviewRow {
  remainQty: number;
  transferQty: number;
}

export const getDocAllocatedQty = (
  allItems: DocTableItem[],
  analiticId: number,
): number =>
  round2(
    allItems
      .filter((item) => item.analiticId === analiticId)
      .reduce((sum, item) => sum + (Number(item.count) || 0), 0),
  );

export const getTransferPickerRemainQty = (
  previewRow: Pick<TransferToolsPreviewRow, 'analiticId' | 'count'>,
  allItems: DocTableItem[],
): number => {
  const stockRemain = Number(previewRow.count) || 0;
  const allocated = getDocAllocatedQty(allItems, previewRow.analiticId);
  return Math.max(0, round2(stockRemain - allocated));
};

export const buildTransferPickerRowsFromPreview = (
  previewRows: TransferToolsPreviewRow[],
  allDocItems: DocTableItem[],
): TransferPickerSelectionRow[] =>
  previewRows
    .map((row) => {
      const remainQty = getTransferPickerRemainQty(row, allDocItems);
      return { ...row, remainQty, transferQty: 0 };
    })
    .filter((row) => row.remainQty > 0);

export const mergeTransferPickerSelectionsIntoDocument = async (
  currentDocument: DocumentModel,
  selections: TransferPickerSelectionRow[],
  token: string | undefined,
  enterpriseId: number | null | undefined,
): Promise<{ docTableItems: DocTableItem[]; addedCount: number } | { error: string }> => {
  const toApply = selections.filter((row) => (Number(row.transferQty) || 0) > 0);
  if (!toApply.length) {
    return { error: 'Укажите количество хотя бы для одной строки' };
  }

  for (const row of toApply) {
    const transferQty = Number(row.transferQty) || 0;
    if (transferQty > row.remainQty + 0.0001) {
      return { error: 'Количество не может превышать остаток' };
    }
  }

  const documentDate = Number(currentDocument?.date) || Date.now();
  const rentTariffType = currentDocument?.docValues?.rentTariffType;
  let docTableItems = [...(currentDocument.docTableItems || [])];
  let addedCount = 0;

  for (const selection of toApply) {
    const transferQty = Number(selection.transferQty) || 0;
    const existingIndex = docTableItems.findIndex(
      (item) => item.analiticId === selection.analiticId,
    );

    const selectionTariff = Number(selection.hourlyTariff) || 0;

    if (existingIndex >= 0) {
      const existing = docTableItems[existingIndex];
      const newCount = round2((Number(existing.count) || 0) + transferQty);
      const withCost = {
        ...existing,
        costPrice: Number(selection.costPrice) || Number(existing.costPrice) || 0,
        hourlyTariff: selectionTariff || Number(existing.hourlyTariff) || 0,
      };
      const recalced = recalcTransferToolsRowTotals(withCost, newCount);
      docTableItems[existingIndex] = await enrichTransferToolsRow(
        recalced,
        documentDate,
        token,
        enterpriseId,
        selectionTariff,
        rentTariffType,
      );
    } else {
      const base = buildTransferToolsRow({
        analiticId: selection.analiticId,
        count: transferQty,
        costPrice: Number(selection.costPrice) || 0,
        hourlyTariff: selectionTariff,
        balance: Number(selection.balance) || 0,
      });
      const enriched = await enrichTransferToolsRow(
        base,
        documentDate,
        token,
        enterpriseId,
        selectionTariff,
        rentTariffType,
      );
      docTableItems = [...docTableItems, enriched];
      addedCount += 1;
    }
  }

  return { docTableItems, addedCount };
};
