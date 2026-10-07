import { Product } from '@/app/interfaces/product.interface';
import { parseTmzSizeForBasis } from './parseTmzSizeForBasis';

function localeField(a?: string | null, b?: string | null): number {
  const sa = (a ?? '').trim();
  const sb = (b ?? '').trim();
  if (!sa && !sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;
  return sa.localeCompare(sb, undefined, { sensitivity: 'base' });
}

function compareOptionalNumber(a?: number, b?: number): number {
  const hasA = a != null && Number.isFinite(a);
  const hasB = b != null && Number.isFinite(b);
  if (!hasA && !hasB) return 0;
  if (!hasA) return 1;
  if (!hasB) return -1;
  return a - b;
}

function compareTmzSize(a?: string | null, b?: string | null): number {
  const pa = parseTmzSizeForBasis(a);
  const pb = parseTmzSizeForBasis(b);

  for (const key of ['thickness', 'length', 'width'] as const) {
    const cmp = compareOptionalNumber(pa[key], pb[key]);
    if (cmp !== 0) return cmp;
  }

  return localeField(a, b);
}

function getShortName(product: Product): string {
  return (product.refValues?.shortName ?? product.name ?? '').trim();
}

/** Сортировка TMZ в каталоге: папки → shortName → size → color → texture → manufacture → name → id */
export function compareTmzCatalogItems(a: Product, b: Product): number {
  if (a.isFolder && !b.isFolder) return -1;
  if (!a.isFolder && b.isFolder) return 1;

  const shortName = localeField(getShortName(a), getShortName(b));
  if (shortName !== 0) return shortName;

  const size = compareTmzSize(a.refValues?.size, b.refValues?.size);
  if (size !== 0) return size;

  const color = localeField(a.refValues?.color, b.refValues?.color);
  if (color !== 0) return color;

  const texture = localeField(a.refValues?.texture, b.refValues?.texture);
  if (texture !== 0) return texture;

  const manufacture = localeField(a.refValues?.manufacture, b.refValues?.manufacture);
  if (manufacture !== 0) return manufacture;

  const name = localeField(a.name, b.name);
  if (name !== 0) return name;

  return a.id - b.id;
}
