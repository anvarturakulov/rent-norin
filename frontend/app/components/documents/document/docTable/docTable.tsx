import { useCallback } from 'react';
import { DocTableProps } from './docTable.props';
import { useDocTableData } from './hooks/useDocTableData';
import TableHeader from './components/TableHeader';
import TableRow from './components/TableRow';
import { useAppContext } from '@/app/context/app.context';
import { deleteTableItem } from './utils/tableUtils';

export const DocTable = ({ typeReference, items, className, useRealIndices, editableExpense, editableExpensePrice, onOpenCatalogForRow, ...props }: DocTableProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;

  const {
    tableState,
    handleDeleteItem,
    handleLoadBalance
  } = useDocTableData(items || []);

  const handleDeleteWithRealIndex = useCallback((realIndex: number) => {
    if (!currentDocument?.docTableItems || !setMainData) return;
    deleteTableItem(realIndex, setMainData, currentDocument.docTableItems, currentDocument);
  }, [currentDocument, setMainData]);

  const onDelete = useRealIndices ? handleDeleteWithRealIndex : handleDeleteItem;

  return (
    <>
      <TableHeader tableState={tableState} />
      {items && items.map((item, index) => {
        const documentIndex = (useRealIndices && (item as any)._realIndex !== undefined)
          ? (item as any)._realIndex
          : index;
        return (
          <TableRow
            key={index}
            item={item}
            index={index}
            itemIndexInTable={documentIndex}
            typeReference={typeReference}
            tableState={tableState}
            onDelete={onDelete}
            onLoadBalance={handleLoadBalance}
            editableExpense={editableExpense}
            editableExpensePrice={editableExpensePrice}
            onOpenCatalogForRow={onOpenCatalogForRow}
          />
        );
      })}
    </>
  );
};