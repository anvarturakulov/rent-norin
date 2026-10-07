import { numberValue } from '@/app/service/common/converters';

export function splitSignedAmountDisplay(
  value: number | undefined | null
): { plus: string; minus: string } {
  const n = value === undefined || value === null ? 0 : Number(value);
  if (Number.isNaN(n)) return { plus: '', minus: '' };
  if (n > 0) return { plus: numberValue(n), minus: '' };
  if (n < 0) return { plus: '', minus: numberValue(Math.abs(n)) };
  return { plus: '', minus: '' };
}
