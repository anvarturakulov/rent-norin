import { useMemo, useCallback } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { getTableState } from '../utils/tableUtils';
import { deleteTableItem } from '../utils/tableUtils';
import { getPriceAndBalance } from '@/app/service/documents/getPriceBalance';
import { DocTableItem } from '@/app/interfaces/document.interface';
import { useGlobalWebSocket, useGlobalStockManagement } from '@/app/context/websocket.context';
import { DocumentType } from '@/app/interfaces/document.interface';
import { getDocumentTypeByComeOut } from '@/app/components/documents/document/docValues/components/helpers/getDocumentTypeByComeOut';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { getSchetForDocumentRow } from '@/app/service/documents/getSchetForDocumentRow';
import { ReferenceModel } from '@/app/interfaces/reference.interface';

export const useDocTableData = (
  items: DocTableItem[], 
  onItemDeleted?: (analiticId: number) => void
) => {
  const { mainData, setMainData } = useAppContext();
  const { contentName } = mainData.document;
  const { currentDocument } = mainData.document;
  const { updateStocks } = useGlobalStockManagement();
  const token = mainData.users.user?.token;
  const { data: references } = useAllReferences(token);

  // Мемоизируем состояние таблицы
  const tableState = useMemo(() => {
    return getTableState(contentName);
  }, [contentName]);

  // Мемоизируем обработчик удаления элемента
  const handleDeleteItem = useCallback((index: number) => {
    // Проверяем, что currentDocument существует
    if (!currentDocument) {
      console.error('❌ useDocTableData: currentDocument не определен при удалении элемента');
      return;
    }

    // Получаем информацию о удаляемом товаре для освобождения резерва
    const deletedItem = items[index];
    if (deletedItem && onItemDeleted) {
      onItemDeleted(deletedItem.analiticId);
    }
    
    // Освобождаем резерв для удаляемого товара (только для расходных документов)
    if (deletedItem && deletedItem.analiticId && deletedItem.count) {
      const storageId =
        currentDocument.documentType === DocumentType.SaleProd ||
        currentDocument.documentType === DocumentType.SaleMaterial ||
        currentDocument.documentType === DocumentType.SaleTovar ||
        currentDocument.documentType === DocumentType.SaleTools
          ? currentDocument.docValues?.senderId
          : currentDocument.docValues?.receiverId;
	    const warehouseId = storageId || 20125;
      const itemId = `${warehouseId}:${deletedItem.analiticId}`;
      const quantityToRelease = deletedItem.count;
      
      // Определяем счет на основе типа документа
      const documentType = currentDocument.documentType;
      const typeTMZ = references?.find((ref: ReferenceModel) => ref.id === deletedItem.analiticId)?.refValues?.typeTMZ;
      const schet = getSchetForDocumentRow(documentType as DocumentType, typeTMZ, deletedItem.tableType);
      
      // Определяем тип документа (приходный/расходный)
      const typeDocumentByComeOut = documentType ? getDocumentTypeByComeOut(documentType as DocumentType) : 'out';
      
      // Логика резервирования удалена
    }
    
    deleteTableItem(index, setMainData, items, currentDocument);
  }, [setMainData, items, currentDocument, onItemDeleted, updateStocks, references]);

  // Мемоизируем обработчик загрузки баланса
  const handleLoadBalance = useCallback((index: number) => {
    // Проверяем, что currentDocument существует
    if (!currentDocument) {
      console.error('❌ useDocTableData: currentDocument не определен при загрузке баланса');
      return;
    }

    const analiticId = currentDocument.docTableItems?.[index]?.analiticId;
    const typeTMZ = analiticId != null
      ? references?.find((ref: ReferenceModel) => ref.id === analiticId)?.refValues?.typeTMZ
      : undefined;

    getPriceAndBalance(
      mainData,
      setMainData,
      currentDocument.docValues?.senderId,
      analiticId,
      currentDocument.date,
      true,
      index,
      typeTMZ,
    );
  }, [mainData, setMainData, currentDocument, references]);

  return {
    tableState,
    handleDeleteItem,
    handleLoadBalance,
    currentDocument,
    contentName
  };
}; 