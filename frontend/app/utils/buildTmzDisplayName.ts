import { TypeTMZ } from '@/app/interfaces/reference.interface';

export interface TmzNameParts {
  shortName?: string | null;
  size?: string | null;
  color?: string | null;
  texture?: string | null;
  manufacture?: string | null;
  typeTMZ?: TypeTMZ;
}

export function hasTmzNameParts(parts: TmzNameParts): boolean {
  const keys: (keyof Pick<TmzNameParts, 'shortName' | 'size' | 'color' | 'texture' | 'manufacture'>)[] =
    parts.typeTMZ === TypeTMZ.OS
      ? ['shortName', 'texture']
      : ['shortName', 'size', 'color', 'texture', 'manufacture'];
  return keys.some((k) => (parts[k] ?? '').trim());
}

export function buildTmzDisplayName(parts: TmzNameParts): string {
  const keys: (keyof Pick<TmzNameParts, 'shortName' | 'size' | 'color' | 'texture' | 'manufacture'>)[] =
    parts.typeTMZ === TypeTMZ.OS
      ? ['shortName', 'texture']
      : ['shortName', 'size', 'color', 'texture', 'manufacture'];
  return keys
    .map((k) => (parts[k] ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
