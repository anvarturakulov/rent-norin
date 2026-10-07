import {
  DocTableItem,
  DocValues,
  DocumentModel,
  DocumentType,
  getReturnItems,
  getSaleItems,
  getTovarItems,
} from '@/app/interfaces/document.interface';
import {
  computeAfterBalance,
  getDocumentBalanceValues,
  getTransferAdvanceSum,
} from '@/app/components/documents/document/docValues/components/clientBalanceInfo/clientBalanceCalculations';

export const OPTIONAL_PAYMENT_DOC_VALUE_KEYS = [
  'initialPayment',
  'cashFromPartner',
  'currency',
  'usd',
  'cashReceived',
  'plasticReceived',
  'changeToClient',
  'debtSum',
  'deliverySum',
  'defectCost',
] as const;

export type OptionalPaymentDocValueKey = (typeof OPTIONAL_PAYMENT_DOC_VALUE_KEYS)[number];

const TOOLS_TRANSFER_OPTIONAL_KEYS: OptionalPaymentDocValueKey[] = [
  'initialPayment',
  'cashFromPartner',
  'currency',
  'usd',
  'changeToClient',
  'deliverySum',
  'defectCost',
];

const TOOLS_RECEIVE_OPTIONAL_KEYS: OptionalPaymentDocValueKey[] = [
  'initialPayment',
  'cashFromPartner',
  'currency',
  'usd',
  'cashReceived',
  'plasticReceived',
  'changeToClient',
  'debtSum',
  'deliverySum',
  'defectCost',
];

const SALE_TOVAR_OPTIONAL_KEYS: OptionalPaymentDocValueKey[] = [
  'initialPayment',
  'cashFromPartner',
  'currency',
  'usd',
  'changeToClient',
];

const coerceOptionalPaymentNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isEmptyOptionalPaymentValue = (value: unknown): boolean => {
  const coerced = coerceOptionalPaymentNumber(value);
  return coerced === undefined || coerced === 0;
};

const getOptionalKeysForDocumentType = (
  documentType: DocumentType | undefined,
): OptionalPaymentDocValueKey[] => {
  if (
    documentType === DocumentType.TransferToolsToClient ||
    documentType === DocumentType.TransferSubleaseToolsToClient
  ) {
    return TOOLS_TRANSFER_OPTIONAL_KEYS;
  }
  if (
    documentType === DocumentType.ReceiveToolsFromClient ||
    documentType === DocumentType.ReceiveSubleaseToolsFromClient
  ) {
    return TOOLS_RECEIVE_OPTIONAL_KEYS;
  }
  if (
    documentType === DocumentType.SaleTovar ||
    documentType === DocumentType.SaleTools
  ) {
    return SALE_TOVAR_OPTIONAL_KEYS;
  }
  return [];
};

const normalizePaymentKeysInDocValues = (
  docValues: Record<string, unknown>,
  keys: OptionalPaymentDocValueKey[],
  emptyToNull: boolean,
): boolean => {
  let changed = false;

  for (const key of keys) {
    const raw = docValues[key];
    if (isEmptyOptionalPaymentValue(raw)) {
      if (emptyToNull) {
        if (docValues[key] !== null) {
          docValues[key] = null;
          changed = true;
        }
      } else if (docValues[key] !== undefined) {
        delete docValues[key];
        changed = true;
      }
      continue;
    }

    const coerced = coerceOptionalPaymentNumber(raw);
    if (coerced !== undefined && coerced !== raw) {
      docValues[key] = coerced;
      changed = true;
    }
  }

  return changed;
};

const syncReceiveToolsPaymentAliases = (
  docValues: Record<string, unknown>,
): boolean => {
  let changed = false;

  const initialPayment = coerceOptionalPaymentNumber(docValues.initialPayment);
  if (initialPayment !== undefined && initialPayment > 0) {
    if (docValues.cashReceived !== initialPayment) {
      docValues.cashReceived = initialPayment;
      changed = true;
    }
  } else if (docValues.cashReceived !== null) {
    docValues.cashReceived = null;
    changed = true;
  }

  const plastic = coerceOptionalPaymentNumber(docValues.cashFromPartner);
  if (plastic !== undefined && plastic > 0) {
    if (docValues.plasticReceived !== plastic) {
      docValues.plasticReceived = plastic;
      changed = true;
    }
  } else if (docValues.plasticReceived !== null) {
    docValues.plasticReceived = null;
    changed = true;
  }

  return changed;
};

/** При загрузке: 0/null в опциональных полях → undefined (пустой инпут). */
export const normalizeOptionalPaymentFieldsOnLoad = (
  document: DocumentModel,
): DocumentModel => {
  const keys = getOptionalKeysForDocumentType(document.documentType);
  if (!keys.length || !document.docValues) {
    return document;
  }

  const docValues = { ...document.docValues };
  const changed = normalizePaymentKeysInDocValues(
    docValues as Record<string, unknown>,
    keys,
    false,
  );

  return changed ? { ...document, docValues } : document;
};

/** Перед сохранением: пустые опциональные поля → null (очистка в БД). */
export const normalizeOptionalPaymentFieldsOnSave = (
  document: DocumentModel,
): DocumentModel => {
  const keys = getOptionalKeysForDocumentType(document.documentType);
  if (!keys.length || !document.docValues) {
    return document;
  }

  const docValues = { ...document.docValues };
  normalizePaymentKeysInDocValues(docValues as Record<string, unknown>, keys, true);

  if (
    document.documentType === DocumentType.ReceiveToolsFromClient ||
    document.documentType === DocumentType.ReceiveSubleaseToolsFromClient
  ) {
    syncReceiveToolsPaymentAliases(docValues as Record<string, unknown>);
  }

  return { ...document, docValues };
};

export const isOptionalPaymentFieldEmpty = (value: unknown): boolean =>
  isEmptyOptionalPaymentValue(value);

/** Возврат инструментов: хотя бы один способ оплаты заполнен. */
export const isReceiveToolsPaymentFilled = (
  docValues: DocumentModel['docValues'] | Record<string, unknown> | undefined | null,
): boolean => {
  if (!docValues) {
    return false;
  }

  const cash = coerceOptionalPaymentNumber(docValues.initialPayment) ?? 0;
  if (cash > 0) {
    return true;
  }

  const plastic = coerceOptionalPaymentNumber(docValues.cashFromPartner) ?? 0;
  if (plastic > 0) {
    return true;
  }

  const currency = coerceOptionalPaymentNumber(docValues.currency) ?? 0;
  const usd = coerceOptionalPaymentNumber(docValues.usd) ?? 0;
  if (currency > 0 && usd > 0) {
    return true;
  }

  const debtSum = coerceOptionalPaymentNumber(docValues.debtSum) ?? 0;
  const debtComment = String(docValues.debtComment ?? '').trim();
  if (debtSum > 0 && debtComment.length > 0) {
    return true;
  }

  return false;
};

/** Допуск остатка долга S40 (сум): до этой суммы оплату/Насияга не требуем. */
export const RECEIVE_TOOLS_DEBT_TOLERANCE = 1000;

/** Оплата/Насияга нужны, если после документа долг клиента больше допуска. */
export const isReceiveToolsPaymentRequired = (afterS40: number): boolean =>
  afterS40 > RECEIVE_TOOLS_DEBT_TOLERANCE;

/**
 * Проверка оплаты при проведении возврата инструментов.
 * Если afterS40 ≤ 1000 — можно без оплаты; иначе нужна заполненная оплата/Насияга.
 */
export const isReceiveToolsPaymentGatePassed = (
  docValues: DocumentModel['docValues'] | DocValues | Record<string, unknown> | undefined | null,
  docTableItems: DocTableItem[] | undefined | null,
  beforeS40: number,
): boolean => {
  const balanceValues = getDocumentBalanceValues(
    DocumentType.ReceiveToolsFromClient,
    docValues as DocValues | undefined,
    docTableItems || undefined,
  );
  const afterS40 = computeAfterBalance(
    DocumentType.ReceiveToolsFromClient,
    beforeS40,
    balanceValues.s40.income,
    balanceValues.s40.expense,
    's40',
  );

  if (!isReceiveToolsPaymentRequired(afterS40)) {
    return true;
  }

  return isReceiveToolsPaymentFilled(docValues);
};

const DEBT_SUM_TOLERANCE = 0.01;

/** Итог документа возврата: return + sale + tovar totals + delivery + defect. */
export const getReceiveToolsIncomeTotal = (
  docValues: DocValues | Record<string, unknown> | undefined | null,
  docTableItems: DocTableItem[] | undefined | null,
): number => {
  const items = docTableItems || [];
  const returnTotal = getReturnItems(items).reduce(
    (sum, item) => sum + (Number(item.total) || 0),
    0,
  );
  const saleTotal = getSaleItems(items).reduce(
    (sum, item) => sum + (Number(item.total) || 0),
    0,
  );
  const tovarTotal = getTovarItems(items).reduce(
    (sum, item) => sum + (Number(item.total) || 0),
    0,
  );
  const deliverySum = coerceOptionalPaymentNumber(docValues?.deliverySum) ?? 0;
  const defectCost = coerceOptionalPaymentNumber(docValues?.defectCost) ?? 0;
  return returnTotal + saleTotal + tovarTotal + deliverySum + defectCost;
};

/**
 * Если Насияга заполнена — сумма не меньше остатка
 * (Итог − Накд − Пластик − Курс×USD).
 */
export const isReceiveToolsDebtSumValid = (
  docValues: DocValues | Record<string, unknown> | undefined | null,
  docTableItems: DocTableItem[] | undefined | null,
): boolean => {
  const debtSum = coerceOptionalPaymentNumber(docValues?.debtSum) ?? 0;
  if (debtSum <= 0) {
    return true;
  }

  const incomeTotal = getReceiveToolsIncomeTotal(docValues, docTableItems);
  const paid = getTransferAdvanceSum(docValues as DocValues | undefined);
  const remainder = incomeTotal - paid;
  return debtSum + DEBT_SUM_TOLERANCE >= remainder;
};

/** Оплаты (Накд+Пластик+Курс×USD+Насия) >= начисления (Итог). */
export const isReceiveToolsPaymentCoversIncome = (
  docValues: DocValues | Record<string, unknown> | undefined | null,
  docTableItems: DocTableItem[] | undefined | null,
): boolean => {
  const incomeTotal = getReceiveToolsIncomeTotal(docValues, docTableItems);
  const cashPaid = getTransferAdvanceSum(docValues as DocValues | undefined);
  const debtSum = coerceOptionalPaymentNumber(docValues?.debtSum) ?? 0;
  return cashPaid + debtSum + DEBT_SUM_TOLERANCE >= incomeTotal;
};
