import { Schet } from '@/app/interfaces/report.interface';

export const MAT_OBOROT_SCHETS = [
  Schet.S10,
  Schet.S21,
  Schet.S28,
  Schet.S11,
  Schet.S29,
  Schet.S12,
] as const;

export type MatOborotSchet = (typeof MAT_OBOROT_SCHETS)[number];

export const MAT_OBOROT_TYPE_OPTIONS: ReadonlyArray<{
  title: string;
  schet: MatOborotSchet;
}> = [
  { title: 'Хом ашё', schet: Schet.S10 },
  { title: 'Ярим тайёр махсулот', schet: Schet.S21 },
  { title: 'Тайёр махсулот', schet: Schet.S28 },
  { title: 'Ускуналар', schet: Schet.S11 },
  { title: 'Товарлар', schet: Schet.S29 },
  { title: 'Мижоздаги ускуналар', schet: Schet.S12 },
];

export function isMatOborotSchet(
  schet: Schet | string | undefined | null,
): schet is MatOborotSchet {
  return (
    schet != null &&
    (MAT_OBOROT_SCHETS as readonly Schet[]).includes(schet as Schet)
  );
}

export function getMatOborotTypeTitle(schet: Schet | undefined | null): string {
  return (
    MAT_OBOROT_TYPE_OPTIONS.find((item) => item.schet === schet)?.title ?? 'ТМБ'
  );
}
