import { useMemo, useCallback } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { getTableState } from '../utils/tableUtils';
import { deleteTableItem } from '../utils/tableUtils';
import { getPriceAndBalance } from '@/app/service/documents/getPriceBalance';
import { DocTableItem } from '@/app/interfaces/document.interface';

export const useDocTableData = (items: DocTableItem[]) => {
  const { mainData, setMainData } = useAppContext();
  const { contentName } = mainData.document;
  const { currentDocument } = mainData.document;

  // Мемоизируем состояние таблицы
  const tableState = useMemo(() => {
    return getTableState(contentName);
  }, [contentName]);

  // Мемоизируем обработчик удаления элемента
  const handleDeleteItem = useCallback((index: number) => {
    deleteTableItem(index, setMainData, items, currentDocument);
  }, [setMainData, items, currentDocument]);

  // Мемоизируем обработчик загрузки баланса
  const handleLoadBalance = useCallback((index: number) => {
    getPriceAndBalance(
      mainData,
      setMainData,
      currentDocument?.docValues?.senderId,
      currentDocument?.docTableItems?.[index]?.analiticId,
      currentDocument?.date,
      true,
      index,
    );
  }, [mainData, setMainData, currentDocument]);

  return {
    tableState,
    handleDeleteItem,
    handleLoadBalance,
    currentDocument,
    contentName
  };
}; 