import { FormworkKind, ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { DocTableItem, TransferToolsPreviewRow } from '@/app/interfaces/document.interface';
import { getTransferPickerRemainQty } from '@/app/service/documents/applyTransferToolsPicker';
import { FormworkElement } from './formwork.types';

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const isFormworkReference = (ref: ReferenceModel): boolean =>
  ref.typeReference === TypeReference.TMZ &&
  !ref.isFolder &&
  Boolean(ref.refValues?.formworkKind) &&
  Object.values(FormworkKind).includes(ref.refValues?.formworkKind as FormworkKind);

/**
 * Элементы опалубки из справочника + остаток на складе по preview
 * (за вычетом уже добавленного в документ).
 */
export const buildFormworkElements = (
  references: ReferenceModel[] | undefined,
  previewRows: TransferToolsPreviewRow[] | null,
  docItems: DocTableItem[],
): FormworkElement[] => {
  const previewById = new Map<number, TransferToolsPreviewRow>();
  (previewRows || []).forEach((row) => previewById.set(row.analiticId, row));

  return (references || [])
    .filter(isFormworkReference)
    .map((ref) => {
      const id = Number(ref.id);
      const preview = previewById.get(id);
      const stock = preview ? getTransferPickerRemainQty(preview, docItems) : 0;
      return {
        analiticId: id,
        name: ref.name,
        kind: ref.refValues?.formworkKind as FormworkKind,
        width: num(ref.refValues?.width),
        height: num(ref.refValues?.height),
        norm: num(ref.refValues?.formworkNorm),
        stock,
      };
    })
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
};
