'use client';

import { useMemo, useState } from 'react';
import { ClientsContractsWorkProps } from './clientsContractsWork.props';
import styles from './clientsContractsWork.module.css';
import contractStyles from '../contractFulfillment/contractFulfillment.module.css';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { numberValue } from '@/app/service/common/converters';
import { formatDisplayDateOrDash } from '@/app/utils/formatDisplayDate';
import { useAppContext } from '@/app/context/app.context';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';
import {
  ContractFulfillmentDetails,
  ContractRow,
  contractStatusClass,
  contractStatusLabel,
  fulfillmentClass,
  fulfillmentLabel,
} from '../contractFulfillment/contractDetails';

type ClientRow = {
  clientId: number;
  clientName: string;
  startBalance: number;
  debitTurnover: number;
  creditTurnover: number;
  endBalance: number;
  contracts: ContractRow[];
  linesDone: number;
  linesTotal: number;
};

type Summary = {
  clientsTotal: number;
  withContract: number;
  withoutContract: number;
  withStartDebt: number;
  startBalanceTotal: number;
  withEndDebt: number;
  endBalanceTotal: number;
  debitTurnoverTotal: number;
  creditTurnoverTotal: number;
  contractsTotal: number;
  linesDone: number;
  linesTotal: number;
};

type ReportValues = {
  summary: Summary;
  clients: ClientRow[];
};

type ClientFilter =
  | 'all'
  | 'withContract'
  | 'withoutContract'
  | 'startDebt'
  | 'endDebt'
  | 'turnover';

const EPS = 0.0001;

const emptySummary = (): Summary => ({
  clientsTotal: 0,
  withContract: 0,
  withoutContract: 0,
  withStartDebt: 0,
  startBalanceTotal: 0,
  withEndDebt: 0,
  endBalanceTotal: 0,
  debitTurnoverTotal: 0,
  creditTurnoverTotal: 0,
  contractsTotal: 0,
  linesDone: 0,
  linesTotal: 0,
});

function isNonZero(value: number | undefined): boolean {
  return Math.abs(Number(value) || 0) > EPS;
}

export const ClientsContractsWork = ({
  className,
  data,
  ...props
}: ClientsContractsWorkProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const token = mainData.users.user?.token;
  const contentName = mainData.document.contentName;
  const enterpriseName = useEnterpriseName();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const [expandedContracts, setExpandedContracts] = useState<Set<number>>(
    new Set(),
  );

  const values: ReportValues = useMemo(() => {
    const block = Array.isArray(data)
      ? data.find((item: any) => item?.reportType === 'ClientsContractsWork')
      : null;
    const raw = block?.values;
    if (!raw || typeof raw !== 'object') {
      return { summary: emptySummary(), clients: [] };
    }
    return {
      summary: { ...emptySummary(), ...(raw.summary ?? {}) },
      clients: Array.isArray(raw.clients) ? raw.clients : [],
    };
  }, [data]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return values.clients.filter((row) => {
      if (filter === 'withContract' && !(row.contracts?.length > 0)) return false;
      if (filter === 'withoutContract' && row.contracts?.length > 0) return false;
      if (filter === 'startDebt' && !isNonZero(row.startBalance)) return false;
      if (filter === 'endDebt' && !isNonZero(row.endBalance)) return false;
      if (
        filter === 'turnover' &&
        !isNonZero(row.debitTurnover) &&
        !isNonZero(row.creditTurnover)
      ) {
        return false;
      }
      if (!q) return true;
      return String(row.clientName ?? '').toLowerCase().includes(q);
    });
  }, [values.clients, query, filter]);

  const openDocument = (docId: number) => {
    if (!docId) return;
    getDocument(docId, setMainData, token, mainData, contentName);
  };

  const toggleClient = (id: number) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleContract = (id: number) => {
    setExpandedContracts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedClients(new Set(filteredClients.map((row) => row.clientId)));
    setExpandedContracts(
      new Set(
        filteredClients.flatMap((row) =>
          (row.contracts ?? []).map((c) => c.contractId),
        ),
      ),
    );
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
    setExpandedContracts(new Set());
  };

  const filterBtn = (id: ClientFilter, label: string) => (
    <button
      key={id}
      type="button"
      className={`${styles.filterBtn} ${filter === id ? styles.filterBtnActive : ''}`}
      onClick={() => setFilter(id)}
    >
      {label}
    </button>
  );

  return (
    <div className={className} {...props}>
      <div className={styles.title}>
        Мижозлар ва шартномалар
        {enterpriseName ? ` — ${enterpriseName}` : ''}
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Жами мижоз</div>
          <div className={styles.summaryValue}>{values.summary.clientsTotal}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Шартномаси бор</div>
          <div className={styles.summaryValue}>{values.summary.withContract}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Шартномаси йўқ</div>
          <div className={styles.summaryValue}>{values.summary.withoutContract}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Қарз бошида</div>
          <div className={styles.summaryValue}>
            {numberValue(values.summary.startBalanceTotal)}
          </div>
          <div className={styles.summaryHint}>
            {values.summary.withStartDebt} мижоз
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Қарз охирида</div>
          <div className={styles.summaryValue}>
            {numberValue(values.summary.endBalanceTotal)}
          </div>
          <div className={styles.summaryHint}>
            {values.summary.withEndDebt} мижоз
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Оборот</div>
          <div className={styles.summaryValue}>
            {numberValue(values.summary.debitTurnoverTotal)}
          </div>
          <div className={styles.summaryHint}>
            кредит {numberValue(values.summary.creditTurnoverTotal)}
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Мижоз бўйича қидириш"
        />
        <button type="button" className={styles.filterBtn} onClick={expandAll}>
          Очиш ҳаммаси
        </button>
        <button type="button" className={styles.filterBtn} onClick={collapseAll}>
          Ёпиш ҳаммаси
        </button>
      </div>

      <div className={styles.filters}>
        {filterBtn('all', 'Барчаси')}
        {filterBtn('withContract', 'Шартномаси бор')}
        {filterBtn('withoutContract', 'Шартномаси йўқ')}
        {filterBtn('startDebt', 'Қарз бошида')}
        {filterBtn('endDebt', 'Қарз охирида')}
        {filterBtn('turnover', 'Обороти бор')}
      </div>

      {filteredClients.length === 0 ? (
        <div className={styles.empty}>
          {values.clients.length === 0
            ? 'Давр бўйича мижозлар йўқ'
            : 'Танланган фильтр бўйича мижозлар йўқ'}
        </div>
      ) : (
        <div className={styles.list} data-report-scroll>
          {filteredClients.map((client) => {
            const expanded = expandedClients.has(client.clientId);
            return (
              <div key={client.clientId} className={styles.card}>
                <button
                  type="button"
                  className={styles.clientHeader}
                  onClick={() => toggleClient(client.clientId)}
                >
                  <span className={styles.toggle}>{expanded ? '▾' : '▸'}</span>
                  <span className={styles.clientName}>
                    {client.clientName || `#${client.clientId}`}
                  </span>
                  <span className={styles.money}>
                    <span className={styles.moneyLabel}>Бошланғич</span>
                    {numberValue(client.startBalance)}
                  </span>
                  <span className={styles.money}>
                    <span className={styles.moneyLabel}>Дебет</span>
                    {numberValue(client.debitTurnover)}
                  </span>
                  <span className={styles.money}>
                    <span className={styles.moneyLabel}>Кредит</span>
                    {numberValue(client.creditTurnover)}
                  </span>
                  <span className={styles.money}>
                    <span className={styles.moneyLabel}>Охирги</span>
                    {numberValue(client.endBalance)}
                  </span>
                  <span className={`${styles.badge} ${contractStyles.badge} ${
                    client.contracts.length
                      ? contractStyles.statusApproved
                      : contractStyles.statusDraft
                  }`}>
                    {client.contracts.length
                      ? `${client.contracts.length} шартнома`
                      : 'Шартнома йўқ'}
                  </span>
                  <span className={styles.amount}>
                    {client.linesTotal
                      ? `${client.linesDone}/${client.linesTotal}`
                      : '—'}
                  </span>
                </button>

                <div
                  className={`${styles.details} ${expanded ? '' : styles.detailsHidden}`}
                >
                  {client.contracts?.length ? (
                    client.contracts.map((row) => {
                      const contractOpen = expandedContracts.has(row.contractId);
                      return (
                        <div key={row.contractId}>
                          <button
                            type="button"
                            className={styles.contractHead}
                            onClick={() => toggleContract(row.contractId)}
                          >
                            <span className={styles.toggle}>
                              {contractOpen ? '▾' : '▸'}
                            </span>
                            <span className={styles.number}>
                              {row.contractNumber || `#${row.contractId}`}
                            </span>
                            <span className={styles.date}>
                              {formatDisplayDateOrDash(row.contractDate)}
                            </span>
                            <span
                              className={`${styles.badge} ${contractStyles.badge} ${contractStatusClass(row.status)}`}
                            >
                              {contractStatusLabel(row.status)}
                            </span>
                            <span
                              className={`${styles.badge} ${contractStyles.badge} ${fulfillmentClass(row.fulfillment.state)}`}
                            >
                              {fulfillmentLabel(row.fulfillment.state)}{' '}
                              {row.fulfillment.total
                                ? `${row.fulfillment.done}/${row.fulfillment.total}`
                                : ''}
                            </span>
                            <span className={styles.amount}>
                              {numberValue(row.amountFulfilled)} /{' '}
                              {numberValue(row.amountTotal)}
                            </span>
                          </button>
                          <div
                            className={`${styles.nested} ${
                              contractOpen ? '' : styles.detailsHidden
                            }`}
                          >
                            <ContractFulfillmentDetails
                              row={row}
                              onOpenDocument={openDocument}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={styles.emptyNested}>Шартномалар йўқ</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
