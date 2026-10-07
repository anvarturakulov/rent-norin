'use client';

import React, { forwardRef } from 'react';
import {
  DocumentModel,
  getIncomeItems,
  getSaleItems,
} from '@/app/interfaces/document.interface';
import { formatDisplayDateTime } from '@/app/utils/formatDisplayDate';
import { numberValue } from '@/app/service/common/converters';
import { PrintCopiesWithTearOff } from '../printCopies/printCopies';
import { getRentTariffTypeLabel } from '@/app/service/documents/rentTariffType';

const cellBorder = { border: '1.5px solid #000', padding: 6 } as const;
const cellCenter = { ...cellBorder, textAlign: 'center' as const };
const cellRight = { ...cellBorder, textAlign: 'right' as const };
const thCenter = { ...cellBorder, textAlign: 'center' as const };

export type TransferToolsPrintDocumentProps = {
  document: DocumentModel;
  clientName?: string;
  contractBasis?: string;
  toolNames: Record<number, string>;
  copyCount?: number;
};

const TransferToolsPrintDocument = forwardRef<HTMLDivElement, TransferToolsPrintDocumentProps>(
  ({ document, clientName, contractBasis, toolNames, copyCount = 1 }, ref) => {
    const filled = (document.docTableItems || []).filter((i) => Number(i.analiticId) > 0);
    const toolItems = getIncomeItems(filled);
    const saleItems = getSaleItems(filled);
    const deliverySum = Number(document.docValues?.deliverySum || 0);
    const defectCost = Number(document.docValues?.defectCost || 0);
    const saleTotal = saleItems.reduce((s, i) => s + (Number(i.total) || 0), 0);

    const totalCount = toolItems.reduce((s, i) => s + (Number(i.count) || 0), 0);
    const totalDailyRent = toolItems.reduce((s, i) => s + (Number(i.dailyRent) || 0), 0);
    const totalCost = toolItems.reduce((s, i) => s + (Number(i.costTotal) || 0), 0);

    const settlementDate = document.docValues?.settlementDate
      ? formatDisplayDateTime(Number(document.docValues.settlementDate))
      : '—';

    const usdAmount = Number(document.docValues?.usd) || 0;
    const currency = Number(document.docValues?.currency) || 0;
    const usdInSum = usdAmount * currency;
    const nakdTotal = (Number(document.docValues?.initialPayment) || 0) + usdInSum;
    const plastic = Number(document.docValues?.cashFromPartner) || 0;
    const changeToClient = Number(document.docValues?.changeToClient) || 0;

    const paymentParts: string[] = [];
    if (nakdTotal > 0) {
      paymentParts.push(`Накд: ${numberValue(nakdTotal)} сўм`);
    }
    if (plastic > 0) {
      paymentParts.push(`Пластик: ${numberValue(plastic)} сўм`);
    }
    if (changeToClient > 0) {
      paymentParts.push(`Кайтим: ${numberValue(changeToClient)} сўм`);
    }

    const compact = copyCount >= 2;

    const molId = Number(document.docValues?.materialResponsiblePersonId) || 0;
    const molName = molId > 0 ? toolNames[molId] || '' : '';
    const topshirdimLine = molName
      ? `Топширдим: _______________ ${molName}`
      : 'Топширдим: _______________';

    const renderCopy = () => (
      <div
        style={{
          padding: compact ? 12 : 24,
          fontFamily: 'Arial, sans-serif',
          fontSize: compact ? 11 : 14,
        }}
      >
        <h2
          style={{
            textAlign: 'center',
            fontSize: compact ? 18 : 28,
            fontWeight: 700,
            margin: '0 0 12px',
          }}
        >
          Ускуналарни топшириш кабул килиш далолатномаси
        </h2>
        <p style={{ textAlign: 'center' }}>Асос: {contractBasis || '—'}</p>
        <p>
          Руйхатга куйиш санаси: {formatDisplayDateTime(document.date)}
          <span style={{ marginLeft: 40 }}>
            Ижарани хисоблаш санаси: {settlementDate}
          </span>
        </p>
        <p>Мижоз: {clientName || '—'}</p>
        <p>Тариф: {getRentTariffTypeLabel(document.docValues?.rentTariffType)}</p>
        <p>
          Кунлик ижара: {numberValue(totalDailyRent)} сўм
          <span style={{ marginLeft: 40 }}>
            Доставка: {numberValue(deliverySum)} сўм
          </span>
          {defectCost > 0 && (
            <span style={{ marginLeft: 40 }}>
              Брак буйича харажатлар: {numberValue(defectCost)} сўм
            </span>
          )}
        </p>
        <p>Корхона тел.: +998 97 611 66 98</p>
        {toolItems.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: compact ? 8 : 16 }}>
            <thead>
              <tr>
                <th style={thCenter}>№</th>
                <th style={thCenter}>Номи</th>
                <th style={thCenter}>Миқдор</th>
                <th style={thCenter}>Кунлик тариф</th>
                <th style={thCenter}>Кунлик ижара</th>
                <th style={thCenter}>Ускуна нархи</th>
                <th style={thCenter}>Берилаётган ускуналар киймати</th>
              </tr>
            </thead>
            <tbody>
              {toolItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={cellBorder}>{idx + 1}</td>
                  <td style={cellBorder}>
                    {toolNames[item.analiticId] || item.analiticId}
                  </td>
                  <td style={cellCenter}>{item.count}</td>
                  <td style={cellRight}>
                    {numberValue((Number(item.hourlyTariff) || 0) * 24)}
                  </td>
                  <td style={cellRight}>
                    {numberValue(item.dailyRent ?? 0)}
                  </td>
                  <td style={cellRight}>
                    {numberValue(item.costPrice ?? 0)}
                  </td>
                  <td style={cellRight}>
                    {numberValue(item.costTotal ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={cellBorder} colSpan={2}>
                  Жами
                </td>
                <td style={cellCenter}>{numberValue(totalCount)}</td>
                <td style={cellRight} />
                <td style={cellRight}>{numberValue(totalDailyRent)}</td>
                <td style={cellRight} />
                <td style={cellRight}>{numberValue(totalCost)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        {saleItems.length > 0 && (
          <>
            <h3 style={{ marginTop: compact ? 12 : 24 }}>
              Ускуналарга кушимча бериладиган товарлар
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={thCenter}>№</th>
                  <th style={thCenter}>Номи</th>
                  <th style={thCenter}>Миқдор</th>
                  <th style={thCenter}>Нарх</th>
                  <th style={thCenter}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {saleItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={cellBorder}>{idx + 1}</td>
                    <td style={cellBorder}>
                      {toolNames[item.analiticId] || item.analiticId}
                    </td>
                    <td style={cellCenter}>{item.count}</td>
                    <td style={cellRight}>
                      {numberValue(item.price ?? 0)}
                    </td>
                    <td style={cellRight}>
                      {numberValue(item.total ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: 8 }}>Жами товар: {numberValue(saleTotal)} сўм</p>
          </>
        )}
        {paymentParts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ marginBottom: 4 }}>Мижоз туловлари</p>
            <p>{paymentParts.join('   |   ')}</p>
          </div>
        )}
        {/* mm надёжнее px при печати; место под рукописную подпись */}
        <div
          aria-hidden
          style={{
            height: '10mm',
            minHeight: '10mm',
            lineHeight: '10mm',
            fontSize: 1,
            overflow: 'hidden',
          }}
        >
          &nbsp;
        </div>
        <div
          style={{
            paddingBottom: compact ? 16 : 0,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{topshirdimLine}</span>
          <span>Кабул килдим: _______________</span>
        </div>
      </div>
    );

    return (
      <PrintCopiesWithTearOff ref={ref} copyCount={copyCount} renderCopy={renderCopy} />
    );
  },
);

TransferToolsPrintDocument.displayName = 'TransferToolsPrintDocument';

export default TransferToolsPrintDocument;
