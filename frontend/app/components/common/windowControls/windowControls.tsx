'use client';

import styles from './windowControls.module.css';
import { IconClose, IconMinimize } from './icons';

interface WindowControlsProps {
  onMinimize?: () => void;
  onClose: () => void;
  className?: string;
  disabled?: boolean;
}

export function WindowControls({ onMinimize, onClose, className, disabled }: WindowControlsProps) {
  return (
    <div className={`${styles.controls} ${className ?? ''}`}>
      {onMinimize && (
        <button
          type="button"
          className={`${styles.btn} ${styles.minimizeBtn}`}
          onClick={onMinimize}
          disabled={disabled}
          title="Свернуть"
          aria-label="Свернуть"
        >
          <IconMinimize />
        </button>
      )}
      <button
        type="button"
        className={`${styles.btn} ${styles.closeBtn}`}
        onClick={onClose}
        disabled={disabled}
        title="Закрыть"
        aria-label="Закрыть"
      >
        <IconClose />
      </button>
    </div>
  );
}
