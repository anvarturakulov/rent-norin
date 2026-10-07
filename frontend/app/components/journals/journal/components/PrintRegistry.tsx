'use client';

import React, { forwardRef } from 'react';
import cn from 'classnames';
import {
  DocumentModel,
  DocumentType,
  DocSTATUS,
} from '@/app/interfaces/document.interface';
import styles from './printRegistry.module.css';
import { secondsToDateString } from '../../../documents/document/doc/helpers/doc.functions';
import { formatDisplayDate, formatDisplayTime } from '@/app/utils/formatDisplayDate';
import {
  getNameEnterprise,
  getNameReference,
  getUserName,
} from '../helpers/journal.functions';
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { isDocumentWithAnalitic } from '@/app/service/documents/isDocumentWithAnalitic';
import { documentTotal } from '../helpers/journal.utils';
import { numberValue } from '@/app/service/common/converters';
import { FurnitureOrder } from '@/app/interfaces/furnitureOrder.interface';
import {
  formatOrderJournalLabel,
  showsOrderInJournal,
} from '../helpers/orderJournal';
import {
  getToolsRentalAmountsLines,
  showsToolsRentalInJournal,
} from '../helpers/toolsRentalJournal';

interface PrintRegistryProps {
  filteredDocuments: DocumentModel[];
  contentName: string;
  references: any;
  enterprises: any;
  mainData: any;
  dateStart: number;
  dateEnd: number;
  total: number;
  count: number;
  ordersById?: Map<number, FurnitureOrder>;
}

const getStatusClass = (status: DocSTATUS | undefined): string => {
  switch (status) {
    case DocSTATUS.PROVEDEN:
      return styles.statusProveden;
    case DocSTATUS.PENDING:
      return styles.statusPending;
    case DocSTATUS.REJECTED:
      return styles.statusRejected;
    case DocSTATUS.DELETED:
      return styles.statusDeleted;
    case DocSTATUS.OPEN:
    default:
      return styles.statusOpen;
  }
};

const getGateIncomeStatusText = (status: DocSTATUS | undefined): string => {
  if (status === DocSTATUS.PROVEDEN) return 'Проведен';
  if (status === DocSTATUS.OPEN) return 'Открыт';
  if (status === DocSTATUS.PENDING) return 'Ожидает';
  if (status === DocSTATUS.REJECTED) return 'Отклонен';
  if (status === DocSTATUS.DELETED) return 'Удален';
  return '-';
};

export const PrintRegistry = forwardRef<HTMLDivElement, PrintRegistryProps>(
  (
    {
      filteredDocuments,
      contentName,
      references,
      enterprises,
      mainData,
      dateStart,
      dateEnd,
      total,
      count,
      ordersById,
    },
    ref,
  ) => {
    const isGateIncome = contentName === DocumentType.GateIncome;
    const showOrderColumn = showsOrderInJournal(contentName);
    const showToolsRentalColumns = showsToolsRentalInJournal(contentName);
    const ordersMap = ordersById ?? new Map<number, FurnitureOrder>();

    const title =
      contentName === 'ALL_DOCUMENTS'
        ? 'Барча хужжатлар'
        : getDescriptionDocument(contentName as DocumentType);

    const dateRangeText = `${secondsToDateString(
      dateStart,
    )} - ${secondsToDateString(dateEnd)}`;

    const getCarModel = (carId: number | undefined): string => {
      if (!carId || !references || !Array.isArray(references)) return '-';
      const carReference = references.find((ref: any) => ref.id === carId);
      return carReference?.refValues?.carModel || '-';
    };

    const safeDocuments = filteredDocuments || [];

    return (
      <div ref={ref} className={styles.printContainer}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <div className={styles.dateRange}>{dateRangeText}</div>
        </div>

        <table className={styles.table}>
          <thead>
            {isGateIncome ? (
              <tr>
                <th>Раками</th>
                <th>Сана</th>
                <th>Номер машины</th>
                <th>Модель авто</th>
                <th>Изох</th>
                <th>Холат</th>
                <th>Фойдаланувчи</th>
              </tr>
            ) : (
              <tr>
                <th>Раками</th>
                <th>Сана</th>
                <th>Корхона</th>
                {contentName === 'ALL_DOCUMENTS' && <th>Хужжат тури</th>}
                <th>Сумма</th>
                {showToolsRentalColumns && <th>Ижара</th>}
                {(contentName === 'ALL_DOCUMENTS' ||
                  contentName === DocumentType.LeaveCash ||
                  contentName === DocumentType.MoveCash) && <th>USD</th>}
                <th>Олувчи</th>
                <th>Берувчи</th>
                {(contentName === 'ALL_DOCUMENTS' ||
                  isDocumentWithAnalitic(contentName as DocumentType)) && (
                  <th>Аналитика</th>
                )}
                {showOrderColumn && <th>Заказ</th>}
                <th>Изох</th>
                <th>Фойдаланувчи</th>
              </tr>
            )}
          </thead>
          <tbody>
            {safeDocuments.map((item) =>
              isGateIncome ? (
                <tr key={item.id}>
                  <td
                    className={cn(
                      styles.statusCell,
                      getStatusClass(item.docStatus),
                    )}
                  >
                    {item.id}
                  </td>
                  <td>{secondsToDateString(item.date)}</td>
                  <td>{getNameReference(references, item.docValues?.carId)}</td>
                  <td>{getCarModel(item.docValues?.carId)}</td>
                  <td>{item.docValues?.comment || '-'}</td>
                  <td>{getGateIncomeStatusText(item.docStatus)}</td>
                  <td>{getUserName(item.userId, mainData)}</td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td
                    className={cn(
                      styles.statusCell,
                      getStatusClass(item.docStatus),
                    )}
                  >
                    {item.id}
                  </td>
                  <td>
                    {showToolsRentalColumns && item.date ? (
                      <>
                        <div>{formatDisplayDate(+item.date)}</div>
                        <div>{formatDisplayTime(+item.date)}</div>
                      </>
                    ) : (
                      secondsToDateString(item.date)
                    )}
                  </td>
                  <td>
                    {item.isInterEnterprise ? (
                      <>
                        {item.sourceEnterprise?.name ||
                          getNameEnterprise(
                            enterprises,
                            item.sourceEnterpriseId,
                          )}{' '}
                        →
                        {item.targetEnterprise?.name ||
                          getNameEnterprise(
                            enterprises,
                            item.targetEnterpriseId,
                          )}
                      </>
                    ) : (
                      item.enterprise?.name ||
                      getNameEnterprise(enterprises, item.enterpriseId)
                    )}
                  </td>
                  {contentName === 'ALL_DOCUMENTS' && (
                    <td>
                      {item.isInterEnterprise ? (
                        (() => {
                          const user = mainData?.users?.user;
                          const userEnterpriseId = user?.enterpriseId;
                          if (
                            item.targetEnterpriseId === userEnterpriseId &&
                            item.documentTypeForReceiver
                          ) {
                            return getDescriptionDocument(
                              item.documentTypeForReceiver,
                            );
                          }
                          return getDescriptionDocument(item.documentType);
                        })()
                      ) : (
                        getDescriptionDocument(item.documentType)
                      )}
                    </td>
                  )}
                  <td className={styles.sumCell}>{documentTotal(item)}</td>
                  {showToolsRentalColumns && (
                    <td>
                      {getToolsRentalAmountsLines(item).map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </td>
                  )}
                  {(contentName === 'ALL_DOCUMENTS' ||
                    item.documentType === DocumentType.LeaveCash ||
                    item.documentType === DocumentType.MoveCash) && (
                    <td className={styles.sumCell}>
                      {item.documentType === DocumentType.LeaveCash ||
                      item.documentType === DocumentType.MoveCash
                        ? item.docValues?.usd
                          ? numberValue(item.docValues.usd)
                          : '-'
                        : ''}
                    </td>
                  )}
                  <td>
                    {getNameReference(references, item.docValues?.receiverId)}
                  </td>
                  <td>
                    {getNameReference(references, item.docValues?.senderId)}
                  </td>
                  {(contentName === 'ALL_DOCUMENTS' ||
                    isDocumentWithAnalitic(item.documentType)) && (
                    <td>
                      {isDocumentWithAnalitic(item.documentType)
                        ? `${getNameReference(
                            references,
                            item.docValues?.analiticId,
                          )}${
                            item.docValues?.cashFromPartner
                              ? `  ${item.docValues?.cashFromPartner} `
                              : ''
                          }`
                        : ''}
                    </td>
                  )}
                  {showOrderColumn && (
                    <td>
                      {formatOrderJournalLabel(
                        item.docValues?.orderId,
                        ordersMap,
                      )}
                    </td>
                  )}
                  <td>
                    {`${item.docValues?.comment ? `${item.docValues?.comment} - ` : ''}${
                      item.docValues?.count ? `${item.docValues?.count}` : ''
                    }${
                      item.docValues?.finPerson
                        ? ` ${item.docValues?.finPerson} `
                        : ''
                    }`}
                  </td>
                  <td>{getUserName(item.userId, mainData)}</td>
                </tr>
              ),
            )}
          </tbody>
          <tfoot>
            <tr className={styles.footerRow}>
              <td colSpan={4}>
                Жами хужжатлар сони: {count || safeDocuments.length}
              </td>
              {!isGateIncome && (
                <td
                  className={styles.sumCell}
                  colSpan={
                    showToolsRentalColumns
                      ? 2
                      : (contentName === 'ALL_DOCUMENTS' ||
                            contentName === DocumentType.LeaveCash ||
                            contentName === DocumentType.MoveCash) &&
                          (contentName === 'ALL_DOCUMENTS' ||
                            isDocumentWithAnalitic(contentName as DocumentType))
                        ? 3
                        : 2
                  }
                >
                  Жами сумма: {numberValue(total)}
                </td>
              )}
              {isGateIncome && (
                <td colSpan={3} />
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    );
  },
);

PrintRegistry.displayName = 'PrintRegistry';

