'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import styles from './clientContractForm.module.css';
import catalogStyles from '../contractTmzCatalogPicker/contractTmzCatalogPicker.module.css';
import { clientContractsApi } from '@/app/service/clientContracts/clientContracts.service';
import {
    ClientContractItemKind,
    ClientContractStatus,
    TMC_ITEM_KINDS,
    contractOrderLineFromOrder,
    documentTypeForItemKind,
    formatContractSaleLabel,
    isContractLineFulfilled,
    itemKindLabel,
    qtyPriceFromFurnitureOrder,
    type ClientContract,
    type SaveClientContractPayload,
} from '@/app/interfaces/clientContract.interface';
import { TypeReference, type ReferenceModel } from '@/app/interfaces/reference.interface';
import { formatDateForInput, parseDateInputValue, formatDateForDisplay } from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import ContractOrderPickerModal from '../contractOrderPickerModal/contractOrderPickerModal';
import ContractClientSelect from '../contractClientSelect/contractClientSelect';
import ContractPrintDocument from '../contractPrintDocument/contractPrintDocument';
import CommercialProposalPrint from '../commercialProposalPrint/commercialProposalPrint';
import ContractSaleDocPicker from '../contractSaleDocPicker/contractSaleDocPicker';
import ContractTmzCatalogPicker, {
    resolveContractTmzCostPrice,
} from '../contractTmzCatalogPicker/contractTmzCatalogPicker';
import ContractServiceCatalogPicker from '../contractServiceCatalogPicker/contractServiceCatalogPicker';

type OrderRow = {
    key: string;
    id?: number;
    furnitureOrderId: number;
    count: number;
    orderPrice: number;
    amount: number;
    orderLabel?: string;
    productSummary?: string;
    saleDocId?: number | null;
    saleDocLabel?: string;
    saleDocStatus?: string;
};

type ItemRow = {
    key: string;
    id?: number;
    lineKind: ClientContractItemKind;
    analiticId: number;
    analiticName?: string;
    count: number;
    price: number;
    saleDocId?: number | null;
    saleDocLabel?: string;
    saleDocStatus?: string;
    /** undefined — ещё не запрашивали; null — нет себестоимости */
    costPrice?: number | null;
};

type SalePickerState = {
    lineType: 'item' | 'order';
    rowKey: string;
    lineId: number;
    analiticId?: number;
    lineKind?: ClientContractItemKind;
};

function newKey() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function contractDateToMs(isoDate: string): number {
    return parseDateInputValue(isoDate) ?? nowMs();
}

function formatMoney(value: number | string | null | undefined): string {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num === 0) return '';
    return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function parseMoney(input: string): number {
    if (!input) return 0;
    const cleaned = input.replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
    const firstDot = cleaned.indexOf('.');
    const normalized =
        firstDot === -1
            ? cleaned
            : cleaned.slice(0, firstDot + 1) +
              cleaned.slice(firstDot + 1).replace(/\./g, '');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
}

function isInsertLike(e: Pick<KeyboardEvent, 'code' | 'key' | 'keyCode'>): boolean {
    return (
        e.code === 'Insert' ||
        e.code === 'NumpadInsert' ||
        e.key === 'Insert' ||
        e.keyCode === 45
    );
}

function orderRowAmount(row: {
    amount?: number;
    count?: number;
    orderPrice?: number;
}): number {
    if (Number(row.amount) > 0) return Number(row.amount);
    return (Number(row.count) || 0) * (Number(row.orderPrice) || 0);
}

function emptyOrderRow(key: string): OrderRow {
    return { key, furnitureOrderId: 0, count: 1, orderPrice: 0, amount: 0 };
}

function formatCostUnderName(row: ItemRow): string {
    if (!row.analiticId) return 'Себестоимость: —';
    if (row.costPrice === undefined) return 'Себестоимость: …';
    if (row.costPrice != null && row.costPrice > 0) {
        return `Себестоимость: ${formatMoney(row.costPrice)}`;
    }
    return 'Себестоимость: —';
}

function mapOrderRows(c: ClientContract): OrderRow[] {
    return (c.orderLines ?? []).map((l) => {
        const live = contractOrderLineFromOrder(l);
        return {
            key: newKey(),
            id: l.id,
            furnitureOrderId: l.furnitureOrderId,
            count: live.count,
            orderPrice: live.orderPrice,
            amount: live.amount,
            orderLabel:
                l.furnitureOrder?.orderNumber ??
                (l.furnitureOrderId ? `#${l.furnitureOrderId}` : ''),
            productSummary: l.furnitureOrder?.analitic?.name ?? '',
            saleDocId: l.saleDocId ?? l.furnitureOrder?.saleDocId ?? null,
            saleDocLabel: formatContractSaleLabel(
                l.saleDoc,
                l.saleDocId ?? l.furnitureOrder?.saleDocId,
            ),
            saleDocStatus: l.saleDoc?.docStatus,
        };
    });
}

function mapItemRows(c: ClientContract): ItemRow[] {
    return (c.itemLines ?? []).map((l) => ({
        key: newKey(),
        id: l.id,
        lineKind: l.lineKind,
        analiticId: Number(l.analiticId) || 0,
        analiticName: l.analitic?.name ?? '',
        count: Number(l.count) || 0,
        price: Number(l.price) || 0,
        saleDocId: l.saleDocId ?? null,
        saleDocLabel: formatContractSaleLabel(l.saleDoc, l.saleDocId),
        saleDocStatus: l.saleDoc?.docStatus,
    }));
}

interface Props {
    token: string;
    enterpriseId: number;
    contractId: number | null;
    onClose: () => void;
    onSaved: () => void;
    onDeleted?: () => void;
}

export default function ClientContractForm({
    token,
    enterpriseId,
    contractId,
    onClose,
    onSaved,
    onDeleted,
}: Props) {
    const storagesUrl = token
        ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${TypeReference.STORAGES}?enterpriseId=${enterpriseId}`
        : null;
    const { data: storages, isLoading: storagesLoading } = useSWR(
        storagesUrl,
        (url: string) => getDataForSwr(url, token),
    );
    const mainWarehouseId = useMemo(() => {
        const list = (Array.isArray(storages) ? storages : []) as ReferenceModel[];
        const main = list.find((s) => s.refValues?.isMainWarehouse);
        const id = Number(main?.id || list[0]?.id || 0);
        return id > 0 ? id : undefined;
    }, [storages]);

    const [contractNumber, setContractNumber] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [contractDate, setContractDate] = useState(() =>
        formatDateForInput(nowMs()),
    );
    const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
    const [itemRows, setItemRows] = useState<ItemRow[]>([]);
    const [pickerRowKey, setPickerRowKey] = useState<string | null>(null);
    const [salePicker, setSalePicker] = useState<SalePickerState | null>(null);
    const [persistedId, setPersistedId] = useState<number | null>(contractId);
    const [loading, setLoading] = useState(!!contractId);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
    const [deleteConfirmError, setDeleteConfirmError] = useState('');
    const [deletingContract, setDeletingContract] = useState(false);
    const [previewNumber, setPreviewNumber] = useState('');
    const [status, setStatus] = useState<ClientContractStatus>(ClientContractStatus.DRAFT);

    const modalShellRef = useRef<HTMLDivElement>(null);
    const insertShortcutsRef = useRef({
        pickerRowKey: null as string | null,
        clientId: '',
        addOrderRowAndPick: () => {},
        addTmcRow: () => {},
    });

    const contractNumberRef = useRef<HTMLInputElement>(null);
    const contractClientSearchRef = useRef<HTMLInputElement>(null);
    const printContractRef = useRef<HTMLDivElement>(null);
    const printKpRef = useRef<HTMLDivElement>(null);
    const effectiveId = persistedId ?? contractId;
    const itemRowsRef = useRef(itemRows);
    itemRowsRef.current = itemRows;

    const applyContract = (c: ClientContract) => {
        setPersistedId(c.id);
        setContractNumber(c.contractNumber);
        setClientId(String(c.clientId));
        setClientName(c.client?.name ?? '');
        setContractDate(formatDateForInput(Number(c.contractDate)));
        setStatus(c.status ?? ClientContractStatus.DRAFT);
        setOrderRows(mapOrderRows(c));
        setItemRows(mapItemRows(c));
    };

    const handlePrintContract = useReactToPrint({
        contentRef: printContractRef,
        documentTitle: `Shartnoma-${contractNumber || 'new'}`,
        pageStyle: `
            @page { size: A4 portrait; margin: 12mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        `,
    });

    const handlePrintKp = useReactToPrint({
        contentRef: printKpRef,
        documentTitle: `Tijoriy-taklif-${contractNumber || 'new'}`,
        pageStyle: `
            @page { size: A4 portrait; margin: 12mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        `,
    });

    const loadContract = useCallback(async () => {
        if (!contractId) return;
        setLoading(true);
        setError('');
        try {
            const c = await clientContractsApi.getOne(token, contractId);
            applyContract(c);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Юклашда хатолик');
        } finally {
            setLoading(false);
        }
    }, [contractId, token]);

    useEffect(() => {
        if (contractId) void loadContract();
    }, [contractId, loadContract]);

    useEffect(() => {
        if (!loading) contractNumberRef.current?.focus();
    }, [loading]);

    const tmcRows = useMemo(
        () => itemRows.filter((r) => r.lineKind !== ClientContractItemKind.SERVICE),
        [itemRows],
    );
    const serviceRows = useMemo(
        () => itemRows.filter((r) => r.lineKind === ClientContractItemKind.SERVICE),
        [itemRows],
    );

    const pendingCostKeys = useMemo(
        () =>
            itemRows
                .filter(
                    (r) =>
                        r.lineKind !== ClientContractItemKind.SERVICE &&
                        r.analiticId > 0 &&
                        r.costPrice === undefined,
                )
                .map((r) => `${r.key}:${r.analiticId}:${r.lineKind}`)
                .join('|'),
        [itemRows],
    );

    useEffect(() => {
        if (!pendingCostKeys || storagesLoading) return;
        const pending = itemRowsRef.current.filter(
            (r) =>
                r.lineKind !== ClientContractItemKind.SERVICE &&
                r.analiticId > 0 &&
                r.costPrice === undefined,
        );
        if (!pending.length) return;
        let cancelled = false;
        const dateMs = contractDateToMs(contractDate);
        void Promise.all(
            pending.map(async (r) => {
                const cost = await resolveContractTmzCostPrice({
                    token,
                    enterpriseId,
                    warehouseId: mainWarehouseId,
                    analiticId: r.analiticId,
                    documentType: documentTypeForItemKind(r.lineKind),
                    dateMs,
                });
                if (cancelled) return;
                setItemRows((prev) =>
                    prev.map((x) =>
                        x.key === r.key && x.costPrice === undefined
                            ? { ...x, costPrice: cost }
                            : x,
                    ),
                );
            }),
        );
        return () => {
            cancelled = true;
        };
    }, [
        pendingCostKeys,
        storagesLoading,
        mainWarehouseId,
        token,
        enterpriseId,
        contractDate,
    ]);

    const sumOrderPrices = useMemo(
        () => orderRows.reduce((s, r) => s + orderRowAmount(r), 0),
        [orderRows],
    );
    const sumTmc = useMemo(
        () =>
            tmcRows.reduce(
                (s, r) => s + (Number(r.count) || 0) * (Number(r.price) || 0),
                0,
            ),
        [tmcRows],
    );
    const sumServices = useMemo(
        () =>
            serviceRows.reduce(
                (s, r) => s + (Number(r.count) || 0) * (Number(r.price) || 0),
                0,
            ),
        [serviceRows],
    );
    const grandTotal = sumOrderPrices + sumTmc + sumServices;

    const fulfilledCount = useMemo(() => {
        const orders = orderRows.filter(
            (r) => r.furnitureOrderId > 0,
        );
        const items = itemRows.filter((r) => r.analiticId > 0);
        const all = [...orders, ...items];
        const done = all.filter((r) =>
            isContractLineFulfilled(r.saleDocId, {
                id: Number(r.saleDocId || 0),
                docStatus: r.saleDocStatus,
            }),
        ).length;
        return { done, total: all.length };
    }, [orderRows, itemRows]);

    const printContractDateMs = useMemo(
        () => contractDateToMs(contractDate),
        [contractDate],
    );

    const printOrderLines = useMemo(
        () =>
            orderRows
                .filter((r) => r.furnitureOrderId > 0)
                .map((r, i) => ({
                    index: i + 1,
                    orderLabel: r.orderLabel || `#${r.furnitureOrderId}`,
                    count: Number(r.count) || 0,
                    orderPrice: Number(r.orderPrice) || 0,
                    additionalExpenses: 0,
                    lineTotal: orderRowAmount(r),
                })),
        [orderRows],
    );

    const printItemLines = useMemo(
        () =>
            itemRows
                .filter((r) => r.analiticId > 0)
                .map((r, i) => ({
                    index: i + 1,
                    kind: itemKindLabel(r.lineKind),
                    name: r.analiticName || `#${r.analiticId}`,
                    count: Number(r.count) || 0,
                    price: Number(r.price) || 0,
                    amount: (Number(r.count) || 0) * (Number(r.price) || 0),
                })),
        [itemRows],
    );

    const kpOrderLines = useMemo(
        () => [
            ...orderRows
                .filter((r) => r.furnitureOrderId > 0)
                .map((r, i) => ({
                    index: i + 1,
                    orderLabel: r.orderLabel || `#${r.furnitureOrderId}`,
                    productName: r.productSummary || '',
                    price: orderRowAmount(r),
                })),
            ...itemRows
                .filter((r) => r.analiticId > 0)
                .map((r, i) => ({
                    index: orderRows.filter((o) => o.furnitureOrderId > 0).length + i + 1,
                    orderLabel: itemKindLabel(r.lineKind),
                    productName: r.analiticName || `#${r.analiticId}`,
                    price: (Number(r.count) || 0) * (Number(r.price) || 0),
                })),
        ],
        [orderRows, itemRows],
    );

    const kpValidityNote = useMemo(() => {
        const d = formatDateForDisplay(contractDateToMs(contractDate));
        return `Бу тижорий таклиф ${d} санасидан бошлаб 10 та календар куни давомида амал қилади.`;
    }, [contractDate]);

    const addOrderRow = () => {
        setOrderRows((prev) => [...prev, emptyOrderRow(newKey())]);
    };

    const addOrderRowAndPick = () => {
        if (!clientId) {
            setError('Мижозни танланг');
            return;
        }
        setError('');
        const key = newKey();
        setOrderRows((prev) => [...prev, emptyOrderRow(key)]);
        setPickerRowKey(key);
    };

    const addTmcRow = () => {
        setItemRows((prev) => [
            ...prev,
            {
                key: newKey(),
                lineKind: ClientContractItemKind.TOVAR,
                analiticId: 0,
                count: 1,
                price: 0,
            },
        ]);
    };

    const addServiceRow = () => {
        setItemRows((prev) => [
            ...prev,
            {
                key: newKey(),
                lineKind: ClientContractItemKind.SERVICE,
                analiticId: 0,
                count: 1,
                price: 0,
            },
        ]);
    };

    insertShortcutsRef.current = {
        pickerRowKey,
        clientId,
        addOrderRowAndPick,
        addTmcRow,
    };

    const yearFromContractDate = useMemo(
        () => (contractDate ? Number(contractDate.slice(0, 4)) : new Date().getFullYear()),
        [contractDate],
    );

    useEffect(() => {
        if (effectiveId) {
            setPreviewNumber('');
            return;
        }
        let cancelled = false;
        clientContractsApi
            .previewNumber(token, enterpriseId, yearFromContractDate)
            .then((r) => {
                if (cancelled) return;
                setPreviewNumber(r.contractNumber);
                setContractNumber((current) =>
                    current.trim() ? current : r.contractNumber,
                );
            })
            .catch(() => {
                if (!cancelled) setPreviewNumber('');
            });
        return () => {
            cancelled = true;
        };
    }, [effectiveId, token, enterpriseId, yearFromContractDate]);

    useEffect(() => {
        if (loading) return;
        const shell = modalShellRef.current;
        if (!shell) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (!isInsertLike(e)) return;
            const t = e.target;
            if (!(t instanceof Node) || !shell.contains(t)) return;
            const { pickerRowKey: pk, clientId: cid, addOrderRowAndPick: pickRow, addTmcRow: addTmc } =
                insertShortcutsRef.current;
            if (pk != null && !!cid) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.altKey) addTmc();
            else pickRow();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [loading]);

    const buildPayload = (): SaveClientContractPayload | null => {
        setError('');
        if (!contractNumber.trim()) {
            setError('Шартнома рақамини киритинг');
            return null;
        }
        if (!clientId) {
            setError('Мижозни танланг');
            return null;
        }
        if (!contractDate) {
            setError('Шартнома санасини киритинг');
            return null;
        }
        const lines = orderRows.filter((r) => r.furnitureOrderId > 0);
        const orderIds = lines.map((r) => r.furnitureOrderId);
        if (new Set(orderIds).size !== orderIds.length) {
            setError('Бир хил буюртма икки мартта кўрсатилган');
            return null;
        }
        const items = itemRows.filter((r) => r.analiticId > 0);
        return {
            enterpriseId,
            contractNumber: contractNumber.trim(),
            clientId: Number(clientId),
            contractDate: contractDateToMs(contractDate),
            status,
            orderLines: lines.map((r) => ({
                furnitureOrderId: r.furnitureOrderId,
                orderPrice: Number(r.orderPrice) || 0,
                count: Number(r.count) > 0 ? Number(r.count) : 1,
                saleDocId: r.saleDocId ?? null,
            })),
            itemLines: items.map((r) => ({
                id: r.id,
                lineKind: r.lineKind,
                analiticId: r.analiticId,
                count: Number(r.count) || 0,
                price: Number(r.price) || 0,
                total: Number(((Number(r.count) || 0) * (Number(r.price) || 0)).toFixed(2)),
                saleDocId: r.saleDocId ?? null,
            })),
        };
    };

    const persistContract = async (closeAfter: boolean): Promise<ClientContract | null> => {
        const body = buildPayload();
        if (!body) return null;
        setSaving(true);
        try {
            const saved = effectiveId
                ? await clientContractsApi.update(token, effectiveId, body)
                : await clientContractsApi.create(token, body);
            applyContract(saved);
            if (closeAfter) onSaved();
            return saved;
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Сақлашда хатолик');
            return null;
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => {
        void persistContract(true);
    };

    const openSalePicker = (state: SalePickerState) => {
        if (!effectiveId || !state.lineId) {
            void persistContract(false).then((saved) => {
                if (!saved) return;
                const match =
                    state.lineType === 'order'
                        ? saved.orderLines?.find((l) => {
                              const row = orderRows.find((r) => r.key === state.rowKey);
                              return row && l.furnitureOrderId === row.furnitureOrderId;
                          })
                        : saved.itemLines?.find((l) => {
                              const row = itemRows.find((r) => r.key === state.rowKey);
                              return (
                                  row &&
                                  l.lineKind === row.lineKind &&
                                  l.analiticId === row.analiticId &&
                                  !l.saleDocId
                              );
                          }) ?? saved.itemLines?.find((l) => {
                              const row = itemRows.find((r) => r.key === state.rowKey);
                              return row && l.analiticId === row.analiticId;
                          });
                if (match?.id) {
                    setSalePicker({ ...state, lineId: Number(match.id) });
                } else {
                    setError('Қаторни сақланг, сўнг реализацияни танланг');
                }
            });
            return;
        }
        setSalePicker(state);
    };

    const attachSale = async (saleDocId: number | null) => {
        if (!salePicker || !effectiveId) return;
        setSaving(true);
        try {
            const updated = await clientContractsApi.attachSale(token, effectiveId, {
                lineType: salePicker.lineType,
                lineId: salePicker.lineId,
                saleDocId,
            });
            applyContract(updated);
            setSalePicker(null);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Боғлашда хатолик');
        } finally {
            setSaving(false);
        }
    };

    const updateItemRow = (key: string, patch: Partial<ItemRow>) => {
        setItemRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    };

    const excludeOrderIdsForPicker = useMemo(
        () =>
            orderRows
                .filter((r) => r.furnitureOrderId > 0 && r.key !== pickerRowKey)
                .map((r) => r.furnitureOrderId),
        [orderRows, pickerRowKey],
    );

    const openDeleteConfirm = () => {
        setDeleteConfirmInput('');
        setDeleteConfirmError('');
        setShowDeleteConfirm(true);
    };
    const closeDeleteConfirm = () => {
        if (deletingContract) return;
        setShowDeleteConfirm(false);
        setDeleteConfirmInput('');
        setDeleteConfirmError('');
    };
    const handleConfirmDeleteContract = async () => {
        if (!effectiveId) return;
        if (deleteConfirmInput.trim() !== contractNumber.trim()) {
            setDeleteConfirmError('Шартнома рақами мос келмади');
            return;
        }
        setDeletingContract(true);
        try {
            await clientContractsApi.delete(token, effectiveId);
            setShowDeleteConfirm(false);
            onDeleted?.();
        } catch (e: unknown) {
            setDeleteConfirmError(e instanceof Error ? e.message : 'Ўчиришда хатолик');
        } finally {
            setDeletingContract(false);
        }
    };

    const renderSaleCell = (
        row: {
            saleDocId?: number | null;
            saleDocLabel?: string;
            saleDocStatus?: string;
            id?: number;
            analiticId?: number;
            lineKind?: ClientContractItemKind;
        },
        lineType: 'item' | 'order',
        rowKey: string,
    ) => {
        const done = isContractLineFulfilled(row.saleDocId, {
            id: Number(row.saleDocId || 0),
            docStatus: row.saleDocStatus,
        });
        return (
            <div className={styles.saleCell}>
                <span className={done ? styles.saleDone : styles.saleEmpty}>
                    {done ? row.saleDocLabel || 'Бажарилган' : 'Бажарилмаган'}
                </span>
                <button
                    type="button"
                    className={styles.btnSm}
                    onClick={() =>
                        openSalePicker({
                            lineType,
                            rowKey,
                            lineId: Number(row.id || 0),
                            analiticId: row.analiticId,
                            lineKind: row.lineKind,
                        })
                    }
                >
                    {done ? 'Ўзгартириш…' : 'Танлаш…'}
                </button>
            </div>
        );
    };

    if (loading) {
        return (
            <div className={styles.modal}>
                <p className={styles.title}>Юкланмоқда…</p>
            </div>
        );
    }

    return (
        <div
            ref={modalShellRef}
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
        >
            <div className={styles.modalHeader}>
                <h3 className={styles.title}>
                    {effectiveId ? 'Шартнома' : 'Янги шартнома'}
                </h3>
                <button
                    type="button"
                    className={`${styles.closeBtn} no-print`}
                    onClick={onClose}
                    aria-label="Ёпиш"
                    title="Ёпиш"
                >
                    ×
                </button>
            </div>

            <div className={styles.gridTop}>
                <div className={styles.field}>
                    <label className={styles.label}>Шартнома рақами *</label>
                    <input
                        ref={contractNumberRef}
                        className={styles.input}
                        value={contractNumber}
                        onChange={(e) => setContractNumber(e.target.value)}
                        placeholder={
                            !effectiveId
                                ? previewNumber || `001-${yearFromContractDate}`
                                : undefined
                        }
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.label}>Шартнома санаси *</label>
                    <input
                        type="date"
                        className={styles.input}
                        value={contractDate}
                        onChange={(e) => setContractDate(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault();
                                contractClientSearchRef.current?.focus();
                            }
                        }}
                    />
                </div>
            </div>
            <div className={styles.gridClient}>
                <ContractClientSelect
                    label="Мижоз (мижозлар рўйхатидан) *"
                    token={token}
                    enterpriseId={enterpriseId}
                    inputRef={contractClientSearchRef}
                    value={clientId}
                    onChange={(id, name) => {
                        setClientId(id);
                        setClientName(name);
                        setOrderRows([]);
                        setPickerRowKey(null);
                    }}
                />
            </div>

            <div className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>Буюртмалар</div>
                <div className={styles.tableWrap}>
                    <table className={`${styles.table} ${styles.tableExcel}`}>
                        <thead>
                            <tr>
                                <th className={styles.colNum}>№</th>
                                <th>Буюртма</th>
                                <th className={styles.colQty}>Сони</th>
                                <th className={styles.colPrice}>Нарх</th>
                                <th className={styles.colTotal}>Жами</th>
                                <th className={styles.colSale}>Реализация</th>
                                <th className={styles.colDel} />
                            </tr>
                        </thead>
                        <tbody>
                            {orderRows.map((row, idx) => (
                                <tr key={row.key}>
                                    <td className={styles.numCell}>{idx + 1}</td>
                                    <td>
                                        <div className={catalogStyles.row}>
                                            <div
                                                role="button"
                                                tabIndex={clientId ? 0 : -1}
                                                className={[
                                                    catalogStyles.readout,
                                                    row.furnitureOrderId
                                                        ? catalogStyles.readoutSelected
                                                        : '',
                                                    clientId
                                                        ? catalogStyles.readoutClickable
                                                        : '',
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                                onClick={() =>
                                                    clientId && setPickerRowKey(row.key)
                                                }
                                                onKeyDown={(e) => {
                                                    if (!clientId) return;
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setPickerRowKey(row.key);
                                                    }
                                                }}
                                                title="Буюртмани танлаш"
                                            >
                                                {row.furnitureOrderId ? (
                                                    <span className={styles.nameWithMeta}>
                                                        <span>
                                                            {row.orderLabel ||
                                                                `#${row.furnitureOrderId}`}
                                                        </span>
                                                        {row.productSummary?.trim() ? (
                                                            <span className={styles.metaUnderName}>
                                                                {row.productSummary.trim()}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                ) : (
                                                    '— буюртмани танланг —'
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className={catalogStyles.catalogBtn}
                                                disabled={!clientId}
                                                onClick={() => setPickerRowKey(row.key)}
                                                title="Буюртмани танлаш"
                                                aria-label="Буюртмани танлаш"
                                            >
                                                <Squares2X2Icon
                                                    className={catalogStyles.catalogBtnIcon}
                                                    aria-hidden
                                                />
                                            </button>
                                        </div>
                                    </td>
                                    <td className={styles.numCell}>
                                        {row.furnitureOrderId
                                            ? formatMoney(row.count) || '0'
                                            : '—'}
                                    </td>
                                    <td className={styles.numCell}>
                                        {row.furnitureOrderId
                                            ? formatMoney(row.orderPrice) || '0'
                                            : '—'}
                                    </td>
                                    <td className={styles.numCell}>
                                        {row.furnitureOrderId
                                            ? formatMoney(orderRowAmount(row)) || '0'
                                            : '—'}
                                    </td>
                                    <td>
                                        {renderSaleCell(row, 'order', row.key)}
                                    </td>
                                    <td className={styles.numCell}>
                                        <button
                                            type="button"
                                            className={styles.btnSm}
                                            onClick={() =>
                                                setOrderRows((prev) =>
                                                    prev.filter((r) => r.key !== row.key),
                                                )
                                            }
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.rowActions}>
                    <button type="button" className={styles.btnSm} onClick={addOrderRow}>
                        + Буюртма қатори
                    </button>
                </div>
            </div>

            <div className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>ТМЦ</div>
                <div className={styles.tableWrap}>
                    <table className={`${styles.table} ${styles.tableExcel}`}>
                        <thead>
                            <tr>
                                <th className={styles.colNum}>№</th>
                                <th className={styles.colKind}>Тури</th>
                                <th>Номенклатура</th>
                                <th className={styles.colQty}>Сони</th>
                                <th className={styles.colPrice}>Нарх</th>
                                <th className={styles.colTotal}>Жами</th>
                                <th className={styles.colSale}>Реализация</th>
                                <th className={styles.colDel} />
                            </tr>
                        </thead>
                        <tbody>
                            {tmcRows.map((row, idx) => {
                                const lineTotal =
                                    (Number(row.count) || 0) * (Number(row.price) || 0);
                                return (
                                    <tr key={row.key}>
                                        <td className={styles.numCell}>{idx + 1}</td>
                                        <td>
                                            <select
                                                className={styles.kindSelect}
                                                value={row.lineKind}
                                                onChange={(e) =>
                                                    updateItemRow(row.key, {
                                                        lineKind: e.target
                                                            .value as ClientContractItemKind,
                                                        analiticId: 0,
                                                        analiticName: '',
                                                        costPrice: null,
                                                    })
                                                }
                                            >
                                                {TMC_ITEM_KINDS.map((k) => (
                                                    <option key={k} value={k}>
                                                        {itemKindLabel(k)}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <div className={styles.nameWithMeta}>
                                            <ContractTmzCatalogPicker
                                                documentType={documentTypeForItemKind(
                                                    row.lineKind,
                                                )}
                                                enterpriseId={enterpriseId}
                                                warehouseId={mainWarehouseId}
                                                documentDate={contractDateToMs(
                                                    contractDate,
                                                )}
                                                displayName={
                                                    row.analiticName ||
                                                    (row.analiticId
                                                        ? `#${row.analiticId}`
                                                        : '')
                                                }
                                                hasSelection={row.analiticId > 0}
                                                selectedProductId={
                                                    row.analiticId || undefined
                                                }
                                                onPick={(product, qty) => {
                                                    const fallback =
                                                        Number(
                                                            product.refValues
                                                                ?.costPriceInStart,
                                                        ) || 0;
                                                    setItemRows((prev) =>
                                                        prev.map((r) =>
                                                            r.key === row.key
                                                                ? {
                                                                      ...r,
                                                                      analiticId:
                                                                          product.id,
                                                                      analiticName:
                                                                          product.name,
                                                                      count:
                                                                          Number(
                                                                              r.count,
                                                                          ) > 0
                                                                              ? r.count
                                                                              : qty,
                                                                      costPrice:
                                                                          fallback >
                                                                          0
                                                                              ? fallback
                                                                              : null,
                                                                  }
                                                                : r,
                                                        ),
                                                    );
                                                    void resolveContractTmzCostPrice({
                                                        token,
                                                        enterpriseId,
                                                        warehouseId: mainWarehouseId,
                                                        analiticId: product.id,
                                                        documentType:
                                                            documentTypeForItemKind(
                                                                row.lineKind,
                                                            ),
                                                        dateMs: contractDateToMs(
                                                            contractDate,
                                                        ),
                                                        fallbackCost: fallback,
                                                    }).then((cost) =>
                                                        updateItemRow(row.key, {
                                                            costPrice: cost,
                                                        }),
                                                    );
                                                }}
                                                onClear={() =>
                                                    updateItemRow(row.key, {
                                                        analiticId: 0,
                                                        analiticName: '',
                                                        costPrice: null,
                                                    })
                                                }
                                            />
                                            <span className={styles.metaUnderName}>
                                                {formatCostUnderName(row)}
                                            </span>
                                            </div>
                                        </td>
                                        <td className={styles.numCell}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className={styles.input}
                                                value={formatMoney(row.count)}
                                                onChange={(e) =>
                                                    updateItemRow(row.key, {
                                                        count: parseMoney(e.target.value),
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className={styles.numCell}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className={styles.input}
                                                value={formatMoney(row.price)}
                                                onChange={(e) =>
                                                    updateItemRow(row.key, {
                                                        price: parseMoney(e.target.value),
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className={styles.numCell}>
                                            {formatMoney(lineTotal) || '0'}
                                        </td>
                                        <td>{renderSaleCell(row, 'item', row.key)}</td>
                                        <td className={styles.numCell}>
                                            <button
                                                type="button"
                                                className={styles.btnSm}
                                                onClick={() =>
                                                    setItemRows((prev) =>
                                                        prev.filter((r) => r.key !== row.key),
                                                    )
                                                }
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className={styles.rowActions}>
                    <button type="button" className={styles.btnSm} onClick={addTmcRow}>
                        + ТМЦ қатори
                    </button>
                </div>
            </div>

            <div className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>Хизматлар</div>
                <div className={styles.tableWrap}>
                    <table className={`${styles.table} ${styles.tableExcel}`}>
                        <thead>
                            <tr>
                                <th className={styles.colNum}>№</th>
                                <th>Хизмат тури</th>
                                <th className={styles.colQty}>Сони</th>
                                <th className={styles.colPrice}>Нарх</th>
                                <th className={styles.colTotal}>Жами</th>
                                <th className={styles.colSale}>Реализация</th>
                                <th className={styles.colDel} />
                            </tr>
                        </thead>
                        <tbody>
                            {serviceRows.map((row, idx) => {
                                const lineTotal =
                                    (Number(row.count) || 0) * (Number(row.price) || 0);
                                return (
                                    <tr key={row.key}>
                                        <td className={styles.numCell}>{idx + 1}</td>
                                        <td>
                                            <ContractServiceCatalogPicker
                                                displayName={
                                                    row.analiticName ||
                                                    (row.analiticId
                                                        ? `#${row.analiticId}`
                                                        : '')
                                                }
                                                hasSelection={row.analiticId > 0}
                                                onPick={(id, name) =>
                                                    updateItemRow(row.key, {
                                                        analiticId: id,
                                                        analiticName: name,
                                                    })
                                                }
                                                onClear={() =>
                                                    updateItemRow(row.key, {
                                                        analiticId: 0,
                                                        analiticName: '',
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className={styles.numCell}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className={styles.input}
                                                value={formatMoney(row.count)}
                                                onChange={(e) =>
                                                    updateItemRow(row.key, {
                                                        count: parseMoney(e.target.value),
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className={styles.numCell}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className={styles.input}
                                                value={formatMoney(row.price)}
                                                onChange={(e) =>
                                                    updateItemRow(row.key, {
                                                        price: parseMoney(e.target.value),
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className={styles.numCell}>
                                            {formatMoney(lineTotal) || '0'}
                                        </td>
                                        <td>{renderSaleCell(row, 'item', row.key)}</td>
                                        <td className={styles.numCell}>
                                            <button
                                                type="button"
                                                className={styles.btnSm}
                                                onClick={() =>
                                                    setItemRows((prev) =>
                                                        prev.filter((r) => r.key !== row.key),
                                                    )
                                                }
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className={styles.rowActions}>
                    <button type="button" className={styles.btnSm} onClick={addServiceRow}>
                        + Хизмат қатори
                    </button>
                </div>
            </div>

            <div className={styles.footerTotals}>
                <div>
                    Буюртмалар:{' '}
                    <strong>{sumOrderPrices.toLocaleString('ru-RU')} сўм</strong>
                </div>
                <div>
                    ТМЦ: <strong>{sumTmc.toLocaleString('ru-RU')} сўм</strong>
                </div>
                <div>
                    Хизматлар:{' '}
                    <strong>{sumServices.toLocaleString('ru-RU')} сўм</strong>
                </div>
                <div>
                    Умумий сумма:{' '}
                    <strong>{grandTotal.toLocaleString('ru-RU')} сўм</strong>
                </div>
                <div>
                    Ижро: <strong>{fulfilledCount.done}/{fulfilledCount.total}</strong>
                </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
                <button
                    type="button"
                    className={`${styles.btnSm} no-print`}
                    onClick={handlePrintContract}
                >
                    Шартнома
                </button>
                <button
                    type="button"
                    className={`${styles.btnSm} no-print`}
                    onClick={handlePrintKp}
                >
                    Тижорий таклиф
                </button>
                <label className={`${styles.statusSelectWrap} no-print`}>
                    <span className={styles.statusSelectLabel}>Статус</span>
                    <select
                        className={styles.statusSelect}
                        value={
                            status === ClientContractStatus.PRODUCTION
                                ? ClientContractStatus.APPROVED
                                : status
                        }
                        onChange={(e) =>
                            setStatus(e.target.value as ClientContractStatus)
                        }
                    >
                        <option value={ClientContractStatus.DRAFT}>Қоралама</option>
                        <option value={ClientContractStatus.APPROVED}>Тасдиқланган</option>
                        <option value={ClientContractStatus.COMPLETED}>Якунланган</option>
                    </select>
                </label>
                <span className={styles.actionsSpacer} />
                {effectiveId != null && (
                    <button
                        type="button"
                        className={`${styles.deleteContractBtn} no-print`}
                        onClick={openDeleteConfirm}
                        disabled={saving || deletingContract}
                    >
                        {deletingContract ? 'Ўчирилмоқда…' : 'Шартномани ўчириш'}
                    </button>
                )}
                <button type="button" className={styles.btnCancel} onClick={onClose}>
                    Ёпиш
                </button>
                <button
                    type="button"
                    className={styles.btnSave}
                    disabled={saving}
                    onClick={handleSave}
                >
                    {saving ? 'Сақланмоқда…' : 'Сақлаш'}
                </button>
            </div>

            <div className={styles.printOffscreen} aria-hidden>
                <ContractPrintDocument
                    ref={printContractRef}
                    contractNumber={contractNumber}
                    contractDateMs={printContractDateMs}
                    clientName={clientName}
                    orders={printOrderLines}
                    items={printItemLines}
                    expenseTotal={sumTmc + sumServices}
                    sumOrderPrices={sumOrderPrices}
                    grandTotal={grandTotal}
                />
                <CommercialProposalPrint
                    ref={printKpRef}
                    clientName={clientName}
                    contractDateMs={printContractDateMs}
                    orders={kpOrderLines}
                    grandTotal={grandTotal}
                    validityNote={kpValidityNote}
                />
            </div>

            <ContractOrderPickerModal
                open={pickerRowKey != null && !!clientId}
                token={token}
                enterpriseId={enterpriseId}
                clientId={Number(clientId)}
                excludeIds={excludeOrderIdsForPicker}
                onClose={() => setPickerRowKey(null)}
                onPick={(order) => {
                    if (!pickerRowKey) return;
                    setOrderRows((rows) =>
                        rows.map((r) => {
                            if (r.key !== pickerRowKey) return r;
                            const qtyPrice = qtyPriceFromFurnitureOrder(order);
                            return {
                                ...r,
                                furnitureOrderId: order.id,
                                orderLabel: order.orderNumber,
                                productSummary: order.analitic?.name ?? '',
                                count: qtyPrice.count,
                                orderPrice: qtyPrice.orderPrice,
                                amount: qtyPrice.amount,
                                saleDocId: order.saleDocId ?? r.saleDocId,
                            };
                        }),
                    );
                    setPickerRowKey(null);
                }}
            />

            {salePicker && effectiveId != null && (
                <ContractSaleDocPicker
                    open
                    token={token}
                    contractId={effectiveId}
                    lineType={salePicker.lineType}
                    lineId={salePicker.lineId}
                    onClose={() => setSalePicker(null)}
                    onPick={(docId) => void attachSale(docId)}
                    onClear={() => void attachSale(null)}
                />
            )}

            {showDeleteConfirm && effectiveId != null && (
                <div
                    className={styles.deleteConfirmOverlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeDeleteConfirm();
                    }}
                >
                    <div
                        className={styles.deleteConfirmBox}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={styles.deleteConfirmTitle}>Шартномани ўчириш?</h3>
                        <p className={styles.deleteConfirmText}>
                            Шартнома ва унинг қаторлари базадан ўчирилади. Буюртмалар ўзи
                            қолади. Тасдиқлаш учун шартнома рақамини киритинг:{' '}
                            <strong>{contractNumber.trim()}</strong>
                        </p>
                        <input
                            type="text"
                            className={styles.deleteConfirmInput}
                            value={deleteConfirmInput}
                            onChange={(e) => {
                                setDeleteConfirmInput(e.target.value);
                                if (deleteConfirmError) setDeleteConfirmError('');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleConfirmDeleteContract();
                            }}
                            placeholder="Шартнома рақами"
                            autoFocus
                            disabled={deletingContract}
                        />
                        {deleteConfirmError && (
                            <div className={styles.deleteConfirmError}>{deleteConfirmError}</div>
                        )}
                        <div className={styles.deleteConfirmActions}>
                            <button
                                type="button"
                                className={styles.deleteConfirmCancelBtn}
                                onClick={closeDeleteConfirm}
                                disabled={deletingContract}
                            >
                                Бекор қилиш
                            </button>
                            <button
                                type="button"
                                className={styles.deleteConfirmSubmitBtn}
                                onClick={() => void handleConfirmDeleteContract()}
                                disabled={deletingContract || deleteConfirmInput.trim() === ''}
                            >
                                {deletingContract ? 'Ўчирилмоқда…' : 'Ўчириш'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
