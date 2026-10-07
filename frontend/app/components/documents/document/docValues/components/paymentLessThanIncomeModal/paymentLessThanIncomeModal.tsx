'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './paymentLessThanIncomeModal.module.css';

interface PaymentLessThanIncomeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PaymentLessThanIncomeModal({
  open,
  onClose,
}: PaymentLessThanIncomeModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (typeof document === 'undefined' || !open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-less-than-income-title"
      >
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.badge}>Диққат</div>
            <h3 id="payment-less-than-income-title" className={styles.title}>
              Тулов суммаси начислениедан кам
            </h3>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Ёпиш"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.instruction}>
            Хужжатни ўтказиш учун тўловлар суммаси начислениедан кам бўлмаслиги керак:
          </p>
          <ul className={styles.optionsList}>
            <li>Накд + Пластик + (Курс × USD) + Насияга</li>
            <li>≥ Итог (қайтариш/сотиш + доставка + брак)</li>
          </ul>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnConfirm} onClick={onClose}>
            Тушундим
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
