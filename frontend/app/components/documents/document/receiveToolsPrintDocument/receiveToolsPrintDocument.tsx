'use client';

import React, { forwardRef } from 'react';
import {
  DocumentModel,
  DocTableItem,
  getReturnItems,
  getBrakItems,
  getSaleItems,
  getTovarItems,
} from '@/app/interfaces/document.interface';
import { formatDisplayDateTime } from '@/app/utils/formatDisplayDate';
import { numberValue } from '@/app/service/common/converters';
import { getTotalRentFromReturnRows } from '@/app/service/documents/fillReceiveToolsTable';
import {
  formatRentHours,
  getReceiveToolsRentHours,
  getReceiveToolsReturnDateTime,
} from '@/app/service/documents/receiveToolsRent';
import { PrintCopiesWithTearOff } from '../printCopies/printCopies';

export type ReceiveToolsPrintDocumentProps = {
  document: DocumentModel;
  clientName?: string;
  warehouseName?: string;
  delivererName?: string;
  contractBasis?: string;
  toolNames: Record<number, string>;
  copyCount?: number;
};

const cellStyle = { border: '1.5px solid #000', padding: 6 };

const ReceiveToolsPrintDocument = forwardRef<HTMLDivElement, ReceiveToolsPrintDocumentProps>(
  (
    {
      document,
      clientName,
      warehouseName,
      delivererName,
      contractBasis,
      toolNames,
      copyCount = 1,
    },
    ref,
  ) => {
    const returnItems = getReturnItems(document.docTableItems || []);
    const brakItems = getBrakItems(document.docTableItems || []);
    const saleItems = getSaleItems(document.docTableItems || []);
    const tovarItems = getTovarItems(document.docTableItems || []);
    const totalRent = getTotalRentFromReturnRows(document.docTableItems);
    const returnDateTime = getReceiveToolsReturnDateTime(document);
    const compact = copyCount >= 2;

    const renderSimpleTable = (title: string, rows: DocTableItem[]) => (
      <>
        <h3 style={{ marginTop: compact ? 8 : undefined }}>{title}</h3>
        {rows.length === 0 ? (
          <p>—</p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: compact ? 8 : 16,
            }}
          >
            <thead>
              <tr>
                <th style={cellStyle}>№</th>
                <th style={cellStyle}>Номи</th>
                <th style={cellStyle}>Миқдор</th>
                <th style={cellStyle}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => (
                <tr key={idx}>
                  <td style={cellStyle}>{idx + 1}</td>
                  <td style={cellStyle}>
                    {toolNames[item.analiticId] || item.analiticId}
                  </td>
                  <td style={cellStyle}>{item.count}</td>
                  <td style={cellStyle}>
                    {numberValue(item.costTotal ?? item.total ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );

    const renderReturnTable = () => (
      <>
        <h3 style={{ marginTop: compact ? 8 : undefined }}>Возврат</h3>
        {returnItems.length === 0 ? (
          <p>—</p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: compact ? 8 : 16,
            }}
          >
            <thead>
              <tr>
                <th style={cellStyle}>№</th>
                <th style={cellStyle}>Номи</th>
                <th style={cellStyle}>Миқдор</th>
                <th style={cellStyle}>Соат</th>
                <th style={cellStyle}>Тариф</th>
                <th style={cellStyle}>Ижара</th>
                <th style={cellStyle}>Нархи</th>
                <th style={cellStyle}>Суммаси</th>
              </tr>
            </thead>
            <tbody>
              {returnItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={cellStyle}>{idx + 1}</td>
                  <td style={cellStyle}>
                    {toolNames[item.analiticId] || item.analiticId}
                  </td>
                  <td style={cellStyle}>{item.count}</td>
                  <td style={cellStyle}>
                    {formatRentHours(getReceiveToolsRentHours(item, returnDateTime))}
                  </td>
                  <td style={cellStyle}>{numberValue(item.hourlyTariff ?? 0)}</td>
                  <td style={cellStyle}>{numberValue(item.rentSum ?? 0)}</td>
                  <td style={cellStyle}>{numberValue(item.price ?? 0)}</td>
                  <td style={cellStyle}>{numberValue(item.total ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );

    const renderTovarTable = () => {
      if (tovarItems.length === 0) return null;
      return (
        <>
          <h3 style={{ marginTop: compact ? 8 : undefined }}>Мижозга товар сотиш</h3>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: compact ? 8 : 16,
            }}
          >
            <thead>
              <tr>
                <th style={cellStyle}>№</th>
                <th style={cellStyle}>Номи</th>
                <th style={cellStyle}>Миқдор</th>
                <th style={cellStyle}>Нарх</th>
                <th style={cellStyle}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {tovarItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={cellStyle}>{idx + 1}</td>
                  <td style={cellStyle}>
                    {toolNames[item.analiticId] || item.analiticId}
                  </td>
                  <td style={cellStyle}>{item.count}</td>
                  <td style={cellStyle}>{numberValue(item.price ?? 0)}</td>
                  <td style={cellStyle}>{numberValue(item.total ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    };

    const renderCopy = () => (
      <div
        style={{
          padding: compact ? 12 : 24,
          fontFamily: 'Arial, sans-serif',
          fontSize: compact ? 11 : 14,
        }}
      >
        <h2 style={{ textAlign: 'center', fontSize: compact ? 16 : undefined, margin: '0 0 8px' }}>
          Акт приёма ускуналар
        </h2>
        <p>
          № {document.id} &nbsp;|&nbsp; Дата:{' '}
          {formatDisplayDateTime(returnDateTime)}
        </p>
        <p>Клиент: {clientName || '—'}</p>
        <p>Склад: {warehouseName || '—'}</p>
        <p>Асос: {contractBasis || '—'}</p>
        <p>Ижарадан даромад: {numberValue(totalRent)} сўм</p>
        <p>Накд: {numberValue(document.docValues?.initialPayment ?? 0)}</p>
        <p>Пластик: {numberValue(document.docValues?.cashFromPartner ?? 0)}</p>
        <p>
          USD: {numberValue(document.docValues?.usd ?? 0)} (курс:{' '}
          {numberValue(document.docValues?.currency ?? 0)})
        </p>
        <p>Кайтим: {numberValue(document.docValues?.changeToClient ?? 0)}</p>
        <p>Насияга: {numberValue(document.docValues?.debtSum ?? 0)}</p>
        {Number(document.docValues?.deliverySum || 0) > 0 && (
          <p>
            Доставка: {numberValue(document.docValues?.deliverySum ?? 0)} сўм
            {delivererName ? ` (${delivererName})` : ''}
          </p>
        )}
        {Number(document.docValues?.defectCost || 0) > 0 && (
          <p>
            Брак буйича харажатлар: {numberValue(document.docValues?.defectCost ?? 0)} сўм
          </p>
        )}

        {renderReturnTable()}
        {renderSimpleTable('Брак', brakItems)}
        {renderSimpleTable('Мижозга сотиш', saleItems)}
        {renderTovarTable()}

        <div
          style={{
            marginTop: compact ? 48 : 64,
            paddingBottom: compact ? 16 : 0,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Сдал: _______________</span>
          <span>Принял: _______________</span>
        </div>
      </div>
    );

    return (
      <PrintCopiesWithTearOff ref={ref} copyCount={copyCount} renderCopy={renderCopy} />
    );
  },
);

ReceiveToolsPrintDocument.displayName = 'ReceiveToolsPrintDocument';

export default ReceiveToolsPrintDocument;
