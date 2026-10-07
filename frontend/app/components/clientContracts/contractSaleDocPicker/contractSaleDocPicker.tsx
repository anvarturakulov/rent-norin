'use client';

import { useEffect, useState } from 'react';
import styles from '../contractOrderPickerModal/contractOrderPickerModal.module.css';
import { clientContractsApi } from '@/app/service/clientContracts/clientContracts.service';
import { DocSTATUS } from '@/app/interfaces/document.interface';
import type { ContractSaleCandidate } from '@/app/interfaces/clientContract.interface';

interface Props {
    open: boolean;
    token: string;
    contractId: number;
    lineType: 'item' | 'order';
    lineId: number;
    onClose: () => void;
    onPick: (docId: number) => void;
    onClear?: () => void;
}

export default function ContractSaleDocPicker({
    open,
    token,
    contractId,
    lineType,
    lineId,
    onClose,
    onPick,
    onClear,
}: Props) {
    const [rows, setRows] = useState<ContractSaleCandidate[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open || !contractId || !lineId) return;
        let cancelled = false;
        setRows(null);
        setError('');
        clientContractsApi
            .saleCandidates(token, contractId, lineType, lineId)
            .then((list) => {
                if (!cancelled) setRows(list);
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Юклашда хатолик');
                    setRows([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [open, token, contractId, lineType, lineId]);

    if (!open) return null;

    const formatDate = (ms: number) =>
        Number.isFinite(ms) ? new Date(ms).toLocaleDateString('ru-RU') : '—';

    const statusLabel = (status: string) => {
        if (status === DocSTATUS.PROVEDEN) return 'Ўтказилган';
        if (status === DocSTATUS.OPEN) return 'Очик';
        return status || '—';
    };

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.title}>Реализация ҳужжатини танланг</h3>
                <div className={styles.body}>
                    {error && <div className={styles.empty}>{error}</div>}
                    {rows == null && !error && <div className={styles.empty}>Юкланмоқда…</div>}
                    {rows && rows.length === 0 && !error && (
                        <div className={styles.empty}>Мос ҳужжатлар топилмади</div>
                    )}
                    {rows && rows.length > 0 && (
                        <>
                            <p className={styles.hint}>
                                Очик ҳужжатлар кўринади, шартномага фақат ўтказилганларни боғлаш
                                мумкин
                            </p>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Сана</th>
                                        <th>Статус</th>
                                        <th>Изоҳ</th>
                                        <th>Жами</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => {
                                        const canPick = row.docStatus === DocSTATUS.PROVEDEN;
                                        return (
                                            <tr
                                                key={row.id}
                                                className={
                                                    canPick ? styles.tr : styles.trDisabled
                                                }
                                                onClick={() => {
                                                    if (canPick) onPick(row.id);
                                                }}
                                                title={
                                                    canPick
                                                        ? undefined
                                                        : 'Фақат ўтказилган ҳужжатни танлаш мумкин'
                                                }
                                            >
                                                <td>
                                                    <strong>#{row.id}</strong>
                                                </td>
                                                <td>{formatDate(row.date)}</td>
                                                <td
                                                    className={
                                                        canPick
                                                            ? styles.statusProveden
                                                            : styles.statusOpen
                                                    }
                                                >
                                                    {statusLabel(row.docStatus)}
                                                </td>
                                                <td>{row.comment || '—'}</td>
                                                <td>
                                                    {row.total
                                                        ? `${row.total.toLocaleString('ru-RU')} сўм`
                                                        : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
                <div className={styles.footer}>
                    {onClear && (
                        <button type="button" className={styles.btn} onClick={onClear}>
                            Боғланишни олиб ташлаш
                        </button>
                    )}
                    <span className={styles.footerEnd}>
                        <button type="button" className={styles.btn} onClick={onClose}>
                            Ёпиш
                        </button>
                    </span>
                </div>
            </div>
        </div>
    );
}
