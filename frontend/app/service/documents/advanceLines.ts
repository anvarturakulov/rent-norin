import { DocSTATUS, DocTableItem } from '@/app/interfaces/document.interface';

export type AdvanceLineKind =
  | 'expense'
  | 'client'
  | 'partner'
  | 'worker'
  | 'mediator'
  | 'deliverer'
  | 'founder';

export const ADVANCE_LINE_OPTIONS: { id: AdvanceLineKind; label: string }[] = [
  { id: 'expense', label: 'Харажат' },
  { id: 'client', label: 'Клиент' },
  { id: 'partner', label: 'Таъминотчи' },
  { id: 'worker', label: 'Ходим' },
  { id: 'mediator', label: 'Воситачи' },
  { id: 'deliverer', label: 'Доставщик' },
  { id: 'founder', label: 'Таъсисчи' },
];

export const isAdvanceLineFilled = (item: DocTableItem | undefined): boolean =>
  Number(item?.total) > 0;

export const filterAdvanceLines = (
  items: DocTableItem[] | undefined,
): DocTableItem[] =>
  (items || []).filter(isAdvanceLineFilled).map((item) => ({
    ...item,
    lineKind: item.lineKind || 'expense',
  }));

export const advancePhaseLabel = (
  phase: string | null | undefined,
  status?: string | null,
): string => {
  if (status === DocSTATUS.PROVEDEN || phase === 'CLOSED') return 'Ёпилган';
  if (phase === 'ISSUED') return 'Берилган';
  return 'Қоралама';
};

export const advanceLineError = (item: DocTableItem, index: number): string | null => {
  const place = index + 1;
  const kind = item.lineKind;
  const storageId = Number(item.lineStorageId) || 0;
  const analiticId = Number(item.analiticId) || 0;
  if (!kind) return `${place}-қатор: турни танланг`;
  if (Number(item.total) <= 0) return `${place}-қатор: суммани киритинг`;
  if (kind === 'expense' && (!storageId || analiticId <= 0)) {
    return `${place}-қатор: бўлим ва харажат турини танланг`;
  }
  if (kind === 'founder' && !storageId) {
    return `${place}-қатор: таъсисчи ҳамёнини танланг`;
  }
  if (kind !== 'expense' && kind !== 'founder' && analiticId <= 0) {
    return `${place}-қатор: аналитикани танланг`;
  }
  if (kind !== 'founder' && kind !== 'expense' && !storageId) {
    return `${place}-қатор: бўлимни танланг`;
  }
  return null;
};
