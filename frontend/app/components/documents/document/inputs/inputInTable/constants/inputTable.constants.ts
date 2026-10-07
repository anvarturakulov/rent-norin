import { DocTableItem } from '@/app/interfaces/document.interface';

export const INPUT_CONTROL_TYPES: Record<string, keyof DocTableItem> = {
  COUNT: 'count',
  PRICE: 'price',
  TOTAL: 'total',
  COUNT_BY_BOX: 'countByBox'
} as const;

export const NUMERIC_CONTROLS: (keyof DocTableItem)[] = [
  INPUT_CONTROL_TYPES.COUNT,
  INPUT_CONTROL_TYPES.PRICE,
  INPUT_CONTROL_TYPES.TOTAL,
  INPUT_CONTROL_TYPES.COUNT_BY_BOX
] as const;

export const CALCULATION_CONTROLS: (keyof DocTableItem)[] = [
  INPUT_CONTROL_TYPES.COUNT,
  INPUT_CONTROL_TYPES.PRICE,
  INPUT_CONTROL_TYPES.COUNT_BY_BOX
] as const;

export const CALCULATION_PRECISION = 2; 