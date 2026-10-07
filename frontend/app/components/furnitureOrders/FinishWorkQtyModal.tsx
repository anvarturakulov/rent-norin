'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OrderWork } from '@/app/interfaces/furnitureOrder.interface';
import { formatWorksNumberDisplay } from '@/app/components/furnitureOrders/furnitureOrderCard/workTableCells';
import {
    getWorkPlannedCount,
    isWorkQtyMatchingPlan,
    parseWorkQtyInput,
} from '@/app/components/furnitureOrders/productionWorkBoard/workExecutionHelpers';
import styles from './FinishWorkQtyModal.module.css';

interface Props {
    work: OrderWork;
    busy: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export default function FinishWorkQtyModal({ work, busy, onConfirm, onClose }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [qty, setQty] = useState('');
    const [error, setError] = useState('');
    const plannedCount = getWorkPlannedCount(work);
    const hasPlannedCount = plannedCount != null;
    const unitLabel = work.unit?.trim() || 'дона';
    const plannedCountDisplay =
        plannedCount != null ? formatWorksNumberDisplay(String(plannedCount), 3) : '';

    useEffect(() => {
        const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [busy, onClose]);

    if (typeof document === 'undefined') return null;

    const parsed = parseWorkQtyInput(qty);
    const qtyInvalid = qty.trim() !== '' && parsed == null;

    const handleSubmit = () => {
        if (!hasPlannedCount) return;
        if (!isWorkQtyMatchingPlan(qty, work.countInOrder)) {
            setError('Режа миқдори нотўғри. Карточкадаги миқдорни текширинг ва қайта киритинг.');
            return;
        }
        setError('');
        onConfirm();
    };

    return createPortal(
        <div className={styles.overlay} onClick={busy ? undefined : onClose} role="presentation">
            <div
                className={styles.dialog}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="finish-work-qty-title"
            >
                <div className={styles.header}>
                    <div className={styles.headerMain}>
                        <div className={styles.badge}>Тасдиқлаш</div>
                        <h3 id="finish-work-qty-title" className={styles.title}>
                            Ишни якунлаш
                        </h3>
                    </div>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Yopish"
                    >
                        ×
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.workCard}>
                        <div className={styles.workName}>{work.workName}</div>
                        <div className={styles.workMeta}>
                            {work.lineIndex != null && <>Иш #{work.lineIndex}</>}
                            {work.lineIndex != null && unitLabel && ' · '}
                            {unitLabel}
                        </div>
                    </div>

                    {!hasPlannedCount ? (
                        <p className={styles.warning}>Режа миқдори киритилмаган. Администраторга мурожаат қилинг.</p>
                    ) : (
                        <>
                            <div className={styles.plannedSection}>
                                <div className={styles.plannedLabel}>Режадаги миқдор</div>
                                <div className={styles.plannedValue}>
                                    {plannedCountDisplay}
                                    <span className={styles.plannedUnit}>{unitLabel}</span>
                                </div>
                            </div>

                            <div className={styles.qtySection}>
                                <label className={styles.qtyLabel} htmlFor="finish-work-qty-input">
                                    Тасдиқлаш учун миқдор
                                </label>
                                <div className={styles.qtyRow}>
                                    <input
                                        ref={inputRef}
                                        id="finish-work-qty-input"
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        className={styles.qtyInput}
                                        placeholder="0"
                                        value={qty}
                                        onChange={(e) => {
                                            setQty(e.target.value.replace(/\s/g, '').replace(',', '.'));
                                            if (error) setError('');
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSubmit();
                                        }}
                                        disabled={busy}
                                    />
                                    <div className={styles.qtyUnit}>{unitLabel}</div>
                                </div>
                            </div>

                            <p className={styles.hint}>
                                Масалан, режада <strong>{plannedCountDisplay}</strong> бўлса —{' '}
                                <strong>{Math.round(plannedCount!)}</strong> деб киритишингиз мумкин.
                            </p>
                        </>
                    )}

                    {(error || qtyInvalid) && (
                        <p className={styles.error}>
                            {error || 'Миқдорни тўғри киритинг'}
                        </p>
                    )}
                </div>

                <div className={styles.footer}>
                    <button
                        type="button"
                        className={styles.btnCancel}
                        onClick={onClose}
                        disabled={busy}
                    >
                        Бекор
                    </button>
                    <button
                        type="button"
                        className={styles.btnConfirm}
                        onClick={handleSubmit}
                        disabled={busy || !hasPlannedCount || qty.trim() === '' || qtyInvalid}
                    >
                        {busy ? 'Кутинг…' : 'Якунлаш'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
