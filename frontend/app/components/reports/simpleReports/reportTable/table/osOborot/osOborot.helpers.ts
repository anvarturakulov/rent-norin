import { numberValue } from '@/app/service/common/converters';

export function formatCell(value: number | null | undefined): string {
  if (value == null || value === 0) return '';
  return numberValue(value);
}

export function pickName(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t) return t;
  }
  return '';
}
