'use client';

import styles from './accountOperations.module.css';
import { useAppContext } from '@/app/context/app.context';
import { useEffect, useMemo, useState } from 'react';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { getAccountOperations } from '@/app/service/reports/getAccountOperations';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { Schet } from '@/app/interfaces/report.interface';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { numberValue } from '@/app/service/common/converters';
import { getNameReference } from '@/app/components/journals/journal/helpers/journal.functions';

type AccountOperationsResponse = {
  schet: Schet;
  startBalans: number;
  endBalans: number;
  results: any[];
};

const SCHET_LABELS: Record<string, string> = {
  S10: 'Хом ашё',
  S20: 'Ишлаб чикариш харажатлари',
  S23: 'Ярим тайёр махсулотлар',
  S28: 'Тайёр махсулотлар',
  // S29: 'Товарлар',
  S40: 'Мижозлар ',
  S41: 'Ички корхоналар',
  S50: 'Касса ва банк',
  // S51: 'Банк',
  S60: 'Таъминотчилар',
  // S66: 'Иш хаки (S66)',
  S67: 'Ходимлар иш хакиси',
  S71: 'Жавобгар шахсдаги пул',
  S65: 'Воситачилар бонуси',
  S64: 'Доставщиклар',
  S68: 'Таъсисчилар',
  S90: 'Даромад',
  S91: 'Таннарх',
};

function resolveRefName(references: any[] | undefined, id: number | null | undefined): string {
  if (id == null) return '';
  if (!references?.length) return '';
  const name = getNameReference(references, id);
  if (!name || name === 'Аникланмади') return '';
  return String(name).trim();
}

function formatCountPriceForEntry(entry: any): string {
  const count = Number(entry?.count);
  if (!Number.isFinite(count) || count <= 0) return '';
  const total = Number(entry?.total);
  const hasPrice = Number.isFinite(total) && total !== 0;
  if (hasPrice) {
    return `( сон: ${numberValue(count)} x ${numberValue(total / count)} )`;
  }
  return `( сон: ${numberValue(count)} )`;
}

function buildIzohForAccountOperation(entry: any, references: any[] | undefined): string {
  const idOrder = [
    entry.debetSecondSubcontoId,
    entry.debetThirdSubcontoId,
    entry.kreditSecondSubcontoId,
    entry.kreditThirdSubcontoId,
  ];
  const seen = new Set<number | string>();
  const parts: string[] = [];
  for (const rawId of idOrder) {
    if (rawId == null) continue;
    const key = rawId as number | string;
    if (seen.has(key)) continue;
    seen.add(key);
    const n = resolveRefName(references, rawId as number);
    if (n) parts.push(n);
  }
  const desc = String(entry.description || '').trim();
  if (desc) parts.push(desc);
  const countInfo = formatCountPriceForEntry(entry);
  if (countInfo) parts.push(countInfo);
  return parts.join(' - ');
}

function getObjectNameForEntry(
  entry: any,
  selectedSchet: string,
  references: any[] | undefined,
): string {
  const debetMatch = entry.debet === selectedSchet;
  const kreditMatch = entry.kredit === selectedSchet;
  if (debetMatch && !kreditMatch) {
    return resolveRefName(references, entry.debetFirstSubcontoId);
  }
  if (kreditMatch && !debetMatch) {
    return resolveRefName(references, entry.kreditFirstSubcontoId);
  }
  if (debetMatch && kreditMatch) {
    return (
      resolveRefName(references, entry.debetFirstSubcontoId) ||
      resolveRefName(references, entry.kreditFirstSubcontoId)
    );
  }
  return (
    resolveRefName(references, entry.debetFirstSubcontoId) ||
    resolveRefName(references, entry.kreditFirstSubcontoId)
  );
}

export const AccountOperations = (): JSX.Element => {
  const { mainData } = useAppContext();
  const { dateStart, dateEnd } = mainData.journal.interval;
  const { selectedEnterpriseId } = mainData.report;
  const { user } = mainData.users;

  const [selectedSchet, setSelectedSchet] = useState<string>(Schet.S40);
  const [reportData, setReportData] = useState<AccountOperationsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const enterpriseName = useEnterpriseName();
  const token = user?.token || '';

  const urlReferences = process.env.NEXT_PUBLIC_DOMAIN + '/api/references/all/';
  const { data: references } = useSWR(
    token ? urlReferences : null,
    (url) => getDataForSwr(url, token),
  );

  const loadData = async () => {
    if (!token || !selectedSchet || !dateStart || !dateEnd) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getAccountOperations(
        selectedSchet,
        dateStart,
        dateEnd,
        selectedEnterpriseId,
        token,
      );
      setReportData(data);
    } catch (e: any) {
      setError(e?.message || 'Маълумот юклашда хатолик юз берди');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchet, dateStart, dateEnd, selectedEnterpriseId, token]);

  const operations = reportData?.results || [];

  const totals = useMemo(() => {
    let kirim = 0;
    let chikim = 0;

    operations.forEach((entry: any) => {
      if (entry.debet === selectedSchet) {
        kirim += Number(entry.total) || 0;
      }
      if (entry.kredit === selectedSchet) {
        chikim += Number(entry.total) || 0;
      }
    });

    return { kirim, chikim };
  }, [operations, selectedSchet]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        Хисоб карточкаси
        {enterpriseName && <span> - {enterpriseName}</span>}
      </div>
      <div className={styles.filters}>
        <div className={styles.filterItem}>
          <span>Счет:</span>
          <select
            className={styles.select}
            value={selectedSchet}
            onChange={(e) => setSelectedSchet(e.target.value)}
          >
            {Object.entries(SCHET_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {key} — {label}
              </option>
            ))}
          </select>
        </div>
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

      {!loading && !error && (
        <div className={styles.tableWrapper} data-report-scroll>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.colIndex} />
              <col className={styles.colDate} />
              <col className={styles.colDt} />
              <col className={styles.colKt} />
              <col className={styles.colObject} />
              <col className={styles.colIzoh} />
              <col className={styles.colDebit} />
              <col className={styles.colCredit} />
            </colgroup>
            <thead>
              <tr>
                <th>№</th>
                <th>Сана</th>
                <th>Дт</th>
                <th>Кт</th>
                <th>Объект</th>
                <th className={styles.izohCell}>Изох</th>
                <th className={styles.numberCell}>Дебет</th>
                <th className={styles.numberCell}>Кредит</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((entry: any, index: number) => {
                const isKirim = entry.debet === selectedSchet;
                const isChikim = entry.kredit === selectedSchet;

                const kirim = isKirim ? Number(entry.total) || 0 : 0;
                const chikim = isChikim ? Number(entry.total) || 0 : 0;

                const dateStr = entry.date
                  ? dateNumberToString(Number(entry.date))
                  : '';

                return (
                  <tr key={entry.id || index}>
                    <td>{index + 1}</td>
                    <td>{dateStr}</td>
                    <td>{entry.debet}</td>
                    <td>{entry.kredit}</td>
                    <td>
                      {getObjectNameForEntry(entry, selectedSchet, references)}
                    </td>
                    <td className={styles.izohCell}>
                      {buildIzohForAccountOperation(entry, references)}
                    </td>
                    <td className={styles.numberCell}>
                      {kirim ? numberValue(kirim) : ''}
                    </td>
                    <td className={styles.numberCell}>
                      {chikim ? numberValue(chikim) : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className={styles.totalLabel}>
                  Жами
                </td>
                <td className={styles.numberCell}>{numberValue(totals.kirim)}</td>
                <td className={styles.numberCell}>{numberValue(totals.chikim)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

