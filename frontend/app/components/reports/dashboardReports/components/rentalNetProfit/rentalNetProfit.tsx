'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { RentalNetProfitProps } from './rentalNetProfit.props';
import styles from './rentalNetProfit.module.css';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import {
  RentalNetProfitNode,
  RentalNetProfitResponse,
} from '@/app/service/reports/getRentalNetProfit';
import { numberValue } from '@/app/service/common/converters';
import { EntryItem } from '@/app/interfaces/report.interface';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';
import { MatOborotEntriesModal } from '@/app/components/reports/simpleReports/reportTable/table/matOborot/matOborotItem/MatOborotEntriesModal';

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(1)}%`;
};

function collectLeafIds(node: RentalNetProfitNode): number[] {
  if (!node.isFolder || !node.children?.length) {
    return [node.id];
  }
  const ids: number[] = [];
  for (const ch of node.children) {
    ids.push(...collectLeafIds(ch));
  }
  return ids;
}

function mapEntryToItem(entry: any): EntryItem {
  return {
    date: Number(entry.date),
    docNumber: entry.docId ? Number(entry.docId) : 0,
    docId: entry.docId ? String(entry.docId) : '',
    documentType: entry.documentType,
    debet: entry.debet,
    debetFirstSubcontoId: entry.debetFirstSubcontoId
      ? String(entry.debetFirstSubcontoId)
      : '',
    debetFirstSubcontoName: entry.debetFirstSubcontoReference?.name || '',
    debetSecondSubcontoId: entry.debetSecondSubcontoId
      ? String(entry.debetSecondSubcontoId)
      : '',
    debetSecondSubcontoName: entry.debetSecondSubcontoReference?.name || '',
    kredit: entry.kredit,
    kreditFirstSubcontoId: entry.kreditFirstSubcontoId
      ? String(entry.kreditFirstSubcontoId)
      : '',
    kreditFirstSubcontoName: entry.kreditFirstSubcontoReference?.name || '',
    kreditSecondSubcontoId: entry.kreditSecondSubcontoId
      ? String(entry.kreditSecondSubcontoId)
      : '',
    kreditSecondSubcontoName: entry.kreditSecondSubcontoReference?.name || '',
    count: entry.count || 0,
    total: entry.total || 0,
    description: entry.description || '',
    fullDescription: entry.fullDescription || '',
  };
}

export const RentalNetProfit = ({
  className,
  data,
  ...props
}: RentalNetProfitProps): JSX.Element | null => {
  const { mainData, setMainData } = useAppContext();
  const { selectedEnterpriseId } = mainData.report;
  const { user } = mainData.users;
  const token = user?.token || '';
  const { dateStart, dateEnd } = mainData.journal.interval;
  const enterpriseName = useEnterpriseName();
  const references = mainData.reference?.allReferences;

  const reportData = useMemo((): RentalNetProfitResponse | null => {
    if (!data || !Array.isArray(data)) return null;
    const row = data.find(
      (item: any) =>
        item?.reportType === 'RENTAL_NET_PROFIT' ||
        item?.reportType === 'RentalNetProfit',
    );
    return row || null;
  }, [data]);

  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalEntries, setModalEntries] = useState<EntryItem[]>([]);

  useEffect(() => {
    if (reportData?.values?.length) {
      const topFolders = reportData.values
        .filter((n) => n.isFolder)
        .map((n) => n.id);
      setExpanded(new Set(topFolders));
    } else {
      setExpanded(new Set());
    }
  }, [reportData]);

  const openDetails = useCallback(
    async (
      node: RentalNetProfitNode,
      type: 'income' | 'cogs' | 'otherIncome93',
      amount: number,
    ) => {
      if (!amount || !dateStart || !dateEnd || !token) return;

      const tmzIds = collectLeafIds(node);
      const columnLabel =
        type === 'income'
          ? 'Даромад (90)'
          : type === 'otherIncome93'
            ? 'Бошка даромад (93)'
            : 'Себестоимость (91)';
      setModalTitle(`${node.name} — ${columnLabel}`);
      setModalOpen(true);
      setModalLoading(true);
      setModalEntries([]);

      try {
        const enterpriseId =
          typeof selectedEnterpriseId === 'object' &&
          selectedEnterpriseId !== null
            ? (selectedEnterpriseId as { id?: number }).id
            : selectedEnterpriseId;

        let url =
          `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/rentalNetProfit/entries?` +
          `type=${type}&startDate=${dateStart}&endDate=${dateEnd}&tmzIds=${tmzIds.join(',')}`;

        if (
          enterpriseId !== null &&
          enterpriseId !== undefined &&
          typeof enterpriseId === 'number'
        ) {
          url += `&enterpriseId=${enterpriseId}`;
        }

        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setModalEntries((response.data || []).map(mapEntryToItem));
      } catch (e) {
        console.error(e);
        setModalEntries([]);
      } finally {
        setModalLoading(false);
      }
    },
    [dateStart, dateEnd, token, selectedEnterpriseId],
  );

  const handleSelectDocument = useCallback(
    (docId: number) => {
      setModalOpen(false);
      void getDocument(
        docId,
        setMainData,
        user?.token,
        mainData,
        mainData.document.contentName,
      );
    },
    [setMainData, user?.token, mainData],
  );

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderRows = (
    nodes: RentalNetProfitNode[],
    depth: number,
  ): JSX.Element[] => {
    const rows: JSX.Element[] = [];
    for (const node of nodes) {
      const hasChildren = Boolean(node.children?.length);
      const isOpen = expanded.has(node.id);
      rows.push(
        <tr
          key={`${node.id}-${depth}`}
          className={node.isFolder ? styles.folderRow : undefined}
        >
          <td className={styles.nameCell}>
            <span
              className={styles.indent}
              style={{ width: depth * 16, display: 'inline-block' }}
            />
            {hasChildren ? (
              <button
                type="button"
                className={styles.expandBtn}
                onClick={() => toggle(node.id)}
                aria-label={isOpen ? 'collapse' : 'expand'}
              >
                {isOpen ? '−' : '+'}
              </button>
            ) : (
              <span
                className={styles.expandBtn}
                style={{ visibility: 'hidden' }}
              >
                +
              </span>
            )}
            {node.name}
          </td>
          <td className={styles.numeric}>
            {node.income ? (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => openDetails(node, 'income', node.income)}
              >
                {numberValue(node.income)}
              </button>
            ) : (
              numberValue(node.income)
            )}
          </td>
          <td className={styles.numeric}>
            {node.otherIncome93 ? (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() =>
                  openDetails(node, 'otherIncome93', node.otherIncome93)
                }
              >
                {numberValue(node.otherIncome93)}
              </button>
            ) : (
              numberValue(node.otherIncome93 ?? 0)
            )}
          </td>
          <td className={styles.numeric}>
            {node.cogs ? (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => openDetails(node, 'cogs', node.cogs)}
              >
                {numberValue(node.cogs)}
              </button>
            ) : (
              numberValue(node.cogs)
            )}
          </td>
          <td className={styles.numeric}>{numberValue(node.expense20)}</td>
          <td className={styles.numeric}>{numberValue(node.netProfit)}</td>
          <td className={styles.center}>{formatPercent(node.profitability)}</td>
        </tr>,
      );
      if (hasChildren && isOpen && node.children) {
        rows.push(...renderRows(node.children, depth + 1));
      }
    }
    return rows;
  };

  if (!reportData) {
    return null;
  }

  const totals = reportData.totals;
  const values = reportData.values || [];

  return (
    <div className={styles.container} {...props}>
      <div className={styles.title}>Ижара соф фойдаси — {enterpriseName}</div>
      <div className={styles.subtitle}>
        Даромад (90) + Бошка даромад (93) − Себестоимость (91) − Харажатлар (20
        фақат 91 сиз даромадларга)
      </div>

      {values.length === 0 && (
        <div className={styles.emptyMessage}>Маълумот йўқ</div>
      )}

      {values.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ТМЗ / папка</th>
              <th>Даромад (90)</th>
              <th>Бошка даромад (93)</th>
              <th>Себестоимость (91)</th>
              <th>Харажатлар (20)</th>
              <th>Соф фойда</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {renderRows(values, 0)}
            {totals && (
              <tr className={styles.totalsRow}>
                <td className={styles.nameCell}>Жами</td>
                <td className={styles.numeric}>{numberValue(totals.income)}</td>
                <td className={styles.numeric}>
                  {numberValue(totals.otherIncome93 ?? 0)}
                </td>
                <td className={styles.numeric}>{numberValue(totals.cogs)}</td>
                <td className={styles.numeric}>
                  {numberValue(totals.expense20)}
                </td>
                <td className={styles.numeric}>
                  {numberValue(totals.netProfit)}
                </td>
                <td className={styles.center}>
                  {formatPercent(totals.profitability)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <MatOborotEntriesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        loading={modalLoading}
        entries={modalEntries}
        references={references}
        onSelectDocument={handleSelectDocument}
      />
    </div>
  );
};
