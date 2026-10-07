import { DocumentType } from '@/app/interfaces/document.interface';

export const DOC_TABLE_LABELS = {
  WORKER: 'Ходим',
  PARTNER: 'Хамкор',
  NAME: 'Номи',
  BALANCE: 'Колдик',
  COUNT: 'Сони',
  PRICE: 'Нархи',
  TOTAL: 'Суммаси',
  RECEIVER: 'Олувчи',
  RECEIVED_CASH: 'Олинган пул',
  COMMENT: 'Изох',
  DELETE_PLACEHOLDER: '____'
} as const;

export const DOCUMENT_TYPE_CHECKS = {
  HAS_COMMENT: (contentName: string) => contentName === DocumentType.LeaveCash,
  HAS_WORKERS: (contentName: string) => contentName === DocumentType.LeaveCash || contentName === DocumentType.ZpCalculate,
  HAS_PARTNERS: (contentName: string) => contentName === DocumentType.LeaveCash
} as const;

export const TABLE_CONFIG = {
  SHOW_BALANCE: true,
  BALANCE_BUTTON_TEXT: '?'
} as const; 