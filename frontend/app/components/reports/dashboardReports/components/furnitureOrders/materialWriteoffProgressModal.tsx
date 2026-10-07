'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/app/context/app.context';
import type { WriteoffProgressLine } from '@/app/interfaces/furnitureOrder.interface';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { numberValue } from '@/app/service/common/converters';
import styles from './materialWriteoffProgressModal.module.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orderId: number | null;
  orderLabel: string;
  productName: string;
};

const formatQty = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  return String(Number(value.toFixed(3)));
};

const formatMoney = (value: number | undefined) => {
  if (value == null || !Number.isFinite(value) || value === 0) {
    // show 0 as formatted zero when written off exists handled by caller
    if (value === 0) return numberValue(0);
    return '—';
  }
  return numberValue(value);
};

export function MaterialWriteoffProgressModal({
  isOpen,
  onClose,
  orderId,
  orderLabel,
  productName,
}: Props) {
  const { mainData } = useAppContext();
  const token = mainData.users.user?.token;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<WriteoffProgressLine[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || orderId == null || !token) {
      setProgress([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProgress([]);

    foApi
      .getStoreWork(token, orderId, undefined, { lite: true })
      .then((data) => {
        if (cancelled) return;
        setProgress(data.materialWriteoffProgress ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Ошибка загрузки списания материалов',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, orderId, token]);

  const totals = useMemo(() => {
    let planned = 0;
    let writtenOff = 0;
    let remaining = 0;
    let writtenOffTotal = 0;
    for (const row of progress) {
      planned += Number(row.planned || 0);
      writtenOff += Number(row.writtenOff || 0);
      remaining += Number(row.remaining || 0);
      writtenOffTotal += Number(row.writtenOffTotal || 0);
    }
    return {
      planned: Math.round(planned * 1000) / 1000,
      writtenOff: Math.round(writtenOff * 1000) / 1000,
      remaining: Math.round(remaining * 1000) / 1000,
      writtenOffTotal: Number(writtenOffTotal.toFixed(2)),
    };
  }, [progress]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <div>
            <h3 className={styles.title}>Хом ашё чикими — режа / факт</h3>
            <p className={styles.subtitle}>
              {orderLabel}
              {productName ? ` · ${productName}` : ''}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.loading}>Юкланмоқда...</div>}
          {!loading && error && <div className={styles.error}>{error}</div>}
          {!loading && !error && progress.length === 0 && (
            <div className={styles.empty}>Маълумот йўқ</div>
          )}
          {!loading && !error && progress.length > 0 && (
            <div className={styles.progressTable}>
              <div className={styles.progressHead}>
                <span>Хом ашё</span>
                <span>Ед.</span>
                <span>Режа</span>
                <span>Чиким килинган</span>
                <span>Колдик</span>
                <span>Нарх</span>
                <span>Сумма</span>
              </div>
              {progress.map((row) => {
                const id = Number(row.materialId ?? row.halfstuffId);
                const isExtra = Number(row.planned || 0) <= 0.001;
                return (
                  <div
                    key={id || `${row.name}-${row.planned}-${row.writtenOff}`}
                    className={styles.progressRow}
                  >
                    <span className={styles.materialName}>
                      {row.name || (id ? `#${id}` : '—')}
                      {isExtra && (
                        <span className={styles.addedBadge}>қўшилган</span>
                      )}
                    </span>
                    <span>{row.unit || '—'}</span>
                    <span>{formatQty(row.planned)}</span>
                    <span>{formatQty(row.writtenOff)}</span>
                    <span>{formatQty(row.remaining)}</span>
                    <span>
                      {Number(row.writtenOff || 0) > 0
                        ? formatMoney(row.writtenOffPrice)
                        : '—'}
                    </span>
                    <span>
                      {Number(row.writtenOff || 0) > 0
                        ? formatMoney(row.writtenOffTotal)
                        : '—'}
                    </span>
                  </div>
                );
              })}
              <div className={`${styles.progressRow} ${styles.totalsRow}`}>
                <span className={styles.materialName}>Жами</span>
                <span />
                <span>{formatQty(totals.planned)}</span>
                <span>{formatQty(totals.writtenOff)}</span>
                <span>{formatQty(totals.remaining)}</span>
                <span>—</span>
                <span>{formatMoney(totals.writtenOffTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
