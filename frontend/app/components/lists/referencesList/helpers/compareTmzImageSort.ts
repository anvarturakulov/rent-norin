import { ReferenceModel, TypeTMZ } from '@/app/interfaces/reference.interface';
import { sortByNameWithDeleted } from '@/app/service/references/sortByName';
import { pickTmzGalleryImagePath } from '@/app/utils/tmzProductImageUrl';

/** Порядок как в typeTMZList (справочник ТМЗ). */
const TYPE_TMZ_SORT_ORDER: TypeTMZ[] = [
  TypeTMZ.PRODUCT,
  TypeTMZ.MATERIAL,
  TypeTMZ.HALFSTUFF,
  TypeTMZ.OS,
  TypeTMZ.TOOLS,
  TypeTMZ.TOVAR,
];

function typeTmzRank(type?: string): number {
  if (!type) return TYPE_TMZ_SORT_ORDER.length;
  const i = TYPE_TMZ_SORT_ORDER.indexOf(type as TypeTMZ);
  return i >= 0 ? i : TYPE_TMZ_SORT_ORDER.length + 1;
}

export function compareTmzByImageAndType(
  a: ReferenceModel,
  b: ReferenceModel,
  imageSort: 'noImageFirst' | 'hasImageFirst',
): number {
  const ha = pickTmzGalleryImagePath(a.refValues) ? 1 : 0;
  const hb = pickTmzGalleryImagePath(b.refValues) ? 1 : 0;
  if (ha !== hb) {
    return imageSort === 'noImageFirst' ? ha - hb : hb - ha;
  }
  const typeCmp = typeTmzRank(a.refValues?.typeTMZ) - typeTmzRank(b.refValues?.typeTMZ);
  if (typeCmp !== 0) return typeCmp;
  return sortByNameWithDeleted(a, b);
}
