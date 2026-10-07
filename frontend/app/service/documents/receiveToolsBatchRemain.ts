import { DocTableItem, ReceiveToolsPreviewRow } from '@/app/interfaces/document.interface';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ReceiveToolsBatchSection = 'return' | 'brak' | 'sale';

export const getBatchKey = (sourceTransferDocId: number, analiticId: number) =>
  `${sourceTransferDocId}:${analiticId}`;

export const getItemBatchKey = (item: DocTableItem): string | null => {
  if (!item.sourceTransferDocId || !item.analiticId) return null;
  return getBatchKey(item.sourceTransferDocId, item.analiticId);
};

export const sumBatchQty = (
  items: DocTableItem[],
  batchKey: string,
  sections: ReceiveToolsBatchSection[],
): number =>
  items
    .filter((item) => {
      const section = (item.tableType || 'return') as ReceiveToolsBatchSection;
      return sections.includes(section) && getItemBatchKey(item) === batchKey;
    })
    .reduce((sum, item) => sum + (Number(item.count) || 0), 0);

export const getBatchAllocatedQty = (
  allItems: DocTableItem[],
  batchKey: string,
): { return: number; brak: number; sale: number; total: number } => {
  const returnQty = sumBatchQty(allItems, batchKey, ['return']);
  const brak = sumBatchQty(allItems, batchKey, ['brak']);
  const sale = sumBatchQty(allItems, batchKey, ['sale']);
  return {
    return: returnQty,
    brak,
    sale,
    total: round2(returnQty + brak + sale),
  };
};

export const getPickerRemainQty = (
  previewRow: Pick<ReceiveToolsPreviewRow, 'sourceTransferDocId' | 'analiticId' | 'count'>,
  allItems: DocTableItem[],
): number => {
  const key = getBatchKey(previewRow.sourceTransferDocId, previewRow.analiticId);
  const allocated = getBatchAllocatedQty(allItems, key);
  return Math.max(0, round2((Number(previewRow.count) || 0) - allocated.total));
};
