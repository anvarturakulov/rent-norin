'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './rentalContractsJournal.module.css';
import { useAppContext } from '@/app/context/app.context';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { getTodayRange } from '@/app/service/common/dateRanges';
import { getDateRangeText } from '@/app/components/common/header/helpers/headerTextHelpers';
import DateIco from '@/app/components/common/header/date.svg';
import {
    RentalContractStatus,
    type RentalContract,
} from '@/app/interfaces/rentalContract.interface';
import RentalContractForm from '../rentalContractForm/rentalContractForm';
import { filterRowsByColumns } from '@/app/components/common/tableColumnFilter/filterRowsByColumns';
import type { ColumnFilterGetters, ColumnFilterState } from '@/app/components/common/tableColumnFilter/tableColumnFilter.types';
import {
    DEFAULT_TABLE_PAGE_SIZE,
    TablePagination,
} from '@/app/components/common/tablePagination/TablePagination';
import { matchTmzNameSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';

type ContractColumnKey =
    | 'contractNumber'
    | 'client'
    | 'contractDate'
    | 'endDate'
    | 'status'
    | 'comment';

const DEFAULT_COLUMN_FILTERS: ColumnFilterState<ContractColumnKey> = {
    contractNumber: '',
    client: '',
    contractDate: '',
    endDate: '',
    status: '',
    comment: '',
};

const FILTER_COLUMNS: { key: ContractColumnKey; placeholder: string; width?: number }[] = [
    { key: 'contractNumber', placeholder: '№', width: 120 },
    { key: 'client', placeholder: '+(комбинация), -(ёки), !(йук)' },
    { key: 'contractDate', placeholder: 'Бошланиш', width: 110 },
    { key: 'endDate', placeholder: 'Тугаш', width: 110 },
    { key: 'status', placeholder: 'Статус', width: 130 },
    { key: 'comment', placeholder: 'Изоҳ' },
];

const formatDate = (ms?: number | string | null) => {
    if (ms == null || ms === '') return '—';
    const num = typeof ms === 'string' ? Number(ms) : ms;
    if (!Number.isFinite(num)) return '—';
    return new Date(num).toLocaleDateString('ru-RU');
};

const statusLabel = (s: RentalContractStatus): string => {
    switch (s) {
        case RentalContractStatus.DRAFT:
            return 'Қоралама';
        case RentalContractStatus.APPROVED:
            return 'Тасдиқланган';
        case RentalContractStatus.COMPLETED:
            return 'Якунланган';
        case RentalContractStatus.CANCELLED:
            return 'Бекор қилинган';
        default:
            return s;
    }
};

const statusBadgeClass = (s: RentalContractStatus): string => {
    const base = styles.statusBadge;
    switch (s) {
        case RentalContractStatus.DRAFT:
            return `${base} ${styles.statusDraft}`;
        case RentalContractStatus.APPROVED:
            return `${base} ${styles.statusApproved}`;
        case RentalContractStatus.COMPLETED:
            return `${base} ${styles.statusCompleted}`;
        case RentalContractStatus.CANCELLED:
            return `${base} ${styles.statusCancelled}`;
        default:
            return `${base} ${styles.statusDraft}`;
    }
};

export default function RentalContractsJournal() {
    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users;
    const { dateStart, dateEnd } = mainData.journal.interval;
    const token = user?.token;
    const enterpriseId = user?.enterpriseId;

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [columnFilters, setColumnFilters] = useState<ColumnFilterState<ContractColumnKey>>(
        DEFAULT_COLUMN_FILTERS,
    );
    const [showColumnFilters, setShowColumnFilters] = useState(false);
    const [tablePage, setTablePage] = useState(1);

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
        return `${process.env.NEXT_PUBLIC_DOMAIN}/api/rental-contracts?${params.toString()}`;
    }, [token, enterpriseId, dateStartForUrl, dateEndForUrl]);

    const { data, mutate, error } = useSWR(url, (u) => getDataForSwr(u, token));

    const contracts = useMemo(
        () => (Array.isArray(data) ? (data as RentalContract[]) : []),
        [data],
    );

    const columnGetters = useMemo<ColumnFilterGetters<RentalContract, ContractColumnKey>>(
        () => ({
            contractNumber: (c) => c.contractNumber ?? '',
            client: (c) => c.client?.name ?? `ID ${c.clientId}`,
            contractDate: (c) => formatDate(c.contractDate),
            endDate: (c) => formatDate(c.endDate),
            status: (c) => statusLabel(c.status ?? RentalContractStatus.DRAFT),
            comment: (c) => c.comment ?? '—',
        }),
        [],
    );

    const filteredContracts = useMemo(
        () =>
            filterRowsByColumns(contracts, columnFilters, columnGetters, {
                matchers: {
                    client: (value, query) => matchTmzNameSearch({ name: value }, query),
                },
            }),
        [contracts, columnFilters, columnGetters],
    );

    const hasActiveColumnFilters = useMemo(
        () => Object.values(columnFilters).some((v) => v.trim() !== ''),
        [columnFilters],
    );

    const filteredContractsLength = filteredContracts.length;
    const totalPages = Math.max(1, Math.ceil(filteredContractsLength / DEFAULT_TABLE_PAGE_SIZE));

    const paginatedContracts = useMemo(() => {
        if (filteredContractsLength === 0) return [];
        const start = (tablePage - 1) * DEFAULT_TABLE_PAGE_SIZE;
        return filteredContracts.slice(start, start + DEFAULT_TABLE_PAGE_SIZE);
    }, [filteredContracts, filteredContractsLength, tablePage]);

    const columnFiltersKey = useMemo(() => JSON.stringify(columnFilters), [columnFilters]);

    useEffect(() => {
        setTablePage(1);
    }, [dateStartForUrl, dateEndForUrl, columnFiltersKey]);

    useEffect(() => {
        if (tablePage > totalPages) {
            setTablePage(totalPages);
        }
    }, [tablePage, totalPages]);

    const handleIntervalClick = useCallback(() => {
        setMainData?.('showIntervalWindow', true);
    }, [setMainData]);

    const updateColumnFilter = useCallback((key: ContractColumnKey, value: string) => {
        setColumnFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clearColumnFilters = useCallback(() => {
        setColumnFilters(DEFAULT_COLUMN_FILTERS);
    }, []);

    const toggleColumnFilters = useCallback(() => {
        setShowColumnFilters((prev) => !prev);
    }, []);

    const openNew = () => {
        setEditId(null);
        setShowForm(true);
    };

    const openEdit = (c: RentalContract) => {
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
                <h2>Ижара шартномалари</h2>
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
            {data && contracts.length === 0 && (
                <div className={styles.empty}>Шартномалар топилмади</div>
            )}

            {data && contracts.length > 0 && (
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr
                                className={`${styles.headerRow} ${showColumnFilters || hasActiveColumnFilters ? styles.headerRowFiltersOn : ''}`}
                                onDoubleClick={toggleColumnFilters}
                                title="Фильтр учун шапкани икки марта босинг"
                            >
                                <th style={{ width: 120 }}>Шартнома №</th>
                                <th>Мижоз</th>
                                <th style={{ width: 110 }}>Бошланиш</th>
                                <th style={{ width: 110 }}>Тугаш</th>
                                <th style={{ width: 130 }}>Статус</th>
                                <th>Изоҳ</th>
                            </tr>
                            {showColumnFilters && (
                                <tr className={styles.filterRow}>
                                    {FILTER_COLUMNS.map((col, index) => (
                                        <th
                                            key={col.key}
                                            style={col.width ? { width: col.width } : undefined}
                                        >
                                            {index === 0 ? (
                                                <div className={styles.filterCellWithClear}>
                                                    <input
                                                        type="text"
                                                        className={`${styles.filterInput} ${columnFilters[col.key].trim() ? styles.filterInputActive : ''}`}
                                                        placeholder={col.placeholder}
                                                        value={columnFilters[col.key]}
                                                        onChange={(e) =>
                                                            updateColumnFilter(col.key, e.target.value)
                                                        }
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    {hasActiveColumnFilters && (
                                                        <button
                                                            type="button"
                                                            className={styles.clearFiltersBtn}
                                                            title="Фильтрни тозалаш"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                clearColumnFilters();
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    className={`${styles.filterInput} ${columnFilters[col.key].trim() ? styles.filterInputActive : ''}`}
                                                    placeholder={col.placeholder}
                                                    value={columnFilters[col.key]}
                                                    onChange={(e) =>
                                                        updateColumnFilter(col.key, e.target.value)
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            )}
                        </thead>
                        <tbody className={styles.tbody}>
                            {filteredContractsLength === 0 ? (
                                <tr>
                                    <td colSpan={6} className={styles.emptyRow}>
                                        Фильтр бўйича натижа йўқ
                                    </td>
                                </tr>
                            ) : (
                                paginatedContracts.map((c) => {
                                    const st = c.status ?? RentalContractStatus.DRAFT;
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
                                            <td>{formatDate(c.endDate)}</td>
                                            <td>
                                                <span className={statusBadgeClass(st)}>
                                                    {statusLabel(st)}
                                                </span>
                                            </td>
                                            <td>{c.comment || '—'}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    <TablePagination
                        page={tablePage}
                        pageSize={DEFAULT_TABLE_PAGE_SIZE}
                        totalItems={filteredContractsLength}
                        onPageChange={setTablePage}
                    />
                </div>
            )}

            {showForm && token && enterpriseId != null && (
                <div className={styles.overlay}>
                    <RentalContractForm
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
