'use client';

import type { ReactNode } from 'react';
import styles from './contractFulfillment.module.css';
import { numberValue } from '@/app/service/common/converters';
import { formatDisplayDateOrDash } from '@/app/utils/formatDisplayDate';
import {
  ClientContractItemKind,
  ClientContractStatus,
  displayContractStatus,
  itemKindLabel,
  normalizeContractStatus,
} from '@/app/interfaces/clientContract.interface';
import {
  OrderStageType,
  STAGE_BG,
  STAGE_LABELS,
} from '@/app/interfaces/furnitureOrder.interface';

export type FulfillmentState = 'FULFILLED' | 'IN_PROGRESS' | 'NOT_STARTED' | 'EMPTY';

export type SaleDocInfo = {
  id: number;
  date: number | null;
  documentType: string | null;
  docStatus: string | null;
};

export type OrderLineInfo = {
  lineId: number;
  furnitureOrderId: number;
  orderNumber: string;
  productName: string;
  count: number;
  price: number;
  total: number;
  orderPrice: number;
  currentStage: string | null;
  saleDoc: SaleDocInfo | null;
  fulfilled: boolean;
};

export type ItemLineInfo = {
  lineId: number;
  lineKind: string;
  analiticName: string;
  count: number;
  price: number;
  total: number;
  saleDoc: SaleDocInfo | null;
  fulfilled: boolean;
};

export type ContractRow = {
  contractId: number;
  contractNumber: string;
  contractDate: number;
  status: string;
  clientId?: number;
  clientName: string;
  fulfillment: {
    done: number;
    total: number;
    state: FulfillmentState;
  };
  amountTotal: number;
  amountFulfilled: number;
  orderLines: OrderLineInfo[];
  itemLines: ItemLineInfo[];
  serviceLines: ItemLineInfo[];
};

export function contractStatusLabel(status: string): string {
  return displayContractStatus(
    normalizeContractStatus(status as ClientContractStatus),
  );
}

export function contractStatusClass(status: string): string {
  switch (normalizeContractStatus(status as ClientContractStatus)) {
    case ClientContractStatus.APPROVED:
      return styles.statusApproved;
    case ClientContractStatus.COMPLETED:
      return styles.statusCompleted;
    default:
      return styles.statusDraft;
  }
}

export function fulfillmentLabel(state: FulfillmentState): string {
  switch (state) {
    case 'FULFILLED':
      return 'Бажарилган';
    case 'IN_PROGRESS':
      return 'Жараёнда';
    case 'NOT_STARTED':
      return 'Бошланмаган';
    default:
      return 'Қаторлар йўқ';
  }
}

export function fulfillmentClass(state: FulfillmentState): string {
  switch (state) {
    case 'FULFILLED':
      return styles.stateFulfilled;
    case 'IN_PROGRESS':
      return styles.stateInProgress;
    case 'NOT_STARTED':
      return styles.stateNotStarted;
    default:
      return styles.stateEmpty;
  }
}

function stageLabel(stage: string | null | undefined): string {
  if (!stage) return '—';
  return STAGE_LABELS[stage as OrderStageType] || stage;
}

function docStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'OPEN':
      return 'Очиқ';
    case 'PENDING':
      return 'Кутилмоқда';
    case 'PROVEDEN':
      return 'Ўтказилган';
    case 'REJECTED':
      return 'Рад этилган';
    case 'DELETED':
      return 'Ўчирилган';
    default:
      return status || '';
  }
}

function saleDocTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'SaleTovar':
      return 'Товар сотуви';
    case 'SaleMaterial':
      return 'Материал сотуви';
    case 'SaleProd':
      return 'Маҳсулот сотуви';
    case 'SaleHalfStuff':
      return 'ЯТМ сотуви';
    case 'ServicesToClients':
      return 'Хизмат';
    default:
      return type || '';
  }
}

function lineKindText(kind: string): string {
  if (Object.values(ClientContractItemKind).includes(kind as ClientContractItemKind)) {
    return itemKindLabel(kind as ClientContractItemKind);
  }
  return kind || '—';
}

export function SaleDocCell({
  saleDoc,
  onOpen,
}: {
  saleDoc: SaleDocInfo | null;
  onOpen: (id: number) => void;
}) {
  if (!saleDoc?.id) {
    return <span className={styles.dash}>—</span>;
  }
  const type = saleDocTypeLabel(saleDoc.documentType);
  const status = docStatusLabel(saleDoc.docStatus);
  const date = formatDisplayDateOrDash(saleDoc.date);
  return (
    <button
      type="button"
      data-report-doc-anchor={saleDoc.id}
      className={styles.docLink}
      onClick={() => onOpen(saleDoc.id)}
      title="Ҳужжатни очиш"
    >
      {`№${saleDoc.id} · ${date}`}
      {type ? `\n${type}` : ''}
      {status ? `\n${status}` : ''}
    </button>
  );
}

function LineTable({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <table className={styles.table}>
      <colgroup>
        <col style={{ width: '12%' }} />
        <col style={{ width: '28%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '18%' }} />
        <col style={{ width: '10%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>Тури</th>
          <th>Номенклатура</th>
          <th>Сон</th>
          <th>Нарх</th>
          <th>Сумма</th>
          <th>Реализация</th>
          <th>Ижро</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function ItemTable({
  rows,
  onOpen,
}: {
  rows: ItemLineInfo[];
  onOpen: (id: number) => void;
}) {
  return (
    <LineTable>
      {rows.map((line) => (
        <tr key={line.lineId}>
          <td>{lineKindText(line.lineKind)}</td>
          <td>{line.analiticName || '—'}</td>
          <td className={styles.num}>{numberValue(line.count)}</td>
          <td className={styles.num}>{numberValue(line.price)}</td>
          <td className={styles.num}>{numberValue(line.total)}</td>
          <td>
            <SaleDocCell saleDoc={line.saleDoc} onOpen={onOpen} />
          </td>
          <td className={styles.center}>
            <span className={line.fulfilled ? styles.doneYes : styles.doneNo}>
              {line.fulfilled ? 'Ҳа' : 'Йўқ'}
            </span>
          </td>
        </tr>
      ))}
    </LineTable>
  );
}

export function ContractFulfillmentDetails({
  row,
  onOpenDocument,
}: {
  row: ContractRow;
  onOpenDocument: (id: number) => void;
}) {
  return (
    <>
      <div className={styles.blockTitle}>Буюртмалар</div>
      {row.orderLines?.length ? (
        <LineTable>
          {row.orderLines.map((line) => (
            <tr key={line.lineId}>
              <td>{line.orderNumber || line.furnitureOrderId}</td>
              <td>
                <div className={styles.productCell}>
                  <span>{line.productName || '—'}</span>
                  {line.currentStage ? (
                    <span
                      className={styles.stageBadge}
                      style={{
                        background:
                          STAGE_BG[line.currentStage as OrderStageType] ??
                          '#9e9e9e',
                      }}
                    >
                      {stageLabel(line.currentStage)}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className={styles.num}>{numberValue(line.count)}</td>
              <td className={styles.num}>
                {numberValue(line.price ?? line.orderPrice)}
              </td>
              <td className={styles.num}>
                {numberValue(
                  line.total ??
                    (Number(line.count) || 0) *
                      (Number(line.price ?? line.orderPrice) || 0),
                )}
              </td>
              <td>
                <SaleDocCell saleDoc={line.saleDoc} onOpen={onOpenDocument} />
              </td>
              <td className={styles.center}>
                <span className={line.fulfilled ? styles.doneYes : styles.doneNo}>
                  {line.fulfilled ? 'Ҳа' : 'Йўқ'}
                </span>
              </td>
            </tr>
          ))}
        </LineTable>
      ) : (
        <div className={styles.emptyBlock}>Буюртмалар йўқ</div>
      )}

      <div className={styles.blockTitle}>ТМЦ</div>
      {row.itemLines?.length ? (
        <ItemTable rows={row.itemLines} onOpen={onOpenDocument} />
      ) : (
        <div className={styles.emptyBlock}>ТМЦ қаторлари йўқ</div>
      )}

      <div className={styles.blockTitle}>Хизматлар</div>
      {row.serviceLines?.length ? (
        <ItemTable rows={row.serviceLines} onOpen={onOpenDocument} />
      ) : (
        <div className={styles.emptyBlock}>Хизмат қаторлари йўқ</div>
      )}
    </>
  );
}
