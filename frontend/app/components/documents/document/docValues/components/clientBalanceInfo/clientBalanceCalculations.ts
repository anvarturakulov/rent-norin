import {
  DocTableItem,
  DocValues,
  DocumentType,
  getReturnItems,
  getSaleItems,
  getTovarItems,
} from '@/app/interfaces/document.interface';

export type ClientBalanceRowValues = {
  income: number | null;
  expense: number | null;
};

export type ClientBalanceDocumentValues = {
  s40: ClientBalanceRowValues;
  s12: ClientBalanceRowValues;
};

const parseNum = (value: unknown): number => Number(value) || 0;

const sumCostTotal = (items: DocTableItem[]): number =>
  items.reduce(
    (sum, item) => sum + (parseNum(item.costTotal) || parseNum(item.total)),
    0,
  );

const sumTotal = (items: DocTableItem[]): number =>
  items.reduce((sum, item) => sum + parseNum(item.total), 0);

const sumReturnCostTotal = (items: DocTableItem[]): number =>
  getReturnItems(items).reduce((sum, item) => sum + parseNum(item.costTotal), 0);

export const getBalanceTargetDate = (documentDate: number | undefined | null): number =>
  documentDate && documentDate > 0 ? documentDate : Date.now();

export const getTransferAdvanceSum = (docValues: DocValues | undefined): number => {
  const cash = parseNum(docValues?.initialPayment);
  const plastic = parseNum(docValues?.cashFromPartner);
  const usd = parseNum(docValues?.usd);
  const rate = parseNum(docValues?.currency);
  return cash + plastic + rate * usd;
};

export const getTransferToolsSum = (docTableItems: DocTableItem[] | undefined): number =>
  sumCostTotal(
    (docTableItems || []).filter(
      (item) => item.tableType !== 'sale' && item.tableType !== 'tovar',
    ),
  );

export const getReceiveReturnCostSum = (docTableItems: DocTableItem[] | undefined): number =>
  sumCostTotal(getReturnItems(docTableItems || []));

export const getDocumentBalanceValues = (
  documentType: DocumentType | undefined,
  docValues: DocValues | undefined,
  docTableItems: DocTableItem[] | undefined,
): ClientBalanceDocumentValues => {
  if (documentType === DocumentType.TransferToolsToClient ||
      documentType === DocumentType.TransferSubleaseToolsToClient) {
    const advance = getTransferAdvanceSum(docValues);
    const toolsSum = getTransferToolsSum(docTableItems);
    const saleTotal = sumTotal(getSaleItems(docTableItems || []));
    const deliverySum = parseNum(docValues?.deliverySum);
    const defectCost = parseNum(docValues?.defectCost);
    const changeToClient = parseNum(docValues?.changeToClient);
    const s40Income = saleTotal + deliverySum + defectCost + changeToClient;
    return {
      s40: { income: s40Income > 0 ? s40Income : null, expense: advance },
      s12: { income: toolsSum > 0 ? toolsSum : null, expense: null },
    };
  }

  if (
    documentType === DocumentType.SaleTovar ||
    documentType === DocumentType.SaleTools
  ) {
    const saleTotal = sumTotal(docTableItems || []);
    const changeToClient = parseNum(docValues?.changeToClient);
    const s40Income = saleTotal + changeToClient;
    return {
      s40: {
        income: s40Income > 0 ? s40Income : null,
        expense: getTransferAdvanceSum(docValues),
      },
      s12: { income: null, expense: null },
    };
  }

  if (documentType === DocumentType.ReceiveToolsFromClient ||
      documentType === DocumentType.ReceiveSubleaseToolsFromClient) {
    const items = docTableItems || [];
    const payment = getTransferAdvanceSum(docValues);
    const returnTotal = sumTotal(getReturnItems(items));
    const saleTotal = sumTotal(getSaleItems(items));
    const tovarTotal = sumTotal(getTovarItems(items));
    const returnCostTotal = sumReturnCostTotal(items);
    const deliverySum = parseNum(docValues?.deliverySum);
    const defectCost = parseNum(docValues?.defectCost);
    const changeToClient = parseNum(docValues?.changeToClient);

    return {
      s40: {
        income: returnTotal + saleTotal + tovarTotal + deliverySum + defectCost + changeToClient,
        expense: payment,
      },
      s12: { income: 0, expense: returnCostTotal },
    };
  }

  return {
    s40: { income: null, expense: null },
    s12: { income: null, expense: null },
  };
};

export const computeAfterBalance = (
  _documentType: DocumentType | undefined,
  before: number,
  income: number | null,
  expense: number | null,
  _row: 's40' | 's12',
): number => {
  const incomeVal = income ?? 0;
  const expenseVal = expense ?? 0;
  return before + incomeVal - expenseVal;
};

export type ReceiveToolsOperationsSummary = {
  rentIncome: number;
  saleIncome: number;
  tovarIncome: number;
  payments: number;
  defectCost: number;
  deliverySum: number;
  changeToClient: number;
};

export const getReceiveToolsOperationsSummary = (
  docValues: DocValues | undefined,
  docTableItems: DocTableItem[] | undefined,
): ReceiveToolsOperationsSummary => {
  const items = docTableItems || [];
  return {
    rentIncome: sumTotal(getReturnItems(items)),
    saleIncome: sumTotal(getSaleItems(items)),
    tovarIncome: sumTotal(getTovarItems(items)),
    payments: getTransferAdvanceSum(docValues),
    defectCost: parseNum(docValues?.defectCost),
    deliverySum: parseNum(docValues?.deliverySum),
    changeToClient: parseNum(docValues?.changeToClient),
  };
};

export const computeOperationsAfterBalance = (
  before: number,
  summary: ReceiveToolsOperationsSummary,
): number =>
  before +
  summary.rentIncome +
  summary.saleIncome +
  summary.tovarIncome +
  summary.deliverySum +
  summary.defectCost +
  summary.changeToClient -
  summary.payments;
