'use client';

import { useMemo, useState } from 'react';
import { RentalUnfulfilledOrdersProps } from './rentalUnfulfilledOrders.props';
import styles from './rentalUnfulfilledOrders.module.css';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { numberValue } from '@/app/service/common/converters';
import {
  formatDisplayDateOrDash,
  formatDisplayDateTime,
} from '@/app/utils/formatDisplayDate';
import { useAppContext } from '@/app/context/app.context';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';

type OrderStatus = 'ready' | 'missingStock' | 'transferDraft';
type StatusFilter = 'all' | OrderStatus;

type OrderLine = {
  toolId: number;
  toolName: string;
  qty: number;
  remain: number;
  missing: number;
};

type OrderRow = {
  id: number;
  date: number;
  daysWaiting: number;
  warehouseId: number;
  warehouseName: string;
  rentTariffType: string;
  comment: string | null;
  status: OrderStatus;
  canFulfillAlone: boolean;
  transferDraftDocId: number | null;
  transferDraftStatus: string | null;
  qtyTotal: number;
  lines: OrderLine[];
};

type ClientRow = {
  clientId: number;
  clientName: string;
  ordersCount: number;
  readyCount: number;
  waitingCount: number;
  transferDraftCount: number;
  qtyTotal: number;
  orders: OrderRow[];
};

type ShortageRow = {
  warehouseId: number;
  warehouseName: string;
  toolId: number;
  toolName: string;
  need: number;
  remain: number;
  missing: number;
};

type Summary = {
  clientsTotal: number;
  ordersTotal: number;
  readyCount: number;
  waitingCount: number;
  transferDraftCount: number;
  qtyTotal: number;
  oldestWaitDays: number;
  enoughForAll: boolean;
};

type ReportValues = {
  asOf: number;
  summary: Summary;
  clients: ClientRow[];
  shortages: ShortageRow[];
};

const emptySummary = (): Summary => ({
  clientsTotal: 0,
  ordersTotal: 0,
  readyCount: 0,
  waitingCount: 0,
  transferDraftCount: 0,
  qtyTotal: 0,
  oldestWaitDays: 0,
  enoughForAll: true,
});

const tariffLabel = (value?: string) =>
  value === 'TRANSFER' ? 'Перечисление' : 'Нақд';

const statusLabel = (status: OrderStatus) => {
  if (status === 'ready') return 'Тайёр';
  if (status === 'transferDraft') return 'Топшириш яратилган';
  return 'Қолдиқ етмайди';
};

const statusClass = (status: OrderStatus) => {
  if (status === 'ready') return styles.statusReady;
  if (status === 'transferDraft') return styles.statusDraft;
  return styles.statusWaiting;
};

const matchesQuery = (client: ClientRow, query: string) => {
  if (!query) return true;
  if (String(client.clientName ?? '').toLowerCase().includes(query)) return true;
  return client.orders.some((order) => {
    if (String(order.id).includes(query)) return true;
    if (String(order.warehouseName ?? '').toLowerCase().includes(query)) {
      return true;
    }
    return order.lines.some((line) =>
      String(line.toolName ?? '').toLowerCase().includes(query),
    );
  });
};

const clientMatchesFilter = (client: ClientRow, filter: StatusFilter) => {
  if (filter === 'all') return true;
  return client.orders.some((order) => order.status === filter);
};

const visibleOrders = (client: ClientRow, filter: StatusFilter) => {
  if (filter === 'all') return client.orders;
  return client.orders.filter((order) => order.status === filter);
};

export const RentalUnfulfilledOrders = ({
  className,
  data,
  ...props
}: RentalUnfulfilledOrdersProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const token = mainData.users.user?.token;
  const contentName = mainData.document.contentName;
  const enterpriseName = useEnterpriseName();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expandedClients, setExpandedClients] = useState<Set<number>>(
    new Set(),
  );

  const values: ReportValues = useMemo(() => {
    const block = Array.isArray(data)
      ? data.find(
          (item: { reportType?: string }) =>
            item?.reportType === 'RentalUnfulfilledOrders',
        )
      : null;
    const raw = block?.values;
    if (!raw || typeof raw !== 'object') {
      return { asOf: 0, summary: emptySummary(), clients: [], shortages: [] };
    }
    return {
      asOf: Number(raw.asOf) || 0,
      summary: { ...emptySummary(), ...(raw.summary ?? {}) },
      clients: Array.isArray(raw.clients) ? raw.clients : [],
      shortages: Array.isArray(raw.shortages) ? raw.shortages : [],
    };
  }, [data]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return values.clients.filter(
      (client) => clientMatchesFilter(client, filter) && matchesQuery(client, q),
    );
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

  const expandAll = () => {
    setExpandedClients(new Set(filteredClients.map((row) => row.clientId)));
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
  };

  const filterBtn = (id: StatusFilter, label: string) => (
    <button
      key={id}
      type="button"
      className={`${styles.filterBtn} ${filter === id ? styles.filterBtnActive : ''}`}
      onClick={() => setFilter(id)}
    >
      {label}
    </button>
  );

  const hasLoaded = Array.isArray(data)
    ? data.some(
        (item: { reportType?: string }) =>
          item?.reportType === 'RentalUnfulfilledOrders',
      )
    : false;

  return (
    <div className={`${styles.container} ${className || ''}`} {...props}>
      <div className={styles.title}>
        Ижара — бажарилмаган буюртмалар
        {enterpriseName ? ` — ${enterpriseName}` : ''}
      </div>

      {values.asOf ? (
        <div className={styles.subtitle}>
          Қолдиқ вақти: {formatDisplayDateTime(values.asOf)} · ўтказилган
          буюртмалар, Топшириш ҳали йўқ
        </div>
      ) : (
        <div className={styles.subtitle}>
          Ўтказилган буюртмалар, Топшириш ҳали яратилмаган
        </div>
      )}

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Мижозлар</div>
          <div className={styles.summaryValue}>{values.summary.clientsTotal}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Буюртмалар</div>
          <div className={styles.summaryValue}>{values.summary.ordersTotal}</div>
        </div>
        <div
          className={`${styles.summaryCard} ${
            !values.summary.enoughForAll && values.summary.readyCount > 0
              ? styles.summaryWarn
              : ''
          }`}
        >
          <div className={styles.summaryLabel}>Тайёр</div>
          <div className={styles.summaryValue}>{values.summary.readyCount}</div>
          {!values.summary.enoughForAll && values.summary.readyCount > 0 ? (
            <div className={styles.summaryHint}>
              Биргаликда қолдиқ етмайди
            </div>
          ) : null}
        </div>
        <div
          className={`${styles.summaryCard} ${
            values.summary.waitingCount > 0 ? styles.summaryWarn : ''
          }`}
        >
          <div className={styles.summaryLabel}>Қолдиқ етмайди</div>
          <div className={styles.summaryValue}>{values.summary.waitingCount}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Топшириш яратилган</div>
          <div className={styles.summaryValue}>
            {values.summary.transferDraftCount}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Жами ускуна</div>
          <div className={styles.summaryValue}>
            {numberValue(values.summary.qtyTotal)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Энг эски кутиш</div>
          <div className={styles.summaryValue}>
            {values.summary.oldestWaitDays}
          </div>
          <div className={styles.summaryHint}>кун</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Мижоз, буюртма ёки ускуна бўйича қидириш"
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
        {filterBtn('ready', 'Тайёр')}
        {filterBtn('missingStock', 'Қолдиқ етмайди')}
        {filterBtn('transferDraft', 'Топшириш яратилган')}
      </div>

      {!hasLoaded ? null : filteredClients.length === 0 ? (
        <div className={styles.empty}>
          {values.clients.length === 0
            ? 'Бажарилмаган буюртмалар йўқ'
            : 'Танланган фильтр бўйича буюртмалар йўқ'}
        </div>
      ) : (
        <div className={styles.list} data-report-scroll>
          {filteredClients.map((client) => {
            const expanded = expandedClients.has(client.clientId);
            const orders = visibleOrders(client, filter);
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
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>Буюртма</span>
                    {client.ordersCount}
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>Тайёр</span>
                    {client.readyCount}
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>Кутилмоқда</span>
                    {client.waitingCount}
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>Ускуна</span>
                    {numberValue(client.qtyTotal)}
                  </span>
                </button>

                <div
                  className={`${styles.details} ${expanded ? '' : styles.detailsHidden}`}
                >
                  {orders.map((order) => (
                    <div key={order.id} className={styles.orderBlock}>
                      <div className={styles.orderHead}>
                        <button
                          type="button"
                          className={styles.docLink}
                          onClick={() => openDocument(order.id)}
                        >
                          № {order.id}
                        </button>
                        <span className={styles.meta}>
                          {formatDisplayDateOrDash(order.date)}
                        </span>
                        <span className={styles.meta}>
                          {order.daysWaiting} кун
                        </span>
                        <span className={styles.meta}>
                          {order.warehouseName || '—'}
                        </span>
                        <span className={styles.meta}>
                          {tariffLabel(order.rentTariffType)}
                        </span>
                        <span
                          className={`${styles.badge} ${statusClass(order.status)}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                        {order.transferDraftDocId ? (
                          <button
                            type="button"
                            className={styles.docLink}
                            onClick={() =>
                              openDocument(Number(order.transferDraftDocId))
                            }
                          >
                            Топшириш № {order.transferDraftDocId}
                          </button>
                        ) : null}
                        {order.comment ? (
                          <div className={styles.comment}>{order.comment}</div>
                        ) : null}
                      </div>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Ускуна</th>
                            <th>Заказ</th>
                            <th>S11 қолдиқ</th>
                            <th>Дефицит</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.lines || []).map((line, idx) => (
                            <tr key={`${order.id}-${line.toolId}-${idx}`}>
                              <td>{line.toolName}</td>
                              <td className={styles.numeric}>
                                {numberValue(line.qty)}
                              </td>
                              <td className={styles.numeric}>
                                {numberValue(line.remain)}
                              </td>
                              <td
                                className={`${styles.numeric} ${
                                  Number(line.missing) > 0
                                    ? styles.missingCell
                                    : ''
                                }`}
                              >
                                {Number(line.missing) > 0
                                  ? numberValue(line.missing)
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasLoaded && values.shortages.length > 0 ? (
        <>
          <div className={styles.sectionTitle}>Дефицит — омбор ва ускуна</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Омбор</th>
                <th>Ускуна</th>
                <th>Сўров</th>
                <th>Қолдиқ</th>
                <th>Дефицит</th>
              </tr>
            </thead>
            <tbody>
              {values.shortages.map((row) => (
                <tr key={`${row.warehouseId}-${row.toolId}`}>
                  <td>{row.warehouseName}</td>
                  <td>{row.toolName}</td>
                  <td className={styles.numeric}>{numberValue(row.need)}</td>
                  <td className={styles.numeric}>{numberValue(row.remain)}</td>
                  <td className={`${styles.numeric} ${styles.missingCell}`}>
                    {numberValue(row.missing)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
};
