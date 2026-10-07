import {
  DocumentModel,
  DocumentType,
  getSaleItems,
  getTovarItems,
} from '@/app/interfaces/document.interface';
import { numberValue } from '@/app/service/common/converters';

export function showsToolsRentalInJournal(contentName: string): boolean {
  return (
    contentName === DocumentType.TransferToolsToClient ||
    contentName === DocumentType.ReceiveToolsFromClient
  );
}

function pushNonZeroAmount(lines: string[], label: string, value: unknown): void {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return;
  lines.push(`${label}: ${numberValue(num)}`);
}

/** Sum of «Мижозга сотиш» rows (tableType === sale). */
function toolsSaleSum(item: DocumentModel): number {
  const items = item.docTableItems;
  if (!items?.length) return 0;
  return getSaleItems(items).reduce((sum, row) => sum + (Number(row.total) || 0), 0);
}

function tovarSaleSum(item: DocumentModel): number {
  const items = item.docTableItems;
  if (!items?.length) return 0;
  return getTovarItems(items).reduce((sum, row) => sum + (Number(row.total) || 0), 0);
}

/**
 * Lines for compact «Ижара» column — only non-zero amounts.
 * Кайтариш: Сотиш (sale table) instead of rent sum; payments; delivery/defect.
 */
export function getToolsRentalAmountsLines(item: DocumentModel): string[] {
  const lines: string[] = [];
  const dv = item.docValues;

  pushNonZeroAmount(lines, 'Сотиш', toolsSaleSum(item));
  pushNonZeroAmount(lines, 'Товар', tovarSaleSum(item));
  pushNonZeroAmount(lines, 'Доставка', dv?.deliverySum);
  pushNonZeroAmount(lines, 'Брак', dv?.defectCost);
  pushNonZeroAmount(lines, 'Нақд', dv?.initialPayment);
  pushNonZeroAmount(lines, 'Пластик', dv?.cashFromPartner);
  pushNonZeroAmount(lines, 'Дол', dv?.usd);
  pushNonZeroAmount(lines, 'Сдачи', dv?.changeToClient);
  pushNonZeroAmount(lines, 'Насия', dv?.debtSum);

  return lines;
}
