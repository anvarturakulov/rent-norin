import React, { memo, useMemo } from 'react';
import cn from 'classnames';
import { DocTableItem, DocumentType } from '@/app/interfaces/document.interface';
import styles from '../docTableCatalog.module.css';
import { numberValue } from '@/app/service/common/converters';

interface TableFooterProps {
  items: DocTableItem[];
  className?: string;
  documentType?: DocumentType;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const TableFooter = memo<TableFooterProps>(({ items, className, documentType }) => {
  const totals = useMemo(() => {
    if (!items || items.length === 0) {
      return {
        totalQuantity: 0,
        totalSum: 0,
        totalDailyRent: 0,
        itemsCount: 0,
      };
    }

    const totalQuantity = items.reduce((sum, item) => sum + (item.count || 0), 0);
    const totalDailyRent = items.reduce((sum, item) => {
      const daily =
        Number(item.dailyRent) > 0
          ? Number(item.dailyRent)
          : round2((Number(item.hourlyTariff) || 0) * (Number(item.count) || 0) * 24);
      return sum + daily;
    }, 0);
    const rawTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalSum =
      documentType === DocumentType.TransferSubleaseToolsToClient
        ? totalDailyRent
        : rawTotal;
    const itemsCount = items.length;

    return {
      totalQuantity,
      totalSum,
      totalDailyRent,
      itemsCount,
    };
  }, [items, documentType]);

  return (
    <div className={cn(styles.footerBox, className)}>
      <div className={styles.footerContent}>
        <div className={styles.footerStats}>
          <div className={styles.footerStatItem}>
            <span className={styles.footerStatLabel}>ТОВАРЛАР:</span>
            <span className={styles.footerStatValue}>{totals.itemsCount}</span>
          </div>
          
          <div className={styles.footerStatItem}>
            <span className={styles.footerStatLabel}>ЖАМИ СОН:</span>
            <span className={styles.footerStatValue}>{numberValue(totals.totalQuantity)}</span>
          </div>
          
          <div className={styles.footerStatItem}>
            <span className={styles.footerStatLabel}>ЖАМИ СУММА:</span>
            <span className={styles.footerStatValueMain}>{numberValue(totals.totalSum)} сум</span>
          </div>

          <div className={styles.footerStatItem}>
            <span className={styles.footerStatLabel}>КУНЛИК ЖАМИ:</span>
            <span className={styles.footerStatValueMain}>{numberValue(totals.totalDailyRent)} сум</span>
          </div>
        </div>
      </div>
    </div>
  );
});

TableFooter.displayName = 'TableFooter';

export default TableFooter;
