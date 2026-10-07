import React, { memo } from 'react';
import cn from 'classnames';
import styles from '../docTableCatalog.module.css';
import BoxIco from '../ico/box.svg';
import { DocumentType } from '@/app/interfaces/document.interface';

interface TableEmptyBoxProps {
  docType?: DocumentType;
}

const TOOLS_DOC_TYPES: DocumentType[] = [
  DocumentType.ComeTools,
  DocumentType.MoveTools,
  DocumentType.LeaveTools,
  DocumentType.SaleTools,
  DocumentType.TransferToolsToClient,
  DocumentType.OrderToolsToClient,
  DocumentType.ReceiveToolsFromClient,
  DocumentType.TransferSubleaseToolsToClient,
  DocumentType.ReceiveSubleaseToolsFromClient,
];

const TableEmptyBox = memo<TableEmptyBoxProps>(({ docType, ...props }) => {
  const emptyText = docType && TOOLS_DOC_TYPES.includes(docType)
    ? 'Каталогдан ускуналарни танлаб, руйхатга кушинг'
    : 'Каталогдан товарларни танлаб, буюртмага кушинг';

  return (
    <div className={cn(styles.emptyBox, {})}>
      <BoxIco className={styles.icoBox}/>
      <div className={styles.emptyTitle}>Саватча буш</div>
      <div className={styles.emptyText}>{emptyText}</div>
      {/* <button className={styles.openCatalogBtn}>Каталогни очиш</button> */}
    </div>
  );
});

TableEmptyBox.displayName = 'TableEmptyBox';

export default TableEmptyBox; 