'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import styles from './furnitureOrderCard.module.css';
import type { CuttingBalanceRow, FurnitureOrder, OrderCuttingLine } from '@/app/interfaces/furnitureOrder.interface';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { cuttingApi } from '@/app/service/furnitureOrders/orderCutting.service';
import {
    SearchableTableSelect,
    type SearchableTableSelectOption,
} from '@/app/components/shared/searchableTableSelect/SearchableTableSelect';
import { usePendingRowFocus } from '@/app/hooks/usePendingRowFocus';
import { ImageModal } from '@/app/components/common/imageModal/ImageModal';
import { formatWorksNumberDisplay, WorkNumericCell } from './workTableCells';
import {
    buildCuttingDiff,
    cuttingBalanceKey,
    cuttingLineToDraft,
    draftCuttingToPayload,
    draftCuttingToUpdateBody,
    emptyCuttingDraftRow,
    calcCuttingAreaM2,
    groupBalancesByMaterial,
    parseCuttingQty,
    sumCuttingQtyByKey,
    type CuttingBalanceGroup,
    type DraftCuttingRow,
} from './orderCuttingDraft';

function formatCuttingAreaM2(
    length: string | number,
    width: string | number,
    quantity: string | number,
): string {
    const area = calcCuttingAreaM2(length, width, quantity);
    if (area == null) return '—';
    return formatWorksNumberDisplay(String(area), 2);
}

type MaterialRef = {
    id: number;
    name: string;
    article?: string;
    isSheetMaterial?: boolean;
    imagePath?: string;
};

function buildMaterialImageUrl(imagePath?: string | null): string | null {
    if (!imagePath) return null;
    return `${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/image/${imagePath}`;
}

function refToSelectOption(m: MaterialRef): SearchableTableSelectOption {
    return {
        id: String(m.id),
        name: m.article ? `${m.name} (${m.article})` : m.name,
    };
}

interface Props {
    order: FurnitureOrder;
    token: string;
    canEdit: boolean;
    materialReferences: MaterialRef[];
    onUpdated: (order: FurnitureOrder) => void;
}

function CuttingTableBlock({
    rows,
    canEdit,
    getMaterialOptionsForRow,
    materialArticle,
    onAddRow,
    onRemoveRow,
    onUpdateRow,
    onSave,
    saving,
    dirty,
    getBalanceForRow,
    addRowDisabled = false,
    dimensionsReadOnly = false,
    showTransferToOutput = false,
    onTransferToOutput,
    focusDraftId = null,
    onAutoFocusApplied,
}: {
    rows: DraftCuttingRow[];
    canEdit: boolean;
    getMaterialOptionsForRow: (row: DraftCuttingRow) => SearchableTableSelectOption[];
    materialArticle: (id: string) => string;
    getBalanceForRow?: (row: DraftCuttingRow) => number | null;
    onAddRow: () => void;
    onRemoveRow: (row: DraftCuttingRow) => void;
    onUpdateRow: (draftId: string, field: keyof DraftCuttingRow, value: string) => void;
    onSave: () => void;
    saving: boolean;
    dirty: boolean;
    addRowDisabled?: boolean;
    dimensionsReadOnly?: boolean;
    showTransferToOutput?: boolean;
    onTransferToOutput?: (row: DraftCuttingRow) => void;
    focusDraftId?: string | null;
    onAutoFocusApplied?: () => void;
}) {
    return (
        <>
            {canEdit && (
                <div className={styles.worksToolbar}>
                    <div className={styles.worksToolbarLeft}>
                        <button
                            type="button"
                            className={styles.btnAdd}
                            onClick={onAddRow}
                            disabled={addRowDisabled}
                            title={
                                addRowDisabled
                                    ? 'Қаторларни юқоридаги қолдиқлар жадвалидан қўшинг'
                                    : undefined
                            }
                        >
                            + Қатор
                        </button>
                        <button
                            type="button"
                            className={styles.saveInfoBtn}
                            onClick={onSave}
                            disabled={saving || !dirty}
                            style={{ marginTop: 0 }}
                        >
                            {saving ? 'Сақланмоқда...' : 'Сақлаш'}
                        </button>
                        {dirty && <span className={styles.worksDirtyHint}>Сақланмаган ўзгаришлар бор</span>}
                    </div>
                </div>
            )}
            <CuttingTableScroll
                rows={rows}
                canEdit={canEdit}
                getMaterialOptionsForRow={getMaterialOptionsForRow}
                materialArticle={materialArticle}
                getBalanceForRow={getBalanceForRow}
                dimensionsReadOnly={dimensionsReadOnly}
                showTransferToOutput={showTransferToOutput}
                onTransferToOutput={onTransferToOutput}
                onRemoveRow={onRemoveRow}
                onUpdateRow={onUpdateRow}
                focusDraftId={focusDraftId}
                onAutoFocusApplied={onAutoFocusApplied}
            />
        </>
    );
}

function CuttingTableScroll({
    rows,
    canEdit,
    getMaterialOptionsForRow,
    materialArticle,
    getBalanceForRow,
    dimensionsReadOnly = false,
    showTransferToOutput = false,
    onTransferToOutput,
    onRemoveRow,
    onUpdateRow,
    focusDraftId = null,
    onAutoFocusApplied,
}: {
    rows: DraftCuttingRow[];
    canEdit: boolean;
    getMaterialOptionsForRow: (row: DraftCuttingRow) => SearchableTableSelectOption[];
    materialArticle: (id: string) => string;
    getBalanceForRow?: (row: DraftCuttingRow) => number | null;
    dimensionsReadOnly?: boolean;
    showTransferToOutput?: boolean;
    onTransferToOutput?: (row: DraftCuttingRow) => void;
    onRemoveRow: (row: DraftCuttingRow) => void;
    onUpdateRow: (draftId: string, field: keyof DraftCuttingRow, value: string) => void;
    focusDraftId?: string | null;
    onAutoFocusApplied?: () => void;
}) {
    const colSpan =
        8 + (showTransferToOutput && canEdit ? 1 : 0) + (canEdit ? 1 : 0);
    const lengthEditable = canEdit && !dimensionsReadOnly;
    const widthEditable = canEdit && !dimensionsReadOnly;

    return (
        <div className={styles.worksTableScroll}>
            <table className={`${styles.worksTable} ${styles.worksTableBordered}`}>
                <thead>
                    <tr>
                        <th className={styles.cellNumHead}>№</th>
                        <th>Материал</th>
                        <th>Артикул</th>
                        <th>Узунлик (мм)</th>
                        <th>Эни (мм)</th>
                        <th>Миқдор (дона)</th>
                        <th className={styles.cuttingAreaCol}>м²</th>
                        <th>Қолдиқ (ҳозир)</th>
                        {showTransferToOutput && canEdit && (
                            <th className={styles.cuttingBalancesActionCol}>Действие</th>
                        )}
                        {canEdit && <th style={{ width: 36 }} />}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={colSpan} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                Қаторлар йўқ
                            </td>
                        </tr>
                    )}
                    {rows.map((row, rowIndex) => {
                        const rowMaterialOptions = getMaterialOptionsForRow(row);
                        return (
                        <tr key={row.draftId}>
                            <td className={styles.cellNum}>{rowIndex + 1}</td>
                            <td style={{ minWidth: 220 }}>
                                {canEdit ? (
                                    <SearchableTableSelect
                                        className={styles.materialSearchSelect}
                                        options={rowMaterialOptions}
                                        value={row.materialId}
                                        onChange={val => onUpdateRow(row.draftId, 'materialId', val)}
                                        placeholder="— Материал —"
                                        autoFocus={focusDraftId === row.draftId}
                                        onAutoFocusApplied={onAutoFocusApplied}
                                    />
                                ) : (
                                        rowMaterialOptions.find(o => o.id === row.materialId)?.name ?? '—'
                                )}
                            </td>
                            <td>{row.materialId ? materialArticle(row.materialId) || '—' : '—'}</td>
                            <td>
                                {lengthEditable ? (
                                    <WorkNumericCell
                                        value={row.length}
                                        className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                        onChange={v => onUpdateRow(row.draftId, 'length', v)}
                                    />
                                ) : (
                                    formatWorksNumberDisplay(row.length, 2)
                                )}
                            </td>
                            <td>
                                {widthEditable ? (
                                    <WorkNumericCell
                                        value={row.width}
                                        className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                        onChange={v => onUpdateRow(row.draftId, 'width', v)}
                                    />
                                ) : (
                                    formatWorksNumberDisplay(row.width, 2)
                                )}
                            </td>
                            <td>
                                {canEdit ? (
                                    <WorkNumericCell
                                        value={row.quantity}
                                        className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                        onChange={v => onUpdateRow(row.draftId, 'quantity', v)}
                                    />
                                ) : (
                                    formatWorksNumberDisplay(row.quantity, 2)
                                )}
                            </td>
                            <td className={styles.cuttingAreaCol}>
                                {formatCuttingAreaM2(row.length, row.width, row.quantity)}
                            </td>
                            <td>
                                {(() => {
                                    const bal = getBalanceForRow?.(row) ?? null;
                                    if (bal == null) {
                                        return <span className={styles.cuttingRowBalanceHintMuted}>—</span>;
                                    }
                                    const negative = bal < -0.000001;
                                    return (
                                        <span
                                            className={
                                                negative
                                                    ? styles.cuttingRowBalanceHintNegative
                                                    : styles.cuttingRowBalanceHint
                                            }
                                            title="Барча заявкалар бўйича (сақланмаган ўзгаришлар ҳисобга олинган)"
                                        >
                                            {formatWorksNumberDisplay(String(bal), 2)}
                                            {negative ? ' ⚠' : ''}
                                        </span>
                                    );
                                })()}
                            </td>
                            {showTransferToOutput && canEdit && (
                                <td className={styles.cuttingBalancesActionCol}>
                                    <button
                                        type="button"
                                        className={styles.cuttingBalancesTransferBtn}
                                        title="Приход жадвалига (фақат материал)"
                                        disabled={!row.materialId.trim()}
                                        onClick={() => onTransferToOutput?.(row)}
                                    >
                                        →
                                    </button>
                                </td>
                            )}
                            {canEdit && (
                                <td>
                                    <button
                                        type="button"
                                        className={styles.fileItemDel}
                                        onClick={() => onRemoveRow(row)}
                                        title="Ўчириш"
                                    >
                                        ✕
                                    </button>
                                </td>
                            )}
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function hasCuttingChanges(baseline: OrderCuttingLine[], draft: DraftCuttingRow[]): boolean {
    const diff = buildCuttingDiff(baseline, draft);
    return diff.toDelete.length > 0 || diff.toCreate.length > 0 || diff.toUpdate.length > 0;
}

function balanceRowKey(row: CuttingBalanceRow): string {
    return `${row.materialId}|${row.length}|${row.width}`;
}

function CuttingBalanceThumb({
    url,
    name,
    onPreview,
}: {
    url: string | null;
    name: string;
    onPreview?: () => void;
}) {
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        setFailed(false);
    }, [url]);
    if (!url || failed) {
        return <div className={styles.cuttingCatalogThumbPlaceholder}>📦</div>;
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={url}
            alt={name}
            className={`${styles.cuttingCatalogThumb} ${
                onPreview ? styles.cuttingCatalogThumbClickable : ''
            }`}
            onError={() => setFailed(true)}
            onClick={
                onPreview
                    ? e => {
                          e.stopPropagation();
                          onPreview();
                      }
                    : undefined
            }
            title={onPreview ? 'Расмни катталаштириш' : undefined}
        />
    );
}

function CuttingBalancesCatalog({
    groups,
    canEdit,
    materialImage,
    onPickSize,
    emptyText = 'Қолдиқлар йўқ',
}: {
    groups: CuttingBalanceGroup[];
    canEdit: boolean;
    materialImage: (materialId: number) => string | null;
    onPickSize: (row: CuttingBalanceRow) => void;
    emptyText?: string;
}) {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

    const toggle = useCallback((materialId: number) => {
        setExpandedId(prev => (prev === materialId ? null : materialId));
    }, []);

    if (groups.length === 0) {
        return <div className={styles.cuttingCatalogEmpty}>{emptyText}</div>;
    }

    return (
        <>
            <div className={styles.cuttingCatalogList}>
                {groups.map(group => {
                const isOpen = expandedId === group.materialId;
                const negativeGroup = group.totalQty < -0.000001;
                const groupImage = materialImage(group.materialId);
                return (
                    <div
                        key={group.materialId}
                        className={`${styles.cuttingCatalogGroup} ${
                            isOpen ? styles.cuttingCatalogGroupActive : ''
                        }`}
                    >
                        <button
                            type="button"
                            className={styles.cuttingCatalogGroupHeader}
                            onClick={() => toggle(group.materialId)}
                            aria-expanded={isOpen}
                        >
                            <span className={styles.cuttingCatalogChevron}>{isOpen ? '▾' : '▸'}</span>
                            <CuttingBalanceThumb
                                url={groupImage}
                                name={group.name}
                                onPreview={
                                    groupImage
                                        ? () => setPreview({ url: groupImage, name: group.name })
                                        : undefined
                                }
                            />
                            <span className={styles.cuttingCatalogGroupInfo}>
                                <span className={styles.cuttingCatalogGroupName}>{group.name}</span>
                                <span className={styles.cuttingCatalogGroupArticle}>
                                    Арт.: {group.article || '—'}
                                </span>
                            </span>
                            <span className={styles.cuttingCatalogGroupSummary}>
                                <span className={styles.cuttingCatalogGroupSizes}>{group.sizes.length} ўлчам</span>
                                <span
                                    className={
                                        negativeGroup ? styles.cuttingBalancesQtyNegative : undefined
                                    }
                                >
                                    Қолдиқ: {formatWorksNumberDisplay(String(group.totalQty), 2)}
                                </span>
                                <span>{formatWorksNumberDisplay(String(group.totalAreaM2), 2)} м²</span>
                            </span>
                        </button>
                        {isOpen && (
                            <div className={styles.cuttingCatalogSizes}>
                                <table
                                    className={`${styles.cuttingBalancesTable} ${styles.worksTableBordered}`}
                                >
                                    <thead>
                                        <tr>
                                            <th>Узунлик</th>
                                            <th>Эни</th>
                                            <th>Қолдиқ</th>
                                            <th className={styles.cuttingAreaCol}>м²</th>
                                            {canEdit && (
                                                <th className={styles.cuttingBalancesActionCol}>Расход</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.sizes.map(row => {
                                            const negative = row.remainQty < -0.000001;
                                            return (
                                                <tr
                                                    key={balanceRowKey(row)}
                                                    className={
                                                        negative
                                                            ? styles.cuttingBalancesRowNegative
                                                            : undefined
                                                    }
                                                >
                                                    <td>{formatWorksNumberDisplay(String(row.length), 2)}</td>
                                                    <td>{formatWorksNumberDisplay(String(row.width), 2)}</td>
                                                    <td
                                                        className={
                                                            negative
                                                                ? styles.cuttingBalancesQtyNegative
                                                                : undefined
                                                        }
                                                    >
                                                        {formatWorksNumberDisplay(String(row.remainQty), 2)}
                                                        {negative ? ' ⚠' : ''}
                                                    </td>
                                                    <td className={styles.cuttingAreaCol}>
                                                        {formatCuttingAreaM2(
                                                            row.length,
                                                            row.width,
                                                            row.remainQty,
                                                        )}
                                                    </td>
                                                    {canEdit && (
                                                        <td className={styles.cuttingBalancesActionCol}>
                                                            <button
                                                                type="button"
                                                                className={
                                                                    styles.cuttingBalancesTransferBtn
                                                                }
                                                                title="Расход жадвалига қўшиш"
                                                                onClick={() => onPickSize(row)}
                                                            >
                                                                Расходга →
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
            </div>
            {preview && (
                <ImageModal
                    isOpen
                    imageUrl={preview.url}
                    imageName={preview.name}
                    onClose={() => setPreview(null)}
                />
            )}
        </>
    );
}

function CuttingBalancesFilterControls({
    materialFilter,
    onMaterialFilterChange,
    materialOptions,
    onRefresh,
}: {
    materialFilter: string;
    onMaterialFilterChange: (v: string) => void;
    materialOptions: SearchableTableSelectOption[];
    onRefresh: () => void;
}) {
    return (
        <div className={styles.cuttingBalancesPanelActions}>
            <label className={styles.cuttingBalancesFilter}>
                Материал
                <select value={materialFilter} onChange={e => onMaterialFilterChange(e.target.value)}>
                    <option value="">Барчаси</option>
                    {materialOptions.map(m => (
                        <option key={m.id} value={m.id}>
                            {m.name}
                        </option>
                    ))}
                </select>
            </label>
            <button type="button" className={styles.cuttingBalancesRefreshBtn} onClick={onRefresh}>
                Янгилаш
            </button>
        </div>
    );
}

function CuttingBalancesPanel({
    groups,
    isLoading,
    error,
    materialFilter,
    onMaterialFilterChange,
    materialOptions,
    materialImage,
    onRefresh,
    hasUnsavedChanges,
    canEdit,
    onPickSize,
    onOpenCatalog,
}: {
    groups: CuttingBalanceGroup[];
    isLoading: boolean;
    error: unknown;
    materialFilter: string;
    onMaterialFilterChange: (v: string) => void;
    materialOptions: SearchableTableSelectOption[];
    materialImage: (materialId: number) => string | null;
    onRefresh: () => void;
    hasUnsavedChanges: boolean;
    canEdit: boolean;
    onPickSize: (row: CuttingBalanceRow) => void;
    onOpenCatalog: () => void;
}) {
    return (
        <section className={styles.cuttingBalancesPanel}>
            <div className={styles.cuttingBalancesPanelHeader}>
                <h3 className={styles.cuttingBalancesPanelTitle}>Ҳозирги қолдиқлар (барча заявкалар)</h3>
                <div className={styles.cuttingBalancesPanelActions}>
                    <CuttingBalancesFilterControls
                        materialFilter={materialFilter}
                        onMaterialFilterChange={onMaterialFilterChange}
                        materialOptions={materialOptions}
                        onRefresh={onRefresh}
                    />
                    <button
                        type="button"
                        className={styles.cuttingCatalogOpenBtn}
                        onClick={onOpenCatalog}
                        title="Каталогни тўлиқ экранда очиш"
                    >
                        Каталог
                    </button>
                </div>
            </div>
            {hasUnsavedChanges && (
                <p className={styles.cuttingSectionHint} style={{ margin: 0 }}>
                    Сақланмаган қаторларда «Қолдиқ» — taxminiy (сақланмаган расход/приход ҳисобга олинган). Сақлагандан кейин янгиланг.
                </p>
            )}
            {isLoading && <div className={styles.cuttingBalancesStatus}>Қолдиқлар юкланмоқда...</div>}
            {error != null ? (
                <div className={styles.cuttingBalancesStatus} style={{ color: '#c62828' }}>
                    Хатолик: {error instanceof Error ? error.message : String(error)}
                </div>
            ) : null}
            {!isLoading && !error && (
                <div className={styles.cuttingCatalogInlineScroll}>
                    <CuttingBalancesCatalog
                        groups={groups}
                        canEdit={canEdit}
                        materialImage={materialImage}
                        onPickSize={onPickSize}
                    />
                </div>
            )}
        </section>
    );
}

function CuttingBalancesModal({
    open,
    onClose,
    groups,
    isLoading,
    error,
    materialFilter,
    onMaterialFilterChange,
    materialOptions,
    materialImage,
    onRefresh,
    canEdit,
    onPickSize,
}: {
    open: boolean;
    onClose: () => void;
    groups: CuttingBalanceGroup[];
    isLoading: boolean;
    error: unknown;
    materialFilter: string;
    onMaterialFilterChange: (v: string) => void;
    materialOptions: SearchableTableSelectOption[];
    materialImage: (materialId: number) => string | null;
    onRefresh: () => void;
    canEdit: boolean;
    onPickSize: (row: CuttingBalanceRow) => void;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className={styles.cuttingCatalogOverlay} onClick={onClose}>
            <div className={styles.cuttingCatalogModal} onClick={e => e.stopPropagation()}>
                <div className={styles.cuttingCatalogModalHeader}>
                    <h3 className={styles.cuttingBalancesPanelTitle}>Ҳозирги қолдиқлар (каталог)</h3>
                    <div className={styles.cuttingBalancesPanelActions}>
                        <CuttingBalancesFilterControls
                            materialFilter={materialFilter}
                            onMaterialFilterChange={onMaterialFilterChange}
                            materialOptions={materialOptions}
                            onRefresh={onRefresh}
                        />
                        <button
                            type="button"
                            className={styles.cuttingCatalogCloseBtn}
                            onClick={onClose}
                            title="Ёпиш"
                        >
                            ✕
                        </button>
                    </div>
                </div>
                <div className={styles.cuttingCatalogModalBody}>
                    {isLoading && (
                        <div className={styles.cuttingBalancesStatus}>Қолдиқлар юкланмоқда...</div>
                    )}
                    {error != null ? (
                        <div className={styles.cuttingBalancesStatus} style={{ color: '#c62828' }}>
                            Хатолик: {error instanceof Error ? error.message : String(error)}
                        </div>
                    ) : null}
                    {!isLoading && !error && (
                        <CuttingBalancesCatalog
                            groups={groups}
                            canEdit={canEdit}
                            materialImage={materialImage}
                            onPickSize={onPickSize}
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function CuttingExpenseQtyModal({
    row,
    available,
    materialImage,
    onConfirm,
    onClose,
}: {
    row: CuttingBalanceRow | null;
    available: number;
    materialImage: (materialId: number) => string | null;
    onConfirm: (row: CuttingBalanceRow, quantity: string) => void;
    onClose: () => void;
}) {
    const [qty, setQty] = useState('');

    useEffect(() => {
        if (!row) return;
        const def = available > 0.000001 ? String(Math.round(available * 1000) / 1000) : '';
        setQty(def);
    }, [row, available]);

    useEffect(() => {
        if (!row) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [row, onClose]);

    if (!row || typeof document === 'undefined') return null;

    const name = row.material?.name ?? `ID ${row.materialId}`;
    const article = row.material?.article?.trim() || '—';
    const imageUrl = materialImage(row.materialId);
    const parsed = parseCuttingQty(qty);
    const invalid = parsed == null || parsed <= 0 || parsed > available + 0.000001;

    return createPortal(
        <div className={styles.cuttingCatalogOverlay} onClick={onClose}>
            <div className={styles.cuttingQtyModal} onClick={e => e.stopPropagation()}>
                <div className={styles.cuttingCatalogModalHeader}>
                    <h3 className={styles.cuttingBalancesPanelTitle}>Расходга қўшиш</h3>
                    <button
                        type="button"
                        className={styles.cuttingCatalogCloseBtn}
                        onClick={onClose}
                        title="Ёпиш"
                    >
                        ✕
                    </button>
                </div>
                <div className={styles.cuttingQtyModalBody}>
                    <div className={styles.cuttingQtyModalProduct}>
                        <CuttingBalanceThumb url={imageUrl} name={name} />
                        <div className={styles.cuttingQtyModalInfo}>
                            <div className={styles.cuttingCatalogGroupName}>{name}</div>
                            <div className={styles.cuttingCatalogGroupArticle}>Арт.: {article}</div>
                            <div className={styles.cuttingQtyModalSize}>
                                Ўлчам: {formatWorksNumberDisplay(String(row.length), 2)} ×{' '}
                                {formatWorksNumberDisplay(String(row.width), 2)} мм
                            </div>
                            <div className={styles.cuttingQtyModalAvailable}>
                                Мавжуд қолдиқ: {formatWorksNumberDisplay(String(available), 2)} дона
                            </div>
                        </div>
                    </div>
                    <label className={styles.cuttingQtyModalField}>
                        Расход миқдори (дона)
                        <WorkNumericCell
                            value={qty}
                            className={`${styles.cellEditable} ${styles.cellEditableNum} ${styles.cuttingQtyModalInput}`}
                            onChange={setQty}
                        />
                    </label>
                    {invalid && qty.trim() !== '' && (
                        <div className={styles.cuttingQtyModalError}>
                            Миқдор 0 дан катта ва қолдиқдан ошмаслиги керак
                        </div>
                    )}
                </div>
                <div className={styles.cuttingQtyModalFooter}>
                    <button
                        type="button"
                        className={styles.cuttingBalancesRefreshBtn}
                        onClick={onClose}
                    >
                        Бекор
                    </button>
                    <button
                        type="button"
                        className={styles.saveInfoBtn}
                        style={{ marginTop: 0 }}
                        disabled={invalid}
                        onClick={() => onConfirm(row, qty)}
                    >
                        Қўшиш
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

export default function OrderCuttingTab({ order, token, canEdit, materialReferences, onUpdated }: Props) {
    const [issuesDraft, setIssuesDraft] = useState<DraftCuttingRow[]>([]);
    const [outputsDraft, setOutputsDraft] = useState<DraftCuttingRow[]>([]);
    const [savingIssues, setSavingIssues] = useState(false);
    const [savingOutputs, setSavingOutputs] = useState(false);
    const [balancesMaterialFilter, setBalancesMaterialFilter] = useState('');
    const [catalogModalOpen, setCatalogModalOpen] = useState(false);
    const [qtyModalRow, setQtyModalRow] = useState<CuttingBalanceRow | null>(null);
    const { pendingDraftId, requestFocus, clearFocus } = usePendingRowFocus();

    const enterpriseId = order.enterpriseId;
    const balancesKey =
        token && enterpriseId != null ? `cutting-balances-order-tab-${enterpriseId}` : null;

    const {
        data: savedBalances,
        error: balancesError,
        isLoading: balancesLoading,
        mutate: mutateBalances,
    } = useSWR<CuttingBalanceRow[]>(
        balancesKey,
        () => cuttingApi.getBalances(token, Number(enterpriseId), { hideZero: false }),
    );

    const baselineIssues = order.cuttingIssues ?? [];
    const baselineOutputs = order.cuttingOutputs ?? [];

    useEffect(() => {
        setIssuesDraft(baselineIssues.map(cuttingLineToDraft));
        setOutputsDraft(baselineOutputs.map(cuttingLineToDraft));
    }, [order.id, order.cuttingIssues, order.cuttingOutputs]);

    const sheetMaterialRefs = useMemo(
        () => materialReferences.filter(m => m.isSheetMaterial),
        [materialReferences],
    );

    const sheetMaterialSelectBaseOptions = useMemo(
        (): SearchableTableSelectOption[] => sheetMaterialRefs.map(refToSelectOption),
        [sheetMaterialRefs],
    );

    const getSheetMaterialSelectOptionsForRow = useCallback(
        (row: DraftCuttingRow): SearchableTableSelectOption[] => {
            const mid = row.materialId.trim();
            if (!mid) return sheetMaterialSelectBaseOptions;
            if (sheetMaterialSelectBaseOptions.some(o => o.id === mid)) {
                return sheetMaterialSelectBaseOptions;
            }
            const ref = materialReferences.find(m => String(m.id) === mid);
            if (!ref) return sheetMaterialSelectBaseOptions;
            return [refToSelectOption(ref), ...sheetMaterialSelectBaseOptions];
        },
        [sheetMaterialSelectBaseOptions, materialReferences],
    );

    const materialArticle = useCallback(
        (id: string) => materialReferences.find(m => String(m.id) === id)?.article?.trim() ?? '',
        [materialReferences],
    );

    const materialImage = useCallback(
        (materialId: number) =>
            buildMaterialImageUrl(
                materialReferences.find(m => m.id === materialId)?.imagePath,
            ),
        [materialReferences],
    );

    const issuesDirty = useMemo(() => hasCuttingChanges(baselineIssues, issuesDraft), [baselineIssues, issuesDraft]);
    const outputsDirty = useMemo(() => hasCuttingChanges(baselineOutputs, outputsDraft), [baselineOutputs, outputsDraft]);
    const hasUnsavedChanges = issuesDirty || outputsDirty;

    const previewBalanceByKey = useMemo(() => {
        const map = new Map<string, number>();
        for (const row of savedBalances ?? []) {
            const key = cuttingBalanceKey(row.materialId, row.length, row.width);
            if (key) map.set(key, row.remainQty);
        }
        const savedIssues = sumCuttingQtyByKey(baselineIssues);
        const savedOutputs = sumCuttingQtyByKey(baselineOutputs);
        const draftIssues = sumCuttingQtyByKey(issuesDraft);
        const draftOutputs = sumCuttingQtyByKey(outputsDraft);
        const allKeys = new Set([
            ...map.keys(),
            ...savedIssues.keys(),
            ...savedOutputs.keys(),
            ...draftIssues.keys(),
            ...draftOutputs.keys(),
        ]);
        for (const key of allKeys) {
            const base = map.get(key) ?? 0;
            const deltaIssues = (draftIssues.get(key) ?? 0) - (savedIssues.get(key) ?? 0);
            const deltaOutputs = (draftOutputs.get(key) ?? 0) - (savedOutputs.get(key) ?? 0);
            map.set(key, base - deltaIssues + deltaOutputs);
        }
        return map;
    }, [savedBalances, baselineIssues, baselineOutputs, issuesDraft, outputsDraft]);

    const getBalanceForRow = useCallback(
        (row: DraftCuttingRow): number | null => {
            const key = cuttingBalanceKey(row.materialId, row.length, row.width);
            if (!key) return null;
            return previewBalanceByKey.get(key) ?? 0;
        },
        [previewBalanceByKey],
    );

    const transferBalanceToIssue = useCallback(
        (balance: CuttingBalanceRow, qtyStr: string) => {
            const qty = parseCuttingQty(qtyStr);
            if (qty == null || qty <= 0) {
                alert('Расход миқдорини киритинг');
                return;
            }
            const key = cuttingBalanceKey(balance.materialId, balance.length, balance.width);
            if (!key) return;
            const available = previewBalanceByKey.get(key) ?? balance.remainQty;
            if (qty > available + 0.000001) {
                alert(
                    `Қолдиқ yetarli emas. Мавжуд: ${formatWorksNumberDisplay(String(available), 2)} дона`,
                );
                return;
            }
            setIssuesDraft(prev => {
                const existing = prev.find(
                    r => cuttingBalanceKey(r.materialId, r.length, r.width) === key,
                );
                if (existing) {
                    const cur = parseCuttingQty(existing.quantity) ?? 0;
                    return prev.map(r =>
                        r.draftId === existing.draftId
                            ? { ...r, quantity: String(cur + qty) }
                            : r,
                    );
                }
                const draft = emptyCuttingDraftRow(`i-${Date.now()}`);
                return [
                    ...prev,
                    {
                        ...draft,
                        materialId: String(balance.materialId),
                        length: String(balance.length),
                        width: String(balance.width),
                        quantity: String(qty),
                    },
                ];
            });
        },
        [previewBalanceByKey],
    );

    const balanceGroups = useMemo(() => {
        const rows = savedBalances ?? [];
        const filtered = balancesMaterialFilter
            ? rows.filter(b => b.materialId === Number(balancesMaterialFilter))
            : rows;
        return groupBalancesByMaterial(filtered);
    }, [savedBalances, balancesMaterialFilter]);

    const qtyModalAvailable = useMemo(() => {
        if (!qtyModalRow) return 0;
        const key = cuttingBalanceKey(qtyModalRow.materialId, qtyModalRow.length, qtyModalRow.width);
        if (!key) return qtyModalRow.remainQty;
        return previewBalanceByKey.get(key) ?? qtyModalRow.remainQty;
    }, [qtyModalRow, previewBalanceByKey]);

    const handleConfirmQty = useCallback(
        (row: CuttingBalanceRow, quantity: string) => {
            transferBalanceToIssue(row, quantity);
            setQtyModalRow(null);
        },
        [transferBalanceToIssue],
    );

    const transferIssueToOutput = useCallback((row: DraftCuttingRow) => {
        if (!row.materialId.trim()) {
            alert('Материал танланмаган');
            return;
        }
        setOutputsDraft(prev => [
            ...prev,
            {
                ...emptyCuttingDraftRow(`o-${Date.now()}`),
                materialId: row.materialId,
                length: '',
                width: '',
                quantity: '',
            },
        ]);
    }, []);

    const persistSection = async (
        kind: 'issues' | 'outputs',
        baseline: OrderCuttingLine[],
        draft: DraftCuttingRow[],
        setSaving: (v: boolean) => void,
    ) => {
        const { toDelete, toCreate, toUpdate } = buildCuttingDiff(baseline, draft);
        if (toDelete.length + toCreate.length + toUpdate.length === 0) {
            alert('Ўзгаришлар йўқ');
            return;
        }
        setSaving(true);
        const errors: string[] = [];
        try {
            for (const id of toDelete) {
                try {
                    if (kind === 'issues') await cuttingApi.deleteIssue(token, id);
                    else await cuttingApi.deleteOutput(token, id);
                } catch (e: unknown) {
                    errors.push(`Ўчириш id=${id}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            for (const row of toCreate) {
                try {
                    const payload = draftCuttingToPayload(order.id, row);
                    if (kind === 'issues') await cuttingApi.createIssue(token, payload);
                    else await cuttingApi.createOutput(token, payload);
                } catch (e: unknown) {
                    errors.push(`Қўшиш: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            for (const { id, row } of toUpdate) {
                try {
                    const body = draftCuttingToUpdateBody(row);
                    if (kind === 'issues') await cuttingApi.updateIssue(token, id, body);
                    else await cuttingApi.updateOutput(token, id, body);
                } catch (e: unknown) {
                    errors.push(`Янгилаш id=${id}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            try {
                onUpdated(await foApi.getOrder(token, order.id));
                await mutateBalances();
            } catch (e: unknown) {
                errors.push(`Қайта юклаш: ${e instanceof Error ? e.message : String(e)}`);
            }
            if (errors.length) alert(errors.join('\n'));
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    };

    const updateDraft = (
        setter: React.Dispatch<React.SetStateAction<DraftCuttingRow[]>>,
        draftId: string,
        field: keyof DraftCuttingRow,
        value: string,
    ) => {
        setter(prev => prev.map(r => (r.draftId === draftId ? { ...r, [field]: value } : r)));
    };

    return (
        <div className={styles.cuttingTab}>
            {/* <p className={styles.cuttingIntro}>
                Бошланғич қолдиқларни «Приход» бўлимига киритинг. Расход — раскройга кетган листлар; приход — раскройдан
                қолган обрезки. Қолдиқ = приход − расход (барча заявкалар).
            </p> */}

            {enterpriseId != null && (
                <CuttingBalancesPanel
                    groups={balanceGroups}
                    isLoading={balancesLoading}
                    error={balancesError}
                    materialFilter={balancesMaterialFilter}
                    onMaterialFilterChange={setBalancesMaterialFilter}
                    materialOptions={sheetMaterialSelectBaseOptions}
                    materialImage={materialImage}
                    onRefresh={() => mutateBalances()}
                    hasUnsavedChanges={hasUnsavedChanges}
                    canEdit={canEdit}
                    onPickSize={setQtyModalRow}
                    onOpenCatalog={() => setCatalogModalOpen(true)}
                />
            )}

            {enterpriseId != null && (
                <CuttingBalancesModal
                    open={catalogModalOpen}
                    onClose={() => setCatalogModalOpen(false)}
                    groups={balanceGroups}
                    isLoading={balancesLoading}
                    error={balancesError}
                    materialFilter={balancesMaterialFilter}
                    onMaterialFilterChange={setBalancesMaterialFilter}
                    materialOptions={sheetMaterialSelectBaseOptions}
                    materialImage={materialImage}
                    onRefresh={() => mutateBalances()}
                    canEdit={canEdit}
                    onPickSize={setQtyModalRow}
                />
            )}

            {canEdit && (
                <CuttingExpenseQtyModal
                    row={qtyModalRow}
                    available={qtyModalAvailable}
                    materialImage={materialImage}
                    onConfirm={handleConfirmQty}
                    onClose={() => setQtyModalRow(null)}
                />
            )}

            <section className={styles.cuttingSection}>
                <h3 className={styles.cuttingSectionTitle}>Расход материалов</h3>
                <p className={styles.cuttingSectionHint}>Раскройга кетган материал (узунлик, эни, миқдор).</p>
                <CuttingTableBlock
                    rows={issuesDraft}
                    canEdit={canEdit}
                    getMaterialOptionsForRow={getSheetMaterialSelectOptionsForRow}
                    materialArticle={materialArticle}
                    addRowDisabled
                    dimensionsReadOnly
                    showTransferToOutput
                    onTransferToOutput={transferIssueToOutput}
                    onAddRow={() => setIssuesDraft(prev => [...prev, emptyCuttingDraftRow(`i-${Date.now()}`)])}
                    onRemoveRow={row => {
                        if (row.serverId != null && !confirm('Ўчириш?')) return;
                        setIssuesDraft(prev => prev.filter(r => r.draftId !== row.draftId));
                    }}
                    onUpdateRow={(id, field, value) => updateDraft(setIssuesDraft, id, field, value)}
                    onSave={() => persistSection('issues', baselineIssues, issuesDraft, setSavingIssues)}
                    saving={savingIssues}
                    dirty={issuesDirty}
                    getBalanceForRow={getBalanceForRow}
                />
            </section>

            <section className={styles.cuttingSection}>
                <h3 className={styles.cuttingSectionTitle}>Приход материалов (после раскроя)</h3>
                <p className={styles.cuttingSectionHint}>Раскройдан қолган ёки складга келган кесимлар.</p>
                <CuttingTableBlock
                    rows={outputsDraft}
                    canEdit={canEdit}
                    getMaterialOptionsForRow={getSheetMaterialSelectOptionsForRow}
                    materialArticle={materialArticle}
                    onAddRow={() => {
                        const draftId = `o-${Date.now()}`;
                        setOutputsDraft(prev => [...prev, emptyCuttingDraftRow(draftId)]);
                        requestFocus(draftId);
                    }}
                    onRemoveRow={row => {
                        if (row.serverId != null && !confirm('Ўчириш?')) return;
                        setOutputsDraft(prev => prev.filter(r => r.draftId !== row.draftId));
                    }}
                    onUpdateRow={(id, field, value) => updateDraft(setOutputsDraft, id, field, value)}
                    onSave={() => persistSection('outputs', baselineOutputs, outputsDraft, setSavingOutputs)}
                    saving={savingOutputs}
                    dirty={outputsDirty}
                    getBalanceForRow={getBalanceForRow}
                    focusDraftId={pendingDraftId}
                    onAutoFocusApplied={clearFocus}
                />
            </section>
        </div>
    );
}

