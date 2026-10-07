import { DocTableItem } from '@/app/interfaces/document.interface';
import { typeDocumentIsSale } from '@/app/service/documents/typeDocumentIsSale';
import { DOCUMENT_TYPE_CHECKS } from '../constants/docTable.constants';

interface TableState {
  hasCommentInTable: boolean;
  hasWorkers: boolean;
  hasPartners: boolean;
  documentIsSaleType: boolean;
  showBalance: boolean;
}

export const getTableState = (contentName: string): TableState => {
  return {
    hasCommentInTable: DOCUMENT_TYPE_CHECKS.HAS_COMMENT(contentName),
    hasWorkers: DOCUMENT_TYPE_CHECKS.HAS_WORKERS(contentName),
    hasPartners: DOCUMENT_TYPE_CHECKS.HAS_PARTNERS(contentName),
    documentIsSaleType: typeDocumentIsSale(contentName),
    showBalance: true
  };
};

export const deleteTableItem = (
  index: number, 
  setMainData: Function | undefined, 
  items: Array<DocTableItem>,
  currentDocument: any
) => {
  if (setMainData && items.length > 1) {
    const newItems = [...items.slice(0, index), ...items.slice(index + 1)];
    const newObj = { ...currentDocument };
    newObj.docTableItems = [...newItems];
    setMainData('currentDocument', { ...newObj });
  }
};

export const getTableClassName = (
  baseClass: string,
  showBalance: boolean,
  hasWorkers: boolean,
  documentIsSaleType: boolean
): string => {
  return `${baseClass} ${showBalance ? 'boxWithBalance' : ''} ${hasWorkers ? 'boxWithWorkers' : ''} ${documentIsSaleType ? 'boxWithReciever' : ''}`.trim();
}; 