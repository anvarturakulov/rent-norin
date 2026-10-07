'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './individualClientWarningModal.module.css';

interface IndividualClientWarningModalProps {
  partnerName: string;
  errors: string[];
  onClose: () => void;
}

export default function IndividualClientWarningModal({
  partnerName,
  errors,
  onClose,
}: IndividualClientWarningModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined' || errors.length === 0) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="individual-client-warning-title"
      >
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.badge}>Диққат</div>
            <h3 id="individual-client-warning-title" className={styles.title}>
              Мижоз маълумотлари тўлиқ эмас
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
          {partnerName ? (
            <p className={styles.partnerName}>{partnerName}</p>
          ) : null}
          <p className={styles.instruction}>
            Қуйидаги маълумотларни тўлдиринг:
          </p>
          <ul className={styles.errorList}>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
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
