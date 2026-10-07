'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ToolsCurrentBalanceProps,
  ToolsCurrentBalanceRow,
  ToolsCurrentBalanceValues,
} from './toolsCurrentBalance.props';
import styles from './toolsCurrentBalance.module.css';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { getInformation } from '@/app/service/reports/getInformation';
import { numberValue } from '@/app/service/common/converters';
import { formatDisplayDateTime } from '@/app/utils/formatDisplayDate';
import { formatDateTimeForInput, parseDateTimeInputValue } from '@/app/utils/datetimeInput';
import { nowMs } from '@/app/utils/serverNow';
import { AtClientDetailsModal } from './AtClientDetailsModal';

function toDatetimeLocalValue(ms: number): string {
  return formatDateTimeForInput(ms);
}

function fromDatetimeLocalValue(value: string): number {
  return parseDateTimeInputValue(value) ?? 0;
}

export const ToolsCurrentBalance = ({
  data,
  className,
  ...props
}: ToolsCurrentBalanceProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const enterpriseName = useEnterpriseName();

  const [asOfLocal, setAsOfLocal] = useState(() =>
    toDatetimeLocalValue(nowMs()),
  );
  const [showZeros, setShowZeros] = useState(false);
  const [detailRow, setDetailRow] = useState<ToolsCurrentBalanceRow | null>(
    null,
  );

  const report = Array.isArray(data)
    ? data.find(
        (item: { reportType?: string }) =>
          item?.reportType === 'TOOLSCURRENTBALANCE',
      )
    : null;
  const values = report?.values as ToolsCurrentBalanceValues | undefined;

  const asOfMs = useMemo(() => {
    if (values?.balanceDate) return Number(values.balanceDate);
    return fromDatetimeLocalValue(asOfLocal);
  }, [values?.balanceDate, asOfLocal]);

  const loadData = useCallback(() => {
    const asOf = fromDatetimeLocalValue(asOfLocal);
    if (!asOf) {
      return;
    }

    getInformation(setMainData, mainData, asOf);
  }, [asOfLocal, mainData, setMainData]);

  const openAtClientDetails = (row: ToolsCurrentBalanceRow) => {
    if (Math.abs(Number(row.atClientQty) || 0) <= 1e-9) return;
    setDetailRow(row);
  };

  const visibleRows = useMemo(() => {
    const rows = values?.rows ?? [];
    if (showZeros) return rows;
    return rows.filter((row) => Math.abs(Number(row.totalQty) || 0) > 1e-9);
  }, [values?.rows, showZeros]);

  const visibleTotals = useMemo(() => {
    return visibleRows.reduce(
      (acc, row) => {
        acc.warehouseQty += Number(row.warehouseQty) || 0;
        acc.atClientQty += Number(row.atClientQty) || 0;
        acc.totalQty += Number(row.totalQty) || 0;
        acc.warehouseSum += Number(row.warehouseSum) || 0;
        return acc;
      },
      {
        warehouseQty: 0,
        atClientQty: 0,
        totalQty: 0,
        warehouseSum: 0,
      },
    );
  }, [visibleRows]);

  return (
    <div className={styles.container} {...props}>
      <div className={styles.title}>
        Ускуналар — жорий қолдиқ
        {enterpriseName && <span> - {enterpriseName}</span>}
      </div>

      {values?.balanceDate ? (
        <div className={styles.subtitle}>
          Қолдиқ вақти: {formatDisplayDateTime(values.balanceDate)}
          {values.warehouseId
            ? ` · Умум склад: ${values.warehouseName}`
            : ` · ${values.warehouseName || 'Умум булим топилмади'}`}
        </div>
      ) : (
        <div className={styles.subtitle}>
          Танланган сана-вақтда ускуналар қолдиғи (омборда — умум склад, мижозда)
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.dateField}>
          <label className={styles.dateLabel} htmlFor="toolsBalanceAsOf">
            Сана ва вақт
          </label>
          <input
            id="toolsBalanceAsOf"
            type="datetime-local"
            className={styles.dateInput}
            value={asOfLocal}
            onChange={(e) => setAsOfLocal(e.target.value)}
          />
        </div>
        <div className={styles.checkboxField}>
          <span className={styles.checkboxLabel}>Кўрсатиш</span>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={showZeros}
              onChange={(e) => setShowZeros(e.target.checked)}
            />
            Нольларини кўрсатиш
          </label>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={loadData}
        >
          Ок
        </button>
      </div>

      {!values && (
        <div className={styles.emptyMessage}>Маълумотлар юкланмоқда</div>
      )}

      {values && visibleRows.length === 0 && (
        <div className={styles.emptyMessage}>
          Қолдиқли ускуналар топилмади
        </div>
      )}

      {values && visibleRows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.center} ${styles.indexCol}`}>№</th>
              <th className={styles.articleCol}>Артикул</th>
              <th>Ускуна</th>
              <th className={styles.numeric}>Омборда</th>
              <th className={styles.numeric}>Мижозда</th>
              <th className={styles.numeric}>Жами</th>
              <th className={styles.numeric}>Сумма (омбор)</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const hasAtClient =
                Math.abs(Number(row.atClientQty) || 0) > 1e-9;
              return (
                <tr
                  key={row.toolId}
                  className={hasAtClient ? styles.clickableRow : undefined}
                  onClick={() => openAtClientDetails(row)}
                  title={
                    hasAtClient
                      ? 'Мижоздаги қолдиқни кўриш'
                      : undefined
                  }
                >
                  <td className={`${styles.center} ${styles.indexCol}`}>
                    {index + 1}
                  </td>
                  <td>{row.article || '-'}</td>
                  <td>{row.toolName}</td>
                  <td className={styles.numeric}>
                    {numberValue(Number(row.warehouseQty) || 0)}
                  </td>
                  <td className={styles.numeric}>
                    {numberValue(Number(row.atClientQty) || 0)}
                  </td>
                  <td className={styles.numeric}>
                    {numberValue(Number(row.totalQty) || 0)}
                  </td>
                  <td className={styles.numeric}>
                    {numberValue(Number(row.warehouseSum) || 0)}
                  </td>
                </tr>
              );
            })}
            <tr className={styles.summaryRow}>
              <td colSpan={3} className={styles.center}>
                Жами
              </td>
              <td className={styles.numeric}>
                {numberValue(visibleTotals.warehouseQty)}
              </td>
              <td className={styles.numeric}>
                {numberValue(visibleTotals.atClientQty)}
              </td>
              <td className={styles.numeric}>
                {numberValue(visibleTotals.totalQty)}
              </td>
              <td className={styles.numeric}>
                {numberValue(visibleTotals.warehouseSum)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {detailRow && (
        <AtClientDetailsModal
          isOpen={!!detailRow}
          onClose={() => setDetailRow(null)}
          toolId={detailRow.toolId}
          toolName={detailRow.toolName}
          article={detailRow.article}
          warehouseQty={Number(detailRow.warehouseQty) || 0}
          atClientQty={Number(detailRow.atClientQty) || 0}
          asOf={asOfMs}
        />
      )}
    </div>
  );
};
