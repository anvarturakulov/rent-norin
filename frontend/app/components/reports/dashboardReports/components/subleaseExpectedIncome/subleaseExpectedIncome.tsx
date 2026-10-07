'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { SubleaseExpectedIncomeProps } from './subleaseExpectedIncome.props';
import styles from './subleaseExpectedIncome.module.css';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import {
  getSubleaseExpectedIncome,
  SubleaseExpectedIncomeResponse,
} from '@/app/service/reports/getSubleaseExpectedIncome';
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

export const SubleaseExpectedIncome = ({
  className,
  ...props
}: SubleaseExpectedIncomeProps): JSX.Element => {
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
    useState<SubleaseExpectedIncomeResponse | null>(null);
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
      const data = await getSubleaseExpectedIncome(
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
        Субаренда — кутилаётган даромад
        {enterpriseName && <span> - {enterpriseName}</span>}
      </div>

      {reportData?.asOf ? (
        <div className={styles.subtitle}>
          Ҳисоблаш вақти: {formatDisplayDateTime(reportData.asOf)}
          {' — '}агар шу пайтда қайтарилса
        </div>
      ) : (
        <div className={styles.subtitle}>
          Кўрсатилган сана-вақтда мижоз қайтарса — мижоздан даромад, ҳамкорга
          тўлаш суммаси ва маржа
        </div>
      )}

      <div className={styles.filters}>
        <label className={styles.dateLabel} htmlFor="subleaseExpectedAsOf">
          Сана ва вақт
        </label>
        <div className={styles.filtersRow}>
          <input
            ref={asOfInputRef}
            id="subleaseExpectedAsOf"
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
          Очиқ субарендадаги ускуналар топилмади
        </div>
      )}

      {!loading && clients.length > 0 && (
        <>
          <div className={styles.grandTotals}>
            <div className={styles.grandTotalsItem}>
              <span className={styles.grandTotalsItemLabel}>
                Мижоздан даромад:
              </span>
              <span>{numberValue(reportData?.grandTotalClientRent ?? 0)}</span>
            </div>
            <div className={styles.grandTotalsItem}>
              <span className={styles.grandTotalsItemLabel}>
                Ҳамкорга тўлаш суммаси:
              </span>
              <span>{numberValue(reportData?.grandTotalPartnerCost ?? 0)}</span>
            </div>
            <div className={styles.grandTotalsItem}>
              <span className={styles.grandTotalsItemLabel}>Маржа:</span>
              <span>{numberValue(reportData?.grandTotalMargin ?? 0)}</span>
            </div>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Мижоз</th>
                  <th>Ускуна</th>
                  <th>Сони</th>
                  <th>Ҳисоб бошланиши</th>
                  <th>Соат</th>
                  <th>Тариф мижоз</th>
                  <th>Тариф ҳамкор</th>
                  <th>Мижоздан даромад</th>
                  <th>Ҳамкорга тўлаш суммаси</th>
                  <th>Маржа</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <Fragment key={client.clientId}>
                    {client.tools.map((tool, idx) => (
                      <tr
                        key={`${client.clientId}-${tool.toolId}-${tool.transferDocId}-${idx}`}
                      >
                        <td>{client.clientName}</td>
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
                          {numberValue(tool.partnerHourlyTariff)}
                        </td>
                        <td className={styles.numeric}>
                          {numberValue(tool.clientRentSum)}
                        </td>
                        <td className={styles.numeric}>
                          {numberValue(tool.partnerCostSum)}
                        </td>
                        <td className={styles.numeric}>
                          {numberValue(tool.margin)}
                        </td>
                      </tr>
                    ))}
                    <tr className={styles.subtotalRow}>
                      <td colSpan={7}>
                        <strong>Жами ({client.clientName})</strong>
                      </td>
                      <td className={styles.numeric}>
                        <strong>{numberValue(client.totalClientRent)}</strong>
                      </td>
                      <td className={styles.numeric}>
                        <strong>{numberValue(client.totalPartnerCost)}</strong>
                      </td>
                      <td className={styles.numeric}>
                        <strong>{numberValue(client.totalMargin)}</strong>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
