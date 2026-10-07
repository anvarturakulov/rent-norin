'use client';

import { useState } from 'react';
import useSWR from 'swr';
import styles from './orderStoreWorkTab.module.css';
import type {
    FurnitureOrder,
    StoreWorkDocumentInfo,
    StoreWorkResponse,
    WriteoffProgressLine,
} from '@/app/interfaces/furnitureOrder.interface';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { formatOrderAmount } from '@/app/components/furnitureOrders/helpers/orderPrice';
import { formatDisplayDateOrDash as formatStoreWorkDate } from '@/app/utils/formatDisplayDate';

interface Props {
    order: FurnitureOrder;
    token: string;
    userId?: number;
    readOnly?: boolean;
    onOrderUpdated?: (order: FurnitureOrder) => void;
}

const docStatusLabel = (status: string) => {
    if (status === 'PROVEDEN') return 'Проведён';
    if (status === 'OPEN') return 'Открыт';
    if (status === 'PENDING') return 'Ожидает';
    return status;
};

const formatQty = (value: number) => {
    if (!Number.isFinite(value)) return '—';
    return String(Number(value.toFixed(3)));
};

const resolveDocAmount = (doc: StoreWorkDocumentInfo, preferCost = false) => {
    if (preferCost && doc.costTotal != null) return doc.costTotal;
    if (doc.total != null) return doc.total;
    if (doc.costTotal != null) return doc.costTotal;
    return null;
};

const DocumentsJournal = ({
    documents,
    title,
    showCount = false,
    preferCostTotal = false,
    emptyText = 'Документов нет',
}: {
    documents: StoreWorkDocumentInfo[];
    title: string;
    showCount?: boolean;
    preferCostTotal?: boolean;
    emptyText?: string;
}) => (
    <div className={styles.docJournal}>
        <h4 className={styles.docJournalTitle}>{title}</h4>
        {!documents.length ? (
            <p className={styles.hint}>{emptyText}</p>
        ) : (
            <ul className={styles.docJournalList}>
                {documents.map((doc) => {
                    const amount = resolveDocAmount(doc, preferCostTotal);
                    return (
                        <li key={doc.documentId} className={styles.docJournalItem}>
                            <span>#{doc.documentId}</span>
                            <span>{formatStoreWorkDate(doc.date)}</span>
                            <span
                                className={
                                    doc.docStatus === 'PROVEDEN'
                                        ? styles.statusProved
                                        : styles.statusOpen
                                }
                            >
                                {docStatusLabel(doc.docStatus)}
                            </span>
                            {showCount && (
                                <span>
                                    {doc.count != null && Number.isFinite(Number(doc.count))
                                        ? `${formatQty(Number(doc.count))} шт.`
                                        : '—'}
                                </span>
                            )}
                            {amount != null && (
                                <span>{formatOrderAmount(amount)}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        )}
    </div>
);

const PlanFactCollapse = ({
    title,
    progress,
    expanded,
    onToggle,
}: {
    title: string;
    progress: WriteoffProgressLine[];
    expanded: boolean;
    onToggle: () => void;
}) => {
    if (!progress.length) {
        return <p className={styles.hint}>Нет строк плана по заказу.</p>;
    }

    return (
        <div className={styles.planFactBlock}>
            <button
                type="button"
                className={styles.collapseBtn}
                onClick={onToggle}
                aria-expanded={expanded}
            >
                {expanded ? '▾' : '▸'} {title}
                <span className={styles.collapseMeta}>{progress.length} поз.</span>
            </button>
            {expanded && (
                <div className={styles.progressTable}>
                    <div className={styles.progressHead}>
                        <span>ТМЗ</span>
                        <span>Ед.</span>
                        <span>Режа</span>
                        <span>Списано</span>
                        <span>Остаток</span>
                    </div>
                    {progress.map((row) => {
                        const id = Number(row.materialId ?? row.halfstuffId);
                        const isExtra = Number(row.planned || 0) <= 0.001;
                        return (
                            <div
                                key={id || `${row.name}-${row.planned}`}
                                className={styles.progressRow}
                            >
                                <span className={styles.materialName}>
                                    {row.name || (id ? `#${id}` : '—')}
                                    {isExtra && (
                                        <span className={styles.addedBadge}>қўшилган</span>
                                    )}
                                </span>
                                <span data-label="Ед.">{row.unit || '—'}</span>
                                <span data-label="Режа">{formatQty(row.planned)}</span>
                                <span data-label="Списано">{formatQty(row.writtenOff)}</span>
                                <span data-label="Остаток">{formatQty(row.remaining)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default function OrderStoreWorkTab({ order, token }: Props) {
    const [materialsPlanOpen, setMaterialsPlanOpen] = useState(false);
    const [halfstuffsPlanOpen, setHalfstuffsPlanOpen] = useState(false);

    const swrKey = token && order.id ? ['store-work-lite', token, order.id] : null;
    const { data, error, isLoading } = useSWR<StoreWorkResponse>(
        swrKey,
        () => foApi.getStoreWork(token, order.id, undefined, { lite: true }),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    if (isLoading && !data) {
        return <div className={styles.loading}>Юкланмоқда...</div>;
    }

    if (error) {
        return (
            <div className={styles.error}>
                {error instanceof Error ? error.message : 'Ошибка загрузки омбор ишлари'}
            </div>
        );
    }

    if (!data) {
        return <div className={styles.hint}>Маълумот йўқ</div>;
    }

    const showMaterials =
        data.needsMaterialWriteoff || (data.materialWriteoffDocuments?.length ?? 0) > 0;
    const showHalfstuffs =
        data.needsHalfstuffWriteoff || (data.halfstuffWriteoffDocuments?.length ?? 0) > 0;
    const showReceipt =
        data.requiresReceipt || (data.receiptDocuments?.length ?? 0) > 0;
    const showSale =
        data.requiresClientSale !== false || (data.saleDocuments?.length ?? 0) > 0;

    const sectionSteps = {
        materials: showMaterials ? 1 : 0,
        halfstuffs: showHalfstuffs ? (showMaterials ? 2 : 1) : 0,
        receipt: showReceipt
            ? 1 + Number(showMaterials) + Number(showHalfstuffs)
            : 0,
        sale: showSale
            ? 1 + Number(showMaterials) + Number(showHalfstuffs) + Number(showReceipt)
            : 0,
    };

    return (
        <div className={styles.wrap}>
            {data.advanceWarnings.length > 0 && (
                <p className={styles.warn}>{data.advanceWarnings.join('. ')}</p>
            )}

            {showMaterials && (
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        {sectionSteps.materials}. Материалы
                    </h3>
                    {data.materialWriteoffComplete && (
                        <p className={styles.hint}>Списание материалов завершено по плану заказа.</p>
                    )}
                    <DocumentsJournal
                        documents={data.materialWriteoffDocuments ?? []}
                        title="Списанные документы"
                        emptyText="Списанных документов нет"
                    />
                    <PlanFactCollapse
                        title="Запланировано / фактически списано"
                        progress={data.materialWriteoffProgress ?? []}
                        expanded={materialsPlanOpen}
                        onToggle={() => setMaterialsPlanOpen((v) => !v)}
                    />
                </section>
            )}

            {showHalfstuffs && (
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        {sectionSteps.halfstuffs}. Полуфабрикаты
                    </h3>
                    {data.halfstuffWriteoffComplete && (
                        <p className={styles.hint}>
                            Списание полуфабрикатов завершено по плану заказа.
                        </p>
                    )}
                    <DocumentsJournal
                        documents={data.halfstuffWriteoffDocuments ?? []}
                        title="Списанные документы"
                        emptyText="Списанных документов нет"
                    />
                    <PlanFactCollapse
                        title="Запланировано / фактически списано"
                        progress={data.halfstuffWriteoffProgress ?? []}
                        expanded={halfstuffsPlanOpen}
                        onToggle={() => setHalfstuffsPlanOpen((v) => !v)}
                    />
                </section>
            )}

            {showReceipt && (
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        {sectionSteps.receipt}. Приход готовой продукции
                    </h3>
                    {data.receiptComplete && (
                        <p className={styles.hint}>Приход оформлен полностью.</p>
                    )}
                    <DocumentsJournal
                        documents={data.receiptDocuments ?? []}
                        title="Документы прихода"
                        showCount
                        preferCostTotal
                        emptyText="Документов прихода нет"
                    />
                </section>
            )}

            {showSale && (
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        {sectionSteps.sale}. Накладные
                    </h3>
                    {data.saleComplete && (
                        <p className={styles.hint}>Накладные оформлены полностью.</p>
                    )}
                    <DocumentsJournal
                        documents={data.saleDocuments ?? []}
                        title="Оформленные накладные"
                        showCount
                        emptyText="Накладных нет"
                    />
                </section>
            )}

            {!showMaterials && !showHalfstuffs && !showReceipt && !showSale && (
                <p className={styles.hint}>По этому заказу нет складских операций.</p>
            )}
        </div>
    );
}
