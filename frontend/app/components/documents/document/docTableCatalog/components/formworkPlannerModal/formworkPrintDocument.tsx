'use client';

import React, { forwardRef } from 'react';
import { FormworkKind, FORMWORK_KIND_LABELS } from '@/app/interfaces/reference.interface';
import {
  FormworkElement,
  FormworkLayout,
  FormworkSolveResult,
  FwGeometry,
} from '@/app/service/formwork/formwork.types';
import { formatDisplayDateTime } from '@/app/utils/formatDisplayDate';
import FormworkLayoutScheme from './formworkLayoutScheme';

export interface FormworkPrintDocumentProps {
  layout: FormworkLayout;
  geometry: FwGeometry;
  result: FormworkSolveResult;
  elements: FormworkElement[];
  clientName?: string;
  documentId?: number | string;
  documentDate?: number;
}

const cell = { border: '1px solid #000', padding: '4px 6px' } as const;
const cellRight = { ...cell, textAlign: 'right' as const };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const FormworkPrintDocument = forwardRef<HTMLDivElement, FormworkPrintDocumentProps>(
  ({ layout, geometry, result, elements, clientName, documentId, documentDate }, ref) => {
    const shortage = result.spec.filter((r) => r.shortage > 0);
    const kindLabel = (k: FormworkKind) => FORMWORK_KIND_LABELS[k] ?? k;

    return (
      <div ref={ref} style={{ padding: 20, fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 6px', fontSize: 16 }}>
          Опалубка жойлашуви схемаси
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            {clientName ? (
              <div>
                Буюртмачи: <b>{clientName}</b>
              </div>
            ) : null}
            {documentId ? <div>Ҳужжат № {documentId}</div> : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            {documentDate ? <div>{formatDisplayDateTime(documentDate)}</div> : null}
            <div>
              Лента: {layout.stripWidth} мм · Баландлик: {layout.foundationHeight} мм
            </div>
            <div>Яруслар: {result.tiers.join(' + ')} мм</div>
          </div>
        </div>

        {result.tiers.map((h, tier) => (
          <div key={tier} style={{ pageBreakInside: 'avoid', marginBottom: 10 }}>
            {result.tiers.length > 1 && (
              <div style={{ fontWeight: 600, margin: '6px 0 2px' }}>
                Ярус {tier + 1} — {h} мм
              </div>
            )}
            <FormworkLayoutScheme
              geometry={geometry}
              result={result}
              tier={tier}
              stripWidth={layout.stripWidth}
              elements={elements}
              height={result.tiers.length > 1 ? 380 : 520}
              showLegend
              showDimensions
            />
          </div>
        ))}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr>
              <th style={cell}>№</th>
              <th style={cell}>Тури</th>
              <th style={cell}>Номи</th>
              <th style={cell}>Ўлчам</th>
              <th style={cellRight}>Керак</th>
              {result.stockKnown && <th style={cellRight}>Берилади</th>}
              {result.stockKnown && <th style={cellRight}>Етишмайди</th>}
            </tr>
          </thead>
          <tbody>
            {result.spec.map((r, i) => (
              <tr key={r.analiticId}>
                <td style={cellRight}>{i + 1}</td>
                <td style={cell}>{kindLabel(r.kind)}</td>
                <td style={cell}>{r.name}</td>
                <td style={cell}>{r.size ?? ''}</td>
                <td style={cellRight}>{fmt(r.need)}</td>
                {result.stockKnown && <td style={cellRight}>{fmt(r.issue)}</td>}
                {result.stockKnown && (
                  <td style={{ ...cellRight, color: r.shortage > 0 ? '#b91c1c' : undefined, fontWeight: r.shortage > 0 ? 700 : undefined }}>
                    {r.shortage > 0 ? fmt(r.shortage) : ''}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {shortage.length > 0 && (
          <div style={{ marginTop: 10, border: '1px solid #b91c1c', padding: 8 }}>
            <b style={{ color: '#b91c1c' }}>Складда етишмайди:</b>{' '}
            {shortage.map((r) => `${r.name}${r.size ? ` (${r.size})` : ''} — ${fmt(r.shortage)} дона`).join('; ')}
          </div>
        )}

        {result.warnings.length > 0 && (
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 11 }}>
          <span>Ташқи контур: {(result.totals.outerLength / 1000).toFixed(2)} м</span>
          <span>Ички контур: {(result.totals.holeLength / 1000).toFixed(2)} м</span>
          <span>Щитлар: {result.totals.panels}</span>
          <span>
            Бурчаклар: {result.totals.cornersOuter} ташқи / {result.totals.cornersInner} ички
          </span>
        </div>
      </div>
    );
  },
);

FormworkPrintDocument.displayName = 'FormworkPrintDocument';

export default FormworkPrintDocument;
