import React, { memo } from 'react';
import cn from 'classnames';
import { DOC_TABLE_LABELS } from '../constants/docTable.constants';
import styles from '../docTable.module.css';

interface TableHeaderProps {
  tableState: {
    hasWorkers: boolean;
    hasPartners: boolean;
    showBalance: boolean;
    hasCommentInTable: boolean;
    documentIsSaleType: boolean;
  };
}

const TableHeader = memo<TableHeaderProps>(({ tableState }) => {
  const { hasWorkers, hasPartners, showBalance, hasCommentInTable, documentIsSaleType } = tableState;

  return (
    <div className={cn(styles.box, styles.titleBox, {
      [styles.boxWithBalance]: showBalance,
      [styles.boxWithWorkers]: hasWorkers,
      [styles.boxWithReciever]: documentIsSaleType,
    })}>
      {hasWorkers && <div>{DOC_TABLE_LABELS.WORKER}</div>}
      {hasPartners && <div>{DOC_TABLE_LABELS.PARTNER}</div>}
      
      <div>{DOC_TABLE_LABELS.NAME}</div>
      <div>{DOC_TABLE_LABELS.ARTICLE}</div>
      
      {showBalance && <div className={styles.balanceCell}>{DOC_TABLE_LABELS.BALANCE}</div>}
      
      {!hasCommentInTable && <div>{DOC_TABLE_LABELS.COUNT}</div>}
      {!hasCommentInTable && <div>{DOC_TABLE_LABELS.PRICE}</div>}
      
      <div>{DOC_TABLE_LABELS.TOTAL}</div>

      {documentIsSaleType && <div>{DOC_TABLE_LABELS.RECEIVER}</div>}
      {documentIsSaleType && <div>{DOC_TABLE_LABELS.RECEIVED_CASH}</div>}

      <div className={styles.notColor}>{DOC_TABLE_LABELS.DELETE_PLACEHOLDER}</div>
    </div>
  );
});

TableHeader.displayName = 'TableHeader';

export default TableHeader; 