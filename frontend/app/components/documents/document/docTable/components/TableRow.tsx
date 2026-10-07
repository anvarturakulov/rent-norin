import React, { memo } from 'react';
import cn from 'classnames';
import TrashIco from '../ico/trash.svg';
import CartIco from '../../docTableCatalog/ico/cart.svg';
import { SelectReferenceInTable } from '../../selects/selectReferenceInTable/selectReferenceInTable';
import { useSelectTableData } from '../../selects/selectReferenceInTable/hooks/useSelectTableData';
import { InputInTable } from '../../inputs/inputInTable/inputInTable';
import { TypeReference, ReferenceModel, TypeTMZ } from '@/app/interfaces/reference.interface';
import { DocTableItem, DocSTATUS } from '@/app/interfaces/document.interface';
import { useAppContext } from '@/app/context/app.context';
import styles from '../docTable.module.css';
import catalogStyles from '../../docTableCatalog/docTableCatalog.module.css';

interface TableRowProps {
  item: DocTableItem;
  index: number;
  itemIndexInTable?: number;
  typeReference: TypeReference;
  tableState: {
    showBalance: boolean;
    hasWorkers: boolean;
    documentIsSaleType: boolean;
    hasCommentInTable: boolean;
  };
  onDelete: (index: number) => void;
  onLoadBalance: (index: number) => void;
  /** Для ComeProduct: разрешить редактирование количества, цены и удаление строки материалов. */
  editableExpense?: boolean;
  /** Если false — колонка «Цена» только для чтения. Не передан — как editableExpense. */
  editableExpensePrice?: boolean;
  onOpenCatalogForRow?: (documentRowIndex: number) => void;
}

const TableRow = memo<TableRowProps>(({
  item,
  index,
  itemIndexInTable,
  typeReference,
  tableState,
  onDelete,
  onLoadBalance,
  editableExpense = false,
  editableExpensePrice,
  onOpenCatalogForRow,
}) => {
  const { showBalance, hasWorkers, documentIsSaleType, hasCommentInTable } = tableState;
  const { mainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const effectiveIndex = itemIndexInTable ?? index;
  const canReplaceNomenclature =
    !!onOpenCatalogForRow &&
    currentDocument?.docStatus === DocSTATUS.OPEN;

  const rowTypeTMZ =
    item.tableType === 'sale' || item.tableType === 'tovar'
      ? TypeTMZ.TOVAR
      : TypeTMZ.MATERIAL;

  const { rawData } = useSelectTableData({
    typeReference,
    token: user?.token,
    enterpriseId: user?.enterpriseId,
    typeTMZ: rowTypeTMZ,
  });
  const selectedReference = rawData?.find((ref: ReferenceModel) => ref.id === item.analiticId);
  const article = selectedReference?.article;
  const isSheetMaterial = Boolean(selectedReference?.refValues?.isSheetMaterial);

  // expense — материалы; sale/tovar — продажа товаров (Топшириш / Кайтариш)
  if (
    item.tableType !== 'expense' &&
    item.tableType !== 'sale' &&
    item.tableType !== 'tovar'
  ) {
    return null;
  }
  const canEdit = editableExpense;
  const canEditPrice = editableExpensePrice ?? canEdit;
  return (
    <div key={index} className={cn(styles.box, {
      [styles.boxWithBalance]: showBalance,
      [styles.boxWithWorkers]: hasWorkers,
      [styles.boxWithReciever]: documentIsSaleType,
      [styles.sheetMaterialRow]: isSheetMaterial,
    })}>
      <div className={styles.nameCellWithCatalog}>
        {canReplaceNomenclature && (
          <div
            className={catalogStyles.icoCatalog}
            onClick={() => onOpenCatalogForRow!(effectiveIndex)}
            title="Номенклатурани алмаштириш"
            role="button"
          >
            <CartIco />
          </div>
        )}
        <SelectReferenceInTable 
          itemIndexInTable={effectiveIndex}
          typeReference={typeReference}
          currentItemId={item.analiticId}
          typeTMZ={rowTypeTMZ}
        />
      </div>

      <div className={styles.articleCell}>{article || ''}</div>
      
      {showBalance && (
        <div className={styles.balanceCell}>
          {typeof item.balance === 'number' ? item.balance.toFixed(3) : (item.balance ?? '')}
        </div>
      )}
      
      {!hasCommentInTable && (
        <InputInTable nameControl='count' type='number' itemIndexInTable={effectiveIndex} disabled={!canEdit} />
      )}
      
      {!hasCommentInTable && (
        <InputInTable nameControl='price' type='number' itemIndexInTable={effectiveIndex} disabled={!canEditPrice} />
      )}
      
      <InputInTable nameControl='total' type='number' itemIndexInTable={effectiveIndex} disabled={!canEdit} />
      
      <div
        className={styles.ico}
        style={canEdit ? undefined : { opacity: 0.3, pointerEvents: 'none' }}
        title={canEdit ? 'Удалить' : 'Нельзя удалить элементы из нижней таблицы'}
        onClick={canEdit ? () => onDelete(effectiveIndex) : undefined}
        role={canEdit ? 'button' : undefined}
      >
        <TrashIco />
      </div>
    </div>
  );
});

TableRow.displayName = 'TableRow';

export default TableRow; 