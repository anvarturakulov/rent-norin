'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './contractsJournal.module.css';
import { useAppContext } from '@/app/context/app.context';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getTodayRange } from '@/app/service/common/dateRanges';
import { getDateRangeText } from '@/app/components/common/header/helpers/headerTextHelpers';
import DateIco from '@/app/components/common/header/date.svg';
import {
    ClientContractStatus,
    contractOrderLineAmount,
    displayContractStatus,
    normalizeContractStatus,
    type ClientContract,
} from '@/app/interfaces/clientContract.interface';
import ClientContractForm from '../clientContractForm/clientContractForm';
import { Doc } from '@/app/components/documents/document/doc/doc';

export default function ContractsJournal() {
    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users;
    const { dateStart, dateEnd } = mainData.journal.interval;
    const showDocumentWindow = mainData.document.showDocumentWindow;
    const keepHostPageOnClose = mainData.document.keepHostPageOnClose;
    const token = user?.token;
    const enterpriseId = user?.enterpriseId;

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    const { dateStartForUrl, dateEndForUrl } = useMemo(() => {
        let start = dateStart;
        let end = dateEnd;
        if (!start && !end) {
            const today = getTodayRange();
            start = today.start;
            end = today.end;
        }
        return { dateStartForUrl: start, dateEndForUrl: end };
    }, [dateStart, dateEnd]);

    const url = useMemo(() => {
        if (!token || enterpriseId == null) return null;
        const params = new URLSearchParams();
        params.set('enterpriseId', String(enterpriseId));
        if (dateStartForUrl != null) params.set('dateStart', String(dateStartForUrl));
        if (dateEndForUrl != null) params.set('dateEnd', String(dateEndForUrl));
        return `${process.env.NEXT_PUBLIC_DOMAIN}/api/client-contracts?${params.toString()}`;
    }, [token, enterpriseId, dateStartForUrl, dateEndForUrl]);

    const { data, mutate, error } = useSWR(url, (u) => getDataForSwr(u, token));

    const handleIntervalClick = useCallback(() => {
        setMainData?.('showIntervalWindow', true);
    }, [setMainData]);

    const formatDate = (ms?: number | string) => {
        if (ms == null || ms === '') return '—';
        const num = typeof ms === 'string' ? Number(ms) : ms;
        if (!Number.isFinite(num)) return '—';
        return new Date(num).toLocaleDateString('ru-RU');
    };

    const contractStatus = (c: ClientContract): ClientContractStatus =>
        c.status ?? ClientContractStatus.DRAFT;

    const statusLabel = (s: ClientContractStatus): string => displayContractStatus(s);

    const statusBadgeClass = (s: ClientContractStatus): string => {
        const base = styles.statusBadge;
        switch (normalizeContractStatus(s)) {
            case ClientContractStatus.DRAFT:
                return `${base} ${styles.statusDraft}`;
            case ClientContractStatus.APPROVED:
                return `${base} ${styles.statusApproved}`;
            case ClientContractStatus.COMPLETED:
                return `${base} ${styles.statusCompleted}`;
            default:
                return `${base} ${styles.statusDraft}`;
        }
    };

    const totals = (c: ClientContract) => {
        const ol = c.orderLines ?? [];
        const il = c.itemLines ?? [];
        const sumPrice = ol.reduce((s, l) => s + contractOrderLineAmount(l), 0);
        const sumItems = il.reduce((s, l) => s + (Number(l.total) || 0), 0);
        const grand = sumPrice + sumItems;
        const totalLines = ol.length + il.length;
        const done =
            ol.filter((l) => l.saleDocId).length +
            il.filter((l) => l.saleDocId).length;
        return { sumPrice, sumItems, grand, n: ol.length, done, totalLines };
    };

    const openNew = () => {
        setEditId(null);
        setShowForm(true);
    };

    const openEdit = (c: ClientContract) => {
        setEditId(c.id);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditId(null);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Мижозлар билан шартномалар</h2>
                <button type="button" className={styles.addButton} onClick={openNew}>
                    + Янги шартнома
                </button>
            </div>

            <div className={styles.intervalBar}>
                <div className={styles.intervalText}>
                    {getDateRangeText(dateStartForUrl, dateEndForUrl) || 'Оралиқ сана танланмаган'}
                </div>
                <div className={styles.intervalActions}>
                    <button
                        type="button"
                        className={styles.intervalBtn}
                        onClick={handleIntervalClick}
                        title="Оралиқ санани ўзгартириш"
                    >
                        <DateIco className={styles.intervalIco} />
                        <span>Интервал</span>
                    </button>
                </div>
            </div>

            {enterpriseId == null && token && (
                <div className={styles.error}>
                    Шартномалар учун профилда корхона танланган бўлиши керак.
                </div>
            )}
            {error && (
                <div className={styles.error}>Юклашда хатолик: {error.message}</div>
            )}
            {!data && !error && enterpriseId != null && (
                <div className={styles.loading}>Юкланмоқда…</div>
            )}
            {data && (data as ClientContract[]).length === 0 && (
                <div className={styles.empty}>Шартномалар топилмади</div>
            )}

            {data && (data as ClientContract[]).length > 0 && (
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th>Шартнома №</th>
                            <th>Мижоз</th>
                            <th>Сана</th>
                            <th>Статус</th>
                            <th>Буюртмалар</th>
                            <th>Буюртма суммаси</th>
                            <th>ТМЦ / хизмат</th>
                            <th>Ижро</th>
                            <th>Жами</th>
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {(data as ClientContract[]).map((c) => {
                            const t = totals(c);
                            const st = contractStatus(c);
                            return (
                                <tr
                                    key={c.id}
                                    className={styles.trRow}
                                    onClick={() => openEdit(c)}
                                >
                                    <td>
                                        <strong>{c.contractNumber}</strong>
                                    </td>
                                    <td>{c.client?.name ?? `ID ${c.clientId}`}</td>
                                    <td>{formatDate(c.contractDate)}</td>
                                    <td>
                                        <span className={statusBadgeClass(st)}>
                                            {statusLabel(st)}
                                        </span>
                                    </td>
                                    <td>{t.n}</td>
                                    <td>{t.sumPrice.toLocaleString('ru-RU')} сўм</td>
                                    <td>{t.sumItems.toLocaleString('ru-RU')} сўм</td>
                                    <td>
                                        {t.done}/{t.totalLines}
                                    </td>
                                    <td>{t.grand.toLocaleString('ru-RU')} сўм</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {showDocumentWindow && keepHostPageOnClose && (
                <div className={styles.docOverlay}>
                    <Doc />
                </div>
            )}

            {showForm && token && enterpriseId != null && (
                <div
                    className={styles.overlay}
                    onClick={(e) => e.target === e.currentTarget && closeForm()}
                >
                    <ClientContractForm
                        key={editId ?? 'new'}
                        token={token}
                        enterpriseId={Number(enterpriseId)}
                        contractId={editId}
                        onClose={closeForm}
                        onSaved={() => {
                            closeForm();
                            mutate();
                        }}
                        onDeleted={() => {
                            closeForm();
                            mutate();
                        }}
                    />
                </div>
            )}
        </div>
    );
}
