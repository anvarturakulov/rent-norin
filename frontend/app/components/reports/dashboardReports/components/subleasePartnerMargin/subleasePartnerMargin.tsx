'use client';

import { DetailedHTMLProps, HTMLAttributes, useMemo } from 'react';
import styles from '../rentalNetProfit/rentalNetProfit.module.css';

export interface SubleasePartnerMarginProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  data: any;
}

type Row = {
  partnerId: number;
  partnerName: string;
  clientRent: number;
  partnerCost: number;
  margin: number;
  marginPct: number;
  openQty: number;
};

const fmt = (n: number) =>
  Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

export const SubleasePartnerMargin = ({
  data,
  className,
}: SubleasePartnerMarginProps): JSX.Element | null => {
  const report = useMemo(() => {
    if (!Array.isArray(data)) return null;
    return (
      data.find((item: any) => item?.reportType === 'SubleasePartnerMargin') ||
      null
    );
  }, [data]);

  if (!report) return null;

  const rows: Row[] = report.values?.rows || [];
  const totals = report.totals || {};

  return (
    <div className={className}>
      <div className={styles.title}>Субаренда — ҳамкор бўйича</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ҳамкор</th>
            <th>Мижоз даромади</th>
            <th>Ҳамкор харажати</th>
            <th>Маржа</th>
            <th>Маржа %</th>
            <th>Очиқ қолдиқ (дона)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.partnerId}>
              <td>{row.partnerName}</td>
              <td className={styles.numeric}>{fmt(row.clientRent)}</td>
              <td className={styles.numeric}>{fmt(row.partnerCost)}</td>
              <td className={styles.numeric}>{fmt(row.margin)}</td>
              <td className={styles.numeric}>{fmt(row.marginPct)}</td>
              <td className={styles.numeric}>{fmt(row.openQty)}</td>
            </tr>
          ))}
          <tr className={styles.totalsRow}>
            <td>
              <strong>Жами</strong>
            </td>
            <td className={styles.numeric}>
              <strong>{fmt(totals.clientRent)}</strong>
            </td>
            <td className={styles.numeric}>
              <strong>{fmt(totals.partnerCost)}</strong>
            </td>
            <td className={styles.numeric}>
              <strong>{fmt(totals.margin)}</strong>
            </td>
            <td className={styles.numeric}>
              <strong>{fmt(totals.marginPct)}</strong>
            </td>
            <td className={styles.numeric}>
              <strong>{fmt(totals.openQty)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
