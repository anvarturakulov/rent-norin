import {
  DocumentType,
  getSchetForDocumentType,
} from '@/app/interfaces/document.interface';
import { TypeTMZ } from '@/app/interfaces/reference.interface';
import { Schet } from '@/app/interfaces/report.interface';

export const getSchetForDocumentRow = (
  documentType: DocumentType | string | undefined,
  typeTMZ?: TypeTMZ,
  tableType?: 'income' | 'expense' | 'return' | 'brak' | 'sale' | 'tovar' | string,
): Schet => {
  if (documentType === DocumentType.ReceiveToolsFromClient) {
    if (tableType === 'tovar') {
      return Schet.S29;
    }
    if (tableType === 'sale' || tableType === 'return') {
      return Schet.S12;
    }
    return Schet.S11;
  }

  // Продажа товаров в документе передачи инструментов — остаток со склада S29
  if (
    documentType === DocumentType.TransferToolsToClient &&
    tableType === 'sale'
  ) {
    return Schet.S29;
  }

  if (tableType === 'expense') {
    return Schet.S10;
  }

  if (
    documentType === DocumentType.ComeMaterial &&
    typeTMZ === TypeTMZ.HALFSTUFF
  ) {
    return Schet.S21;
  }

  return (documentType
    ? getSchetForDocumentType(documentType as DocumentType)
    : Schet.S29) as Schet;
};
