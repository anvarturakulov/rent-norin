import { roundToTwoDecimals } from './converters';

export type DecimalFractionDigits = 2 | 3;

const PARTIAL_DECIMAL_RE = /^\d*[.,]?\d*$/;
const PARTIAL_INTEGER_RE = /^\d*$/;

export function cleanNumericInput(raw: string): string {
  return raw.replace(/\s/g, '').replace(',', '.');
}

export function isPartialDecimalValid(raw: string): boolean {
  const trimmed = raw.replace(/\s/g, '');
  if (trimmed === '') return true;
  return PARTIAL_DECIMAL_RE.test(trimmed);
}

export function isPartialNumericValid(
  raw: string,
  integerOnly: boolean,
  maxFractionDigits: number = Number.POSITIVE_INFINITY,
): boolean {
  const trimmed = raw.replace(/\s/g, '');
  if (trimmed === '') return true;
  if (integerOnly) return PARTIAL_INTEGER_RE.test(trimmed);
  if (!Number.isFinite(maxFractionDigits)) return PARTIAL_DECIMAL_RE.test(trimmed);
  const re = new RegExp(`^\\d*[.,]?\\d{0,${maxFractionDigits}}$`);
  return re.test(trimmed);
}

export function roundToFractionDigits(value: number, fractionDigits: DecimalFractionDigits = 2): number {
  if (fractionDigits === 3) {
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
  }
  return roundToTwoDecimals(value);
}

export function parseDecimalInput(raw: string, fractionDigits: DecimalFractionDigits = 2): number | null {
  const cleaned = cleanNumericInput(raw);
  if (cleaned === '' || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return roundToFractionDigits(n, fractionDigits);
}

export function formatDecimalInput(value: number, fractionDigits: DecimalFractionDigits = 2): string {
  return String(roundToFractionDigits(value, fractionDigits));
}

export function formatQuantityText(
  value: number,
  integerOnly: boolean,
  fractionDigits: DecimalFractionDigits = 2,
): string {
  if (integerOnly) return String(Math.floor(value));
  return formatDecimalInput(value, fractionDigits);
}

/** Format integer digits with space triads (ru-RU style ordinary spaces). */
export function formatIntegerWithTriads(integerDigits: string): string {
  if (integerDigits === '') return '';
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Live-format a cleaned numeric string (no spaces, '.' decimal) while typing.
 * Preserves incomplete forms: '', '-', '.', '12.', '-.5'.
 */
export function formatPartialNumberWithTriads(cleanValue: string): string {
  if (cleanValue === '' || cleanValue === '-' || cleanValue === '.') {
    return cleanValue;
  }

  const negative = cleanValue.startsWith('-');
  const unsigned = negative ? cleanValue.slice(1) : cleanValue;
  const dotIndex = unsigned.indexOf('.');

  const intRaw = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
  const hasFraction = dotIndex !== -1;
  const fracRaw = hasFraction ? unsigned.slice(dotIndex + 1) : '';

  const formattedInt = formatIntegerWithTriads(intRaw);
  const sign = negative ? '-' : '';

  if (hasFraction) {
    return `${sign}${formattedInt}.${fracRaw}`;
  }
  return `${sign}${formattedInt}`;
}

/** Count non-space characters (digits, sign, decimal point). */
export function countSignificantNumericChars(str: string): number {
  return str.replace(/[\s\u00A0\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '').length;
}

/**
 * Map caret after triad formatting: keep the same count of significant chars
 * before the caret as in the pre-format string slice.
 */
export function caretPosAfterTriadFormat(
  formatted: string,
  significantCharsBeforeCaret: number,
): number {
  if (significantCharsBeforeCaret <= 0) return 0;

  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (!/[\s\u00A0\u2000-\u200F\u2028-\u202F\u205F-\u206F]/.test(formatted[i])) {
      seen++;
      if (seen === significantCharsBeforeCaret) {
        return i + 1;
      }
    }
  }
  return formatted.length;
}
