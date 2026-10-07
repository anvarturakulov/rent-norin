'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RentalExpectedIncomeProps } from './rentalExpectedIncome.props';
import styles from './rentalExpectedIncome.module.css';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import {
  getRentalExpectedIncome,
  RentalExpectedIncomeResponse,
} from '@/app/service/reports/getRentalExpectedIncome';
import { SelectReference } from '@/app/components/reports/simpleReports/optionsBox/components/selectReference/selectReference';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { numberValue } from '@/app/service/common/converters';
import { formatDisplayDateTime } from '@/app/utils/formatDisplayDate';
import {
  formatDateTimeForInput,
  parseDateTimeInputValue,
} from '@/app/utils/datetimeInput';

function resolveAsOfMs(value: string): number {
  const parsed = parseDateTimeInputValue(value);
  if (parsed != null && parsed > 0) return parsed;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export const RentalExpectedIncome = ({
  className,
  ...props
}: RentalExpectedIncomeProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { reportOption, selectedEnterpriseId } = mainData.report;
  const { firstReferenceId } = reportOption;
  const { user } = mainData.users;
  const token = user?.token || '';

  const asOfInputRef = useRef<HTMLInputElement>(null);

  const [asOfLocal, setAsOfLocal] = useState(() =>
    formatDateTimeForInput(Date.now()),
  );
  const [reportData, setReportData] =
    useState<RentalExpectedIncomeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterpriseName = useEnterpriseName();

  useEffect(() => {
    setMainData('reportOption', {
      ...mainData.report.reportOption,
      partnerType: 'CLIENTS',
      firstReferenceId: undefined,
    });
    // Only on mount: reset partner filter for this report
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear stale results when the as-of datetime changes
  useEffect(() => {
    setReportData(null);
    setError(null);
  }, [asOfLocal]);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    const rawValue = asOfInputRef.current?.value || asOfLocal;
    const asOf = resolveAsOfMs(rawValue);
    if (!asOf) {
      setError('Сана ва вақтни танланг');
      return;
    }

    const clientId =
      firstReferenceId != null &&
      firstReferenceId !== undefined &&
      Number(firstReferenceId) > 0
        ? Number(firstReferenceId)
        : null;

    const enterpriseId =
      typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
        ? (selectedEnterpriseId as { id?: number })?.id
        : selectedEnterpriseId ?? user?.enterpriseId;

    if (enterpriseId == null || Number(enterpriseId) <= 0) {
      setError('Корхонани танланг');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getRentalExpectedIncome(
        asOf,
        Number(enterpriseId),
        token,
        clientId,
      );
      setReportData(data);
    } catch (e: unknown) {
      const axiosMessage =
        e &&
        typeof e === 'object' &&
        'response' in e &&
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      const message =
        (typeof axiosMessage === 'string' && axiosMessage) ||
        (e instanceof Error ? e.message : null) ||
        'Маълумот юклашда хатолик юз берди';
      setError(message);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [
    token,
    asOfLocal,
    firstReferenceId,
    selectedEnterpriseId,
    user?.enterpriseId,
  ]);

  const clients = reportData?.clients || [];

  return (
    <div className={styles.container} {...props}>
      <div className={styles.title}>
        Ижара — кутилаётган даромад
        {enterpriseName && <span> - {enterpriseName}</span>}
      </div>

      {reportData?.asOf ? (
        <div className={styles.subtitle}>
          Ҳисоблаш вақти: {formatDisplayDateTime(reportData.asOf)}
          {' — '}агар шу пайтда қайтарилса
        </div>
      ) : (
        <div className={styles.subtitle}>
          Кўрсатилган сана-вақтда мижоз қайтарса — ҳисобланган ижара даромади
        </div>
      )}

      <div className={styles.filters}>
        <label className={styles.dateLabel} htmlFor="rentalExpectedAsOf">
          Сана ва вақт
        </label>
        <div className={styles.filtersRow}>
          <input
            ref={asOfInputRef}
            id="rentalExpectedAsOf"
            type="datetime-local"
            className={styles.dateInput}
            value={asOfLocal}
            onChange={(e) => setAsOfLocal(e.target.value)}
          />
          <div className={styles.clientField}>
            <SelectReference
              label=""
              visible={true}
              dense
              typeReference={TypeReference.PARTNERS}
              id="firstReferenceId"
            />
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={loadData}
            disabled={loading}
          >
            {loading ? 'Юкланмокда...' : 'ОК'}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Маълумот юкланмокда...</div>}

      {!loading && !error && reportData && clients.length === 0 && (
        <div className={styles.emptyMessage}>
          Очиқ ижарадаги ускуналар топилмади
        </div>
      )}

      {!loading && clients.length > 0 && (
        <>
          <div className={styles.grandTotal}>
            <span>Жами кутилаётган даромад</span>
            <span>{numberValue(reportData?.grandTotal ?? 0)}</span>
          </div>

          <div className={styles.clientsList}>
            {clients.map((client) => (
              <div key={client.clientId} className={styles.clientBlock}>
                <div className={styles.clientHeader}>
                  <span>{client.clientName}</span>
                  <span>{numberValue(client.totalRentSum)}</span>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Ускуна</th>
                      <th>Сони</th>
                      <th>Ҳисоб бошланиши</th>
                      <th>Соат</th>
                      <th>Тариф / соат</th>
                      <th>Даромад</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.tools.map((tool, idx) => (
                      <tr
                        key={`${client.clientId}-${tool.toolId}-${tool.transferDocId}-${idx}`}
                      >
                        <td>{tool.toolName}</td>
                        <td className={styles.center}>
                          {numberValue(tool.count)}
                        </td>
                        <td className={styles.center}>
                          {formatDisplayDateTime(tool.settlementDate)}
                        </td>
                        <td className={styles.numeric}>
                          {numberValue(tool.rentHours)}
                        </td>
                        <td className={styles.numeric}>
                          {numberValue(tool.hourlyTariff)}
                        </td>
                        <td className={styles.numeric}>
                          {numberValue(tool.rentSum)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
