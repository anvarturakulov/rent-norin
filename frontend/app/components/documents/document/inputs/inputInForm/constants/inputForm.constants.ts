import { NameControl } from '@/app/interfaces/document.interface';

export const INPUT_CONTROL_TYPES = {
  COUNT: 'count',
  PRICE: 'price',
  TOTAL: 'total',
  CASH_FROM_PARTNER: 'cashFromPartner',
  COMMENT: 'comment',
  FIN_PERSON: 'finPerson'
} as const;

export const NUMERIC_CONTROLS: NameControl[] = [
  INPUT_CONTROL_TYPES.COUNT,
  INPUT_CONTROL_TYPES.PRICE,
  INPUT_CONTROL_TYPES.TOTAL,
  INPUT_CONTROL_TYPES.CASH_FROM_PARTNER,
  'balance',
  'initialPayment',
  'currency',
  'usd',
  'cashReceived',
  'plasticReceived',
  'changeToClient',
  'debtSum',
  'deliverySum',
  'defectCost',
] as const;

export const CALCULATION_CONTROLS: NameControl[] = [
  INPUT_CONTROL_TYPES.COUNT,
  INPUT_CONTROL_TYPES.PRICE
] as const;

export const PRECISION = {
  COUNT: 3,
  TOTAL: 2,
  PRICE: 0
} as const;

export const MIN_COUNT_VALUE = -1; 