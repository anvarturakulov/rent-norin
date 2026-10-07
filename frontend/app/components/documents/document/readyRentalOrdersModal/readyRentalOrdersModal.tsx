'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './readyRentalOrdersModal.module.css';
import {
  ReadyRentalOrdersPayload,
  buildReadyRentalOrdersSummary,
} from '@/app/service/documents/rentalOrders';

interface ReadyRentalOrdersModalProps {
  open: boolean;
  payload?: ReadyRentalOrdersPayload | null;
  onOk: () => void;
}

export default function ReadyRentalOrdersModal({
  open,
  payload,
  onOk,
}: ReadyRentalOrdersModalProps) {
  const okRef = useRef<HTMLButtonElement>(null);
  const orders = payload?.orders || [];
  const visible = open && orders.length > 0;
  const summary = buildReadyRentalOrdersSummary(payload);

  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    okRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ready-rental-orders-title"
      >
        <div className={styles.header}>
          <div className={styles.badge}>Буюртма</div>
          <h3 id="ready-rental-orders-title" className={styles.title}>
            {summary.title}
          </h3>
          <p className={styles.note}>{summary.note}</p>
          {!payload?.enoughForAll && orders.length > 1 && (
            <div className={styles.warn}>
              Қолдиқ ҳаммасига етмайди — битта буюртмани танлаб ёпинг.
            </div>
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Мижоз</th>
                  <th>Ускуна</th>
                  <th className={styles.qtyCol}>Миқдор</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const lines = order.lines?.length
                    ? order.lines
                    : [{ toolId: 0, toolName: '—', qty: 0 }];
                  return lines.map((line, index) => (
                    <tr key={`${order.id}-${line.toolId}-${index}`}>
                      {index === 0 && (
                        <>
                          <td rowSpan={lines.length} className={styles.orderCell}>
                            {order.id}
                          </td>
                          <td rowSpan={lines.length} className={styles.clientCell}>
                            {order.clientName}
                          </td>
                        </>
                      )}
                      <td>{line.toolName}</td>
                      <td className={styles.qtyCol}>
                        {line.qty ? line.qty : '—'}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.footer}>
          <button
            ref={okRef}
            type="button"
            className={styles.okBtn}
            onClick={onOk}
          >
            ОК
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
