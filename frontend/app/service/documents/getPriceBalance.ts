import { Schet } from '@/app/interfaces/report.interface';
import { Maindata } from '@/app/context/app.context.interfaces';
import { setPriceAndBalance } from './setPriceAndBalance';
import { getSchetForDocumentRow } from './getSchetForDocumentRow';
import { DocumentType } from '@/app/interfaces/document.interface';
import { TypeTMZ } from '@/app/interfaces/reference.interface';

export const getPriceAndBalance = (
  mainData: Maindata,
  setMainData: Function | undefined,
  firstSubcontoId: number | undefined,
  secondSubcontoId: number| undefined,
  endDate: number | null,
  forTable: boolean,
  indexTableItem: number,
  typeTMZOverride?: TypeTMZ,
) => {

  const { contentName } = mainData.document;
  const { currentDocument } = mainData.document;
  
  // Для материалов (expense) в ComeProduct разрешаем загрузку остатка/цены — склад материалов = receiverId
  const isExpenseRow = forTable && currentDocument?.docTableItems?.[indexTableItem]?.tableType === 'expense';
  const isComeProduct = contentName === 'ComeProduct';
  const isLeaveMaterial = contentName === DocumentType.LeaveMaterial;
  if (forTable && currentDocument?.docTableItems && currentDocument.docTableItems[indexTableItem]) {
    const item = currentDocument.docTableItems[indexTableItem];
    if (item.tableType === 'expense' && !isComeProduct && !isLeaveMaterial) {
      console.log(`🛡️ getPriceAndBalance: пропускаем загрузку остатков для материала ID ${item.analiticId} (не ComeProduct)`);
      return;
    }
  }
  let schet = undefined;
  let effectiveFirstSubcontoId = firstSubcontoId;

  const tableItem = forTable
    ? currentDocument?.docTableItems?.[indexTableItem]
    : undefined;
  const typeTMZ =
    typeTMZOverride ??
    (secondSubcontoId != null
      ? mainData.reference.allReferences?.find((ref) => ref.id === secondSubcontoId)
          ?.refValues?.typeTMZ
      : undefined);

  if (isComeProduct && isExpenseRow) {
    schet = Schet.S10;
    effectiveFirstSubcontoId = currentDocument?.docValues?.receiverId ?? firstSubcontoId;
  } else {
    schet = getSchetForDocumentRow(
      contentName as DocumentType,
      typeTMZ,
      tableItem?.tableType,
    );
  }

  if (schet) {
    setPriceAndBalance(mainData, setMainData, schet, effectiveFirstSubcontoId, secondSubcontoId, endDate, forTable, indexTableItem);
  }
  
}
