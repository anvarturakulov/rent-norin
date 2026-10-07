'use client';

import { SupplierGoodsProps } from './supplierGoods.props';
import styles from './supplierGoods.module.css';
import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import {
  getSupplierGoodsInform,
  SupplierGoodsResponse,
} from '@/app/service/reports/getSupplierGoodsInform';
import { SelectReference } from '@/app/components/reports/simpleReports/optionsBox/components/selectReference/selectReference';
import { TypeReference, TypeTMZ } from '@/app/interfaces/reference.interface';
import { numberValue } from '@/app/service/common/converters';

const TYPE_TMZ_LABELS: Record<string, string> = {
  [TypeTMZ.MATERIAL]: 'Материал',
  [TypeTMZ.PRODUCT]: 'Товар',
  [TypeTMZ.HALFSTUFF]: 'Ярм-фабрикат',
  [TypeTMZ.OS]: 'ОС',
  [TypeTMZ.TOOLS]: 'Ускуна',
  [TypeTMZ.TOVAR]: 'Товар',
};

const formatPeriodDate = (value: number | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ru-RU');
};

export const SupplierGoods = ({
  className,
  ...props
}: SupplierGoodsProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { dateStart, dateEnd } = mainData.journal.interval;
  const { reportOption, selectedEnterpriseId } = mainData.report;
  const { firstReferenceId } = reportOption;
  const { user } = mainData.users;
  const token = user?.token || '';

  const [reportData, setReportData] = useState<SupplierGoodsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterpriseName = useEnterpriseName();

  useEffect(() => {
    if (reportOption.partnerType === 'SUPPLIERS') {
      return;
    }

    setMainData('reportOption', {
      ...reportOption,
      partnerType: 'SUPPLIERS',
    });
  }, [reportOption, setMainData]);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    if (!dateStart || !dateEnd) {
      setError('Саналарни танланг');
      return;
    }

    if (
      firstReferenceId === null ||
      firstReferenceId === undefined ||
      firstReferenceId === 0
    ) {
      setError('Таъминотчини танланг');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getSupplierGoodsInform(
        Number(firstReferenceId),
        dateStart,
        dateEnd,
        selectedEnterpriseId,
        token,
      );
      setReportData(data);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Маълумот юклашда хатолик юз берди';
      setError(message);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [
    token,
    dateStart,
    dateEnd,
    firstReferenceId,
    selectedEnterpriseId,
  ]);

  const values = reportData?.values;
  const items = values?.items ?? [];
  const totals = values?.totals;

  return (
    <div className={styles.container} {...props}>
      <div className={styles.title}>
        Таъминотчи — товар ва материаллар
        {enterpriseName && <span> — {enterpriseName}</span>}
      </div>

      <div className={styles.filters}>
        <SelectReference
          label="Таъминотчи"
          visible={true}
          typeReference={TypeReference.PARTNERS}
          id="firstReferenceId"
        />
        <button
          type="button"
          className={styles.refreshButton}
          onClick={loadData}
          disabled={loading}
        >
          {loading ? 'Юкланмокда...' : 'Янгилаш'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Маълумот юкланмокда...</div>}

      {!loading && !error && reportData && items.length === 0 && (
        <div className={styles.emptyMessage}>
          {values?.supplierName
            ? `${values.supplierName} таъминотчиси бўйича маълумот топилмади`
            : 'Маълумот мавжуд эмас'}
        </div>
      )}

      {!loading && items.length > 0 && values && (
        <>
          <div className={styles.subtitle}>
            Таъминотчи: {values.supplierName || '-'} · Давр:{' '}
            {formatPeriodDate(values.periodStart)} —{' '}
            {formatPeriodDate(values.periodEnd)} · Ҳужжатлар:{' '}
            {totals?.documentsCount ?? 0} · Операциялар:{' '}
            {totals?.operationsCount ?? 0}
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.center} ${styles.indexCol}`}>№</th>
                <th className={styles.dateCol}>Сана</th>
                <th className={styles.articleCol}>Артикул</th>
                <th>Номи</th>
                <th className={styles.typeCol}>Тури</th>
                <th className={styles.unitCol}>Улч. бир.</th>
                <th className={styles.numeric}>Сони</th>
                <th className={styles.numeric}>Нарх</th>
                <th className={styles.numeric}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.docId}-${item.itemId}-${index}`}>
                  <td className={`${styles.center} ${styles.indexCol}`}>
                    {index + 1}
                  </td>
                  <td className={styles.dateCol}>
                    {formatPeriodDate(item.date)}
                  </td>
                  <td>{item.article || '-'}</td>
                  <td>{item.itemName}</td>
                  <td className={styles.typeCol}>
                    {TYPE_TMZ_LABELS[item.typeTMZ] || item.typeTMZ || '-'}
                  </td>
                  <td className={styles.unitCol}>{item.unit || '-'}</td>
                  <td className={styles.numeric}>
                    {numberValue(Number(item.count) || 0)}
                  </td>
                  <td className={styles.numeric}>
                    {numberValue(Number(item.price) || 0)}
                  </td>
                  <td className={styles.numeric}>
                    {numberValue(Number(item.total) || 0)}
                  </td>
                </tr>
              ))}
              <tr className={styles.summaryRow}>
                <td colSpan={6} className={styles.center}>
                  Жами
                </td>
                <td className={styles.numeric}>
                  {numberValue(Number(totals?.totalCount) || 0)}
                </td>
                <td />
                <td className={styles.numeric}>
                  {numberValue(Number(totals?.totalSum) || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};
