import { DocumentType } from "src/interfaces/document.interface";
import { ClientContractItemKind } from "src/interfaces/client-contract.interface";
import { TypeTMZ } from "src/interfaces/reference.interface";

export type FurnitureOrderQtyPriceSource = {
  count?: number | null;
  price?: number | null;
  total?: number | null;
};

export type ContractOrderLineQtyPriceFallback = {
  count?: number | null;
  qty?: number | null;
  orderPrice?: number | null;
};

/** Количество, цена и сумма строки договора из заказа; запас — сохранённые поля строки. */
export function qtyPriceFromFurnitureOrder(
  order?: FurnitureOrderQtyPriceSource | null,
  fallback?: ContractOrderLineQtyPriceFallback,
): { count: number; orderPrice: number; amount: number } {
  const countFromOrder = Number(order?.count);
  const storedCount = Number(fallback?.count ?? fallback?.qty);
  const count =
    countFromOrder > 0 ? countFromOrder : storedCount > 0 ? storedCount : 1;
  const total = Number(order?.total) || 0;
  let price = Number(order?.price) || 0;
  if (total > 0 && count > 0) {
    price = total / count;
  }
  if (!(price > 0)) {
    price = Number(fallback?.orderPrice) || 0;
  }
  const amount = total > 0 ? total : count * price;
  return { count, orderPrice: price, amount };
}

/** Пропорционально ценам заказов; остаток округления на последнюю строку с price > 0 */
export function distributeAdditionalExpenses(
  orderPrices: number[],
  expenseTotal: number,
): number[] {
  const n = orderPrices.length;
  const zeros = () => Array.from({ length: n }, () => 0);
  if (n === 0) return [];
  const exp = Number(expenseTotal) || 0;
  if (exp <= 0) return zeros();
  const prices = orderPrices.map((p) => Math.max(0, Number(p) || 0));
  const S = prices.reduce((a, b) => a + b, 0);
  if (S <= 0) return zeros();
  const out = prices.map(
    (p) => Math.round(((exp * p) / S) * 100) / 100,
  );
  const drift =
    Math.round((exp - out.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (drift !== 0) {
    let idx = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (prices[i] > 0) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      out[idx] = Math.round((out[idx] + drift) * 100) / 100;
    }
  }
  return out;
}

export function documentTypeForItemKind(
  kind: ClientContractItemKind,
): DocumentType {
  switch (kind) {
    case ClientContractItemKind.TOVAR:
      return DocumentType.SaleTovar;
    case ClientContractItemKind.MATERIAL:
      return DocumentType.SaleMaterial;
    case ClientContractItemKind.HALFSTUFF:
      return DocumentType.SaleHalfStuff;
    case ClientContractItemKind.PRODUCT:
      return DocumentType.SaleProd;
    case ClientContractItemKind.SERVICE:
      return DocumentType.ServicesToClients;
  }
}

export function isHeaderSaleKind(kind: ClientContractItemKind): boolean {
  return (
    kind === ClientContractItemKind.HALFSTUFF ||
    kind === ClientContractItemKind.SERVICE
  );
}

export function typeTmzForItemKind(
  kind: ClientContractItemKind,
): TypeTMZ | null {
  switch (kind) {
    case ClientContractItemKind.TOVAR:
      return TypeTMZ.TOVAR;
    case ClientContractItemKind.MATERIAL:
      return TypeTMZ.MATERIAL;
    case ClientContractItemKind.HALFSTUFF:
      return TypeTMZ.HALFSTUFF;
    case ClientContractItemKind.PRODUCT:
      return TypeTMZ.PRODUCT;
    case ClientContractItemKind.SERVICE:
      return null;
  }
}
