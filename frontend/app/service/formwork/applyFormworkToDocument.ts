import {
  DocTableItem,
  DocumentModel,
  TransferToolsPreviewRow,
} from '@/app/interfaces/document.interface';
import {
  getTransferPickerRemainQty,
  mergeTransferPickerSelectionsIntoDocument,
  TransferPickerSelectionRow,
} from '@/app/service/documents/applyTransferToolsPicker';
import { FormworkElement, FormworkLayout, FormworkSolveResult } from './formwork.types';

export interface ApplyFormworkResult {
  docTableItems: DocTableItem[];
  replacedCount: number;
  addedCount: number;
  skipped: string[];
}

/**
 * Переносит рассчитанную спецификацию в строки документа.
 * Ранее добавленные строки элементов опалубки заменяются, чтобы повторный расчёт не удваивал количество.
 */
export const applyFormworkToDocument = async (
  currentDocument: DocumentModel,
  result: FormworkSolveResult,
  elements: FormworkElement[],
  previewRows: TransferToolsPreviewRow[],
  token: string | undefined,
  enterpriseId: number | null | undefined,
): Promise<ApplyFormworkResult | { error: string }> => {
  const formworkIds = new Set(elements.map((e) => e.analiticId));
  const existing = currentDocument.docTableItems || [];
  const kept = existing.filter((item) => !formworkIds.has(Number(item.analiticId)));
  const replacedCount = existing.length - kept.length;

  const previewById = new Map(previewRows.map((row) => [row.analiticId, row]));
  const skipped: string[] = [];
  const selections: TransferPickerSelectionRow[] = [];

  for (const row of result.spec) {
    if (row.issue <= 0) continue;
    const preview = previewById.get(row.analiticId);
    if (!preview) {
      skipped.push(row.name);
      continue;
    }
    const remainQty = getTransferPickerRemainQty(preview, kept);
    selections.push({
      ...preview,
      remainQty,
      transferQty: Math.min(row.issue, remainQty),
    });
  }

  if (!selections.length) {
    return { error: 'Складда мавжуд элементлар йўқ — ҳужжатга кўчириш учун ҳеч нарса йўқ' };
  }

  const merged = await mergeTransferPickerSelectionsIntoDocument(
    { ...currentDocument, docTableItems: kept },
    selections,
    token,
    enterpriseId,
  );
  if ('error' in merged) return merged;

  return {
    docTableItems: merged.docTableItems,
    replacedCount,
    addedCount: merged.addedCount,
    skipped,
  };
};

export const withFormworkLayout = (
  currentDocument: DocumentModel,
  layout: FormworkLayout,
  docTableItems?: DocTableItem[],
): DocumentModel => ({
  ...currentDocument,
  docTableItems: docTableItems ?? currentDocument.docTableItems,
  docValues: {
    ...currentDocument.docValues,
    formworkLayout: { ...layout, savedAt: Date.now() },
  },
});
