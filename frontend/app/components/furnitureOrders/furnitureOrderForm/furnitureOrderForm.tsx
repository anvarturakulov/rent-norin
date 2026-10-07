'use client'
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './furnitureOrderForm.module.css';
import { useAppContext } from '@/app/context/app.context';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import {
    FurnitureOrder,
    FurnitureOrderType,
    getStagesForOrderType,
    ORDER_STAGE_SEQUENCE,
    ORDER_TYPE_LABELS,
    OrderStageType,
    STAGE_LABELS,
    TEMPORARILY_DISABLED_STAGES,
} from '@/app/interfaces/furnitureOrder.interface';
import { FinishedProductCatalogPicker } from '@/app/components/furnitureOrders/finishedProductCatalogPicker';
import { OrderPriceSummary } from '@/app/components/furnitureOrders/OrderPriceSummary';
import ContractClientSelect from '@/app/components/clientContracts/contractClientSelect/contractClientSelect';
import {
    computeOrderTotal,
    resolveOrderPriceFromProduct,
    normalizeOrderPrice,
} from '@/app/components/furnitureOrders/helpers/orderPrice';
import { formatDateForInput, parseDateInputValue } from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';

const ALL_STAGE_OPTIONS: OrderStageType[] = ORDER_STAGE_SEQUENCE.filter(
    (s) => s !== 'COMPLETED' && !TEMPORARILY_DISABLED_STAGES.includes(s),
);

const msToDateInput = (ms?: number | string | null): string => {
    if (ms == null || ms === '') return '';
    const num = typeof ms === 'string' ? Number(ms) : ms;
    if (!Number.isFinite(num)) return '';
    return formatDateForInput(num);
};

interface Props {
    onClose: () => void;
    onCreated: (order: FurnitureOrder) => void;
    /** Таҳрирлаш режими — мавжуд заявкани очади (стадия Талабгор) */
    order?: FurnitureOrder;
    /** Таҳрирлаш тугагандан кейин чақирилади */
    onUpdated?: (order: FurnitureOrder) => void;
    /** Предзаполнить клиента (например из шартнома) */
    initialClientId?: number;
    /** Не давать менять клиента */
    lockClient?: boolean;
}

export default function FurnitureOrderForm({
    onClose,
    onCreated,
    order,
    onUpdated,
    initialClientId,
    lockClient,
}: Props) {
    const isEdit = Boolean(order);
    const isTalabgorEdit = isEdit && order?.currentStage === 'TALABGOR';

    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const token = user?.token!;
    const enterpriseId = user?.enterpriseId!;

    const [clientId, setClientId] = useState(() => order ? String(order.clientId) : '');
    const [analiticId, setAnaliticId] = useState(() => order?.analiticId ? String(order.analiticId) : '');
    const [analiticName, setAnaliticName] = useState(() => order?.analitic?.name ?? '');
    const [orderDate, setOrderDate] = useState(() =>
        order ? msToDateInput(order.orderDate ?? order.createdDate) : formatDateForInput(nowMs())
    );
    const [deadlineDate, setDeadlineDate] = useState(() => msToDateInput(order?.deadlineDate));
    const [count, setCount] = useState(() => order?.count != null ? String(order.count) : '');
    const [price, setPrice] = useState(() =>
        order?.price != null ? String(Math.round(order.price)) : ''
    );
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [comment, setComment] = useState(() => order?.comment ?? '');

    const [orderType, setOrderType] = useState<FurnitureOrderType>(() => order?.orderType ?? 'individualPrice');
    const [selectedStages, setSelectedStages] = useState<OrderStageType[]>(() => {
        if (order?.pipelineStages?.length) {
            return order.pipelineStages
                .filter(s => s.status !== 'SKIPPED')
                .sort((a, b) => a.sequence - b.sequence)
                .map(s => s.stageName);
        }
        return getStagesForOrderType(order?.orderType ?? 'individualPrice');
    });

    const [saving, setSaving] = useState(false);
    const [advancing, setAdvancing] = useState(false);
    const [error, setError] = useState('');
    const skipOrderTypeStagesSync = useRef(true);

    useEffect(() => {
        if (!isEdit && initialClientId != null && initialClientId > 0) {
            setClientId(String(initialClientId));
        }
    }, [initialClientId, isEdit]);

    useEffect(() => {
        if (skipOrderTypeStagesSync.current) {
            skipOrderTypeStagesSync.current = false;
            return;
        }
        setSelectedStages(getStagesForOrderType(orderType));
    }, [orderType]);

    const toggleStage = (stage: OrderStageType) => {
        setSelectedStages(prev =>
            prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
        );
    };

    const loadPriceForProduct = useCallback(
        async (productId: number, dateStr: string) => {
            if (!productId || !dateStr) return;
            setLoadingPrice(true);
            try {
                const dateMs = new Date(dateStr).getTime();
                const resolved = await resolveOrderPriceFromProduct(
                    token,
                    productId,
                    dateMs,
                    enterpriseId,
                );
                if (resolved > 0) setPrice(String(normalizeOrderPrice(resolved)));
            } finally {
                setLoadingPrice(false);
            }
        },
        [token, enterpriseId],
    );

    const handleFinishedProductPick = useCallback(
        (id: number, name: string, quantity: number) => {
            setAnaliticId(String(id));
            setAnaliticName(name);
            setCount(String(quantity));
            void loadPriceForProduct(id, orderDate);
        },
        [loadPriceForProduct, orderDate],
    );

    const handleClearFinishedProduct = useCallback(() => {
        setAnaliticId('');
        setAnaliticName('');
    }, []);

    const getFinalStages = (): OrderStageType[] =>
        ORDER_STAGE_SEQUENCE.filter((stage) => selectedStages.includes(stage));

    const validateForm = (): string | null => {
        if (!clientId) return 'Мижозни танланг';
        if (!analiticId) return 'Тайёр маҳсулотни танланг';
        if (!orderDate) return 'Санани киритинг';
        if (selectedStages.length === 0) return 'Камида битта этап танланг';
        return null;
    };

    const buildPayload = () => {
        const countNum = count ? Number(count) : undefined;
        const priceNum = price ? normalizeOrderPrice(price) : undefined;
        const totalNum =
            countNum != null && priceNum != null
                ? computeOrderTotal(countNum, priceNum)
                : undefined;
        const finalStages = getFinalStages();

        return {
            countNum,
            priceNum,
            totalNum,
            finalStages,
            common: {
                clientId: Number(clientId),
                analiticId: Number(analiticId),
                orderDate: parseDateInputValue(orderDate) ?? nowMs(),
                deadlineDate: deadlineDate ? new Date(deadlineDate).getTime() : undefined,
                count: countNum,
                price: priceNum,
                total: totalNum || undefined,
                comment,
                orderType,
                stages: finalStages,
            },
        };
    };

    const handleSave = async () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSaving(true);
        setError('');
        try {
            const { common } = buildPayload();

            if (isEdit && order) {
                const updated = await foApi.updateOrder(token, order.id, common);
                onUpdated?.(updated);
            } else {
                if (enterpriseId == null) {
                    setError('Корхона аниқланмади');
                    setSaving(false);
                    return;
                }
                const created = await foApi.createOrder(token, {
                    enterpriseId: Number(enterpriseId),
                    ...common,
                    createdDate: Date.now(),
                    productionDeptIds: [],
                });
                onCreated(created);
            }
        } catch (e: any) {
            setError(e.message || 'Хатолик');
        } finally {
            setSaving(false);
        }
    };

    const handleAdvance = async () => {
        if (!isTalabgorEdit || !order) return;

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setAdvancing(true);
        setError('');
        try {
            const { common } = buildPayload();
            await foApi.updateOrder(token, order.id, common);
            const updated = await foApi.advanceStage(token, order.id, user?.id!);
            onUpdated?.(updated);
        } catch (e: any) {
            setError(e.message || 'Хатолик');
        } finally {
            setAdvancing(false);
        }
    };

    const busy = saving || advancing;

    const orderNumberLabel = isEdit
        ? order!.orderNumber
        : (orderDate ? `001-${orderDate.slice(0, 4)} …` : 'Авто');

    const modalTypeClass =
        orderType === 'readyPrice' ? styles.modalReadyPrice : styles.modalIndividualPrice;

    return (
        <div className={`${styles.modal} ${modalTypeClass}`}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <h3 className={styles.title}>
                        {isEdit ? 'Заявкани таҳрирлаш' : 'Янги заявка'}
                    </h3>
                    <p className={styles.subtitle}>№ {orderNumberLabel}</p>
                </div>
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={onClose}
                    disabled={busy}
                    aria-label="Ёпиш"
                >
                    ×
                </button>
            </div>

            <div className={styles.orderTypeRow} role="group" aria-label="Заказ тури">
                {(['readyPrice', 'individualPrice'] as FurnitureOrderType[]).map((type) => (
                    <button
                        key={type}
                        type="button"
                        className={`${styles.orderTypeChip} ${orderType === type ? styles.orderTypeChipActive : ''}`}
                        onClick={() => setOrderType(type)}
                    >
                        {ORDER_TYPE_LABELS[type]}
                    </button>
                ))}
            </div>

            <div className={styles.body}>
                <section className={styles.section}>
                    <h4 className={styles.sectionTitle}>Асосий</h4>
                    <div className={styles.grid}>
                        <div className={`${styles.field} ${styles.fieldFull}`}>
                            <label className={styles.label}>Мижоз *</label>
                            <ContractClientSelect
                                label=""
                                token={token}
                                enterpriseId={enterpriseId}
                                value={clientId}
                                onChange={(id) => setClientId(id)}
                                disabled={Boolean(lockClient)}
                                controlClassName={styles.selectControl}
                                searchClassName={styles.selectInput}
                                plusClassName={styles.plusBtn}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Сана *</label>
                            <input
                                className={styles.input}
                                type="date"
                                value={orderDate}
                                onChange={(e) => {
                                    setOrderDate(e.target.value);
                                    if (analiticId) void loadPriceForProduct(Number(analiticId), e.target.value);
                                }}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Муддат</label>
                            <input
                                className={styles.input}
                                type="date"
                                value={deadlineDate}
                                onChange={e => setDeadlineDate(e.target.value)}
                            />
                        </div>
                        <div className={`${styles.field} ${styles.fieldFull}`}>
                            <label className={styles.label}>Тайёр маҳсулот / Ярим тайёр *</label>
                            <FinishedProductCatalogPicker
                                enterpriseId={enterpriseId}
                                warehouseId={user?.sectionId}
                                documentDate={orderDate ? (parseDateInputValue(orderDate) ?? nowMs()) : nowMs()}
                                displayName={analiticName}
                                hasSelection={Boolean(analiticId)}
                                selectedProductId={analiticId ? Number(analiticId) : undefined}
                                onPick={handleFinishedProductPick}
                                onClear={handleClearFinishedProduct}
                                readoutClassName={styles.input}
                                rowClassName={styles.catalogRow}
                            />
                        </div>
                        <div className={`${styles.field} ${styles.fieldFull}`}>
                            <OrderPriceSummary
                                compact
                                className={styles.priceTable}
                                count={count}
                                price={price}
                                onCountChange={setCount}
                                onPriceChange={setPrice}
                            />
                            {loadingPrice ? (
                                <span className={styles.hint}>Нарх юкланмоқда…</span>
                            ) : null}
                        </div>
                        <div className={`${styles.field} ${styles.fieldFull}`}>
                            <label className={styles.label}>Изоҳ</label>
                            <textarea
                                className={styles.textarea}
                                rows={3}
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder="Қўшимча маълумот..."
                            />
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <h4 className={styles.sectionTitle}>Маршрут этаплари</h4>
                    <div className={styles.stagesWrap}>
                        {ALL_STAGE_OPTIONS.map(stage => (
                            <button
                                key={stage}
                                type="button"
                                className={`${styles.stageChip} ${selectedStages.includes(stage) ? styles.stageChipActive : ''}`}
                                onClick={() => toggleStage(stage)}
                            >
                                {STAGE_LABELS[stage]}
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            <div className={styles.footer}>
                {error ? <div className={styles.error}>{error}</div> : null}
                <div className={styles.actions}>
                    <button type="button" className={styles.btnCancel} onClick={onClose} disabled={busy}>
                        Бекор
                    </button>
                    <button type="button" className={styles.btnSave} onClick={handleSave} disabled={busy}>
                        {saving ? 'Сақланмоқда...' : isEdit ? 'Сақлаш' : 'Яратиш'}
                    </button>
                    {isTalabgorEdit && (
                        <button
                            type="button"
                            className={styles.btnAdvance}
                            onClick={handleAdvance}
                            disabled={busy}
                        >
                            {advancing ? 'Ўтилмоқда...' : 'Кейинги босқичга'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
