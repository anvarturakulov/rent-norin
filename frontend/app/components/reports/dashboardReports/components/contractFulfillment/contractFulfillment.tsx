'use client';

import { useMemo, useState } from 'react';
import { ContractFulfillmentProps } from './contractFulfillment.props';
import styles from './contractFulfillment.module.css';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { numberValue } from '@/app/service/common/converters';
import { formatDisplayDateOrDash } from '@/app/utils/formatDisplayDate';
import { ClientContractStatus, normalizeContractStatus } from '@/app/interfaces/clientContract.interface';
import { useAppContext } from '@/app/context/app.context';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';
import {
  ContractFulfillmentDetails,
  ContractRow,
  FulfillmentState,
  contractStatusClass,
  contractStatusLabel,
  fulfillmentClass,
  fulfillmentLabel,
} from './contractDetails';

type Summary = {
  contractsTotal: number;
  fullyFulfilled: number;
  inProgress: number;
  notStarted: number;
  empty: number;
  linesTotal: number;
  linesDone: number;
  amountTotal: number;
  amountFulfilled: number;
};

type ReportValues = {
  summary: Summary;
  contracts: ContractRow[];
};

const emptySummary = (): Summary => ({
  contractsTotal: 0,
  fullyFulfilled: 0,
  inProgress: 0,
  notStarted: 0,
  empty: 0,
  linesTotal: 0,
  linesDone: 0,
  amountTotal: 0,
  amountFulfilled: 0,
});

const CONTRACT_STATUS_OPTIONS: ClientContractStatus[] = [
  ClientContractStatus.DRAFT,
  ClientContractStatus.APPROVED,
  ClientContractStatus.COMPLETED,
];

const FULFILLMENT_OPTIONS: FulfillmentState[] = [
  'FULFILLED',
  'IN_PROGRESS',
  'NOT_STARTED',
  'EMPTY',
];

export const ContractFulfillment = ({
  className,
  data,
  ...props
}: ContractFulfillmentProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const token = mainData.users.user?.token;
  const contentName = mainData.document.contentName;
  const enterpriseName = useEnterpriseName();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientContractStatus | null>(null);
  const [stateFilter, setStateFilter] = useState<FulfillmentState | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const values: ReportValues = useMemo(() => {
    const block = Array.isArray(data)
      ? data.find((item: any) => item?.reportType === 'ContractFulfillment')
      : null;
    const raw = block?.values;
    if (!raw || typeof raw !== 'object') {
      return { summary: emptySummary(), contracts: [] };
    }
    return {
      summary: { ...emptySummary(), ...(raw.summary ?? {}) },
      contracts: Array.isArray(raw.contracts) ? raw.contracts : [],
    };
  }, [data]);

  const filteredContracts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return values.contracts.filter((row) => {
      if (
        statusFilter &&
        normalizeContractStatus(row.status as ClientContractStatus) !== statusFilter
      ) {
        return false;
      }
      if (stateFilter && row.fulfillment?.state !== stateFilter) return false;
      if (!q) return true;
      const number = String(row.contractNumber ?? '').toLowerCase();
      const client = String(row.clientName ?? '').toLowerCase();
      return number.includes(q) || client.includes(q);
    });
  }, [values.contracts, query, statusFilter, stateFilter]);

  const openDocument = (docId: number) => {
    if (!docId) return;
    getDocument(docId, setMainData, token, mainData, contentName);
  };

  const toggleContract = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () =>
    setExpandedIds(new Set(filteredContracts.map((row) => row.contractId)));
  const collapseAll = () => setExpandedIds(new Set());

  return (
    <div className={className} {...props}>
      <div className={styles.title}>
        Шартномалар ижроси
        {enterpriseName ? ` — ${enterpriseName}` : ''}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Жами шартнома</div>
          <div className={styles.summaryValue}>{values.summary.contractsTotal}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Бажарилган</div>
          <div className={styles.summaryValue}>{values.summary.fullyFulfilled}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Жараёнда</div>
          <div className={styles.summaryValue}>{values.summary.inProgress}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Бошланмаган</div>
          <div className={styles.summaryValue}>{values.summary.notStarted}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Қаторлар</div>
          <div className={styles.summaryValue}>
            {values.summary.linesDone}/{values.summary.linesTotal}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Сумма / ижро</div>
          <div className={styles.summaryValue}>
            {numberValue(values.summary.amountFulfilled)}
          </div>
          <div className={styles.summaryHint}>
            жами {numberValue(values.summary.amountTotal)}
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Рақам ёки мижоз бўйича қидириш"
        />
        <button type="button" className={styles.filterBtn} onClick={expandAll}>
          Очиш ҳаммаси
        </button>
        <button type="button" className={styles.filterBtn} onClick={collapseAll}>
          Ёпиш ҳаммаси
        </button>
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterBtn} ${statusFilter == null ? styles.filterBtnActive : ''}`}
          onClick={() => setStatusFilter(null)}
        >
          Барча статус
        </button>
        {CONTRACT_STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            className={`${styles.filterBtn} ${
              statusFilter === status ? styles.filterBtnActive : ''
            }`}
            onClick={() => setStatusFilter(status)}
          >
            {contractStatusLabel(status)}
          </button>
        ))}
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterBtn} ${stateFilter == null ? styles.filterBtnActive : ''}`}
          onClick={() => setStateFilter(null)}
        >
          Барча ижро
        </button>
        {FULFILLMENT_OPTIONS.map((state) => (
          <button
            key={state}
            type="button"
            className={`${styles.filterBtn} ${
              stateFilter === state ? styles.filterBtnActive : ''
            }`}
            onClick={() => setStateFilter(state)}
          >
            {fulfillmentLabel(state)}
          </button>
        ))}
      </div>

      {filteredContracts.length === 0 ? (
        <div className={styles.empty}>
          {values.contracts.length === 0
            ? 'Давр бўйича шартномалар йўқ'
            : 'Танланган фильтр бўйича шартномалар йўқ'}
        </div>
      ) : (
        <div className={styles.list} data-report-scroll>
          {filteredContracts.map((row) => {
            const expanded = expandedIds.has(row.contractId);
            return (
              <div key={row.contractId} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardHeader}
                  onClick={() => toggleContract(row.contractId)}
                >
                  <span className={styles.toggle}>{expanded ? '▾' : '▸'}</span>
                  <span className={styles.number}>
                    {row.contractNumber || `#${row.contractId}`}
                  </span>
                  <span className={styles.date}>
                    {formatDisplayDateOrDash(row.contractDate)}
                  </span>
                  <span className={styles.client}>{row.clientName || '—'}</span>
                  <span className={`${styles.badge} ${contractStatusClass(row.status)}`}>
                    {contractStatusLabel(row.status)}
                  </span>
                  <span className={`${styles.badge} ${fulfillmentClass(row.fulfillment.state)}`}>
                    {fulfillmentLabel(row.fulfillment.state)}{' '}
                    {row.fulfillment.total
                      ? `${row.fulfillment.done}/${row.fulfillment.total}`
                      : ''}
                  </span>
                  <span className={styles.amount}>
                    {numberValue(row.amountFulfilled)} / {numberValue(row.amountTotal)}
                  </span>
                </button>

                <div
                  className={`${styles.details} ${expanded ? '' : styles.detailsHidden}`}
                >
                  <ContractFulfillmentDetails
                    row={row}
                    onOpenDocument={openDocument}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
