'use client'
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './furnitureOrderCard.module.css';
import { PriceClass } from '@/app/interfaces/reference.interface';
import { PricingTabPanel } from '@/app/components/pricingPolicy/PricingTabPanel';
import { ReferencesService } from '@/app/service/references/references.service';
import { useAppContext } from '@/app/context/app.context';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import DeptGanttModal, { type DeptSchedule } from './DeptGanttModal';
import {
    FurnitureOrder, FurnitureOrderType, OrderMaterial, OrderHalfstuff, OrderWork, OrderStageType,
    ORDER_TYPE_LABELS, STAGE_BG, STAGE_LABELS, WORK_STATUS_LABELS, PipelineStatus, WorkStatus, OrderStageFileMeta,
    TEMPORARILY_DISABLED_STAGES,
    UpdateFurnitureOrderPayload,
} from '@/app/interfaces/furnitureOrder.interface';
import type { DraftWorkRow } from './orderWorksDraft';
import {
    buildWorksDiff,
    countInOrderFromUnitAndFinished,
    draftRowToCreatePayload,
    draftRowToUpdatePayload,
    emptyDraftRow,
    orderWorkToDraft,
    recomputeDerived,
} from './orderWorksDraft';
import type { DraftMaterialRow } from './orderMaterialsDraft';
import {
    buildMaterialsDiff,
    draftMaterialToCreatePayload,
    draftMaterialToUpdateBody,
    emptyMaterialDraftRow,
    formatMaterialQtyFromCatalog,
    orderMaterialToDraft,
    withDerivedMaterialTotal,
} from './orderMaterialsDraft';
import type { DraftHalfstuffRow } from './orderHalfstuffsDraft';
import {
    buildHalfstuffsDiff,
    draftHalfstuffToCreatePayload,
    draftHalfstuffToUpdateBody,
    emptyHalfstuffDraftRow,
    orderHalfstuffToDraft,
    withDerivedHalfstuffTotal,
} from './orderHalfstuffsDraft';
import {
    draftCommonWorkToApiPayload,
    emptyCommonWorkDraftRow,
    orderCommonWorkToDraft,
    recomputeCommonWorkAmount,
    selectedOrderCommonWorksSum,
    type DraftCommonWorkRow,
} from './orderCommonWorksDraft';
import { orderCommonWorksApi } from '@/app/service/orderCommonWorks/orderCommonWorks.service';
import { getPereodicValue } from '@/app/components/reference/helpers/reference.functions';
import { FinishedProductCatalogPicker } from '@/app/components/furnitureOrders/finishedProductCatalogPicker';
import { OrderPriceSummary } from '@/app/components/furnitureOrders/OrderPriceSummary';
import {
    computeOrderTotal,
    resolveOrderPriceFromProduct,
    normalizeOrderPrice,
} from '@/app/components/furnitureOrders/helpers/orderPrice';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { getMaterialAveragePrice } from '@/app/service/documents/getMaterialAveragePrice';
import type { Product } from '@/app/interfaces/product.interface';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Schet } from '@/app/interfaces/report.interface';
import {
    COMMON_STORAGE_MISSING_MSG,
    fetchCommonMaterialStorageId,
    fetchHalfstuffWarehouseId,
    resolveHalfstuffStockPrice,
} from '@/app/components/furnitureOrders/productionWorkBoard/workExecutionHelpers';
import { SearchableTableSelect, type SearchableTableSelectOption } from '@/app/components/shared/searchableTableSelect/SearchableTableSelect';
import { applyNativeFocus, usePendingRowFocus } from '@/app/hooks/usePendingRowFocus';
import { formatWorksNumberDisplay, WorkEditableCell, WorkNumericCell } from './workTableCells';
import { getSettingPereodicValueForDateByKey } from '@/app/service/settings/getSettingPereodicValueForDateByKey';
import { productNormsApi } from '@/app/service/productNorms/productNorms.service';
import OrderCuttingTab from './orderCuttingTab';
import OrderStoreWorkTab from './orderStoreWorkTab';
import OrderProductionWorksTab from './orderProductionWorksTab';
import {
    canDrawingRoleAdvance,
    canDrawingRoleEditComposition,
    canDrawingRoleRevert,
    getTabsForStage,
    type FurnitureOrderTab,
} from './stageTabConfig';
import { UserRoles } from '@/app/interfaces/user.interface';

const QUEUE_MANAGE_ROLES: UserRoles[] = [
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.HEADGLOBAL,
    UserRoles.TEXNOLOG,
];

const WORK_STATUS_COLORS: Record<WorkStatus, string> = {
    OPEN: '#9e9e9e', PENDING: '#ff9800', IN_PROGRESS: '#2196f3', PAUSE: '#ff5722', DONE: '#4caf50',
};

const PIPE_COLORS: Record<PipelineStatus, string> = {
    PENDING: '#bdbdbd', ACTIVE: '#1976d2', DONE: '#4caf50', SKIPPED: '#eeeeee',
};

const QUEUE_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Кутилмоқда',
    ACTIVE: 'Жараёнда',
    DONE: 'Тугатилди',
};

const QUEUE_STATUS_CLASS: Record<string, string> = {
    PENDING: 'queueStatusPending',
    ACTIVE: 'queueStatusActive',
    DONE: 'queueStatusDone',
};

interface Props {
    order: FurnitureOrder;
    onClose: () => void;
    onUpdated: (order: FurnitureOrder) => void;
    onDeleted?: () => void;
}

type Tab = FurnitureOrderTab;
type FileField = 'filesFromScaling' | 'filesFromDrawing' | 'filesFromPricing' | 'filesFromStore' | 'filesFromDelivery';
type TechMapRow = {
    draftId: string;
    serverId?: number;
    deptId: string;
    sequence: string;
    status?: string;
};

const FILE_FIELD_BY_STAGE: Partial<Record<OrderStageType, FileField>> = {
    SCALING: 'filesFromScaling',
    DRAWING: 'filesFromDrawing',
    PRICING: 'filesFromPricing',
    STORE: 'filesFromStore',
    DELIVERY: 'filesFromDelivery',
};

const ALL_FILE_STAGES: Array<{ stage: OrderStageType; field: FileField }> = [
    { stage: 'SCALING', field: 'filesFromScaling' },
    { stage: 'DRAWING', field: 'filesFromDrawing' },
    { stage: 'PRICING', field: 'filesFromPricing' },
    { stage: 'STORE', field: 'filesFromStore' },
    { stage: 'DELIVERY', field: 'filesFromDelivery' },
];

const getFileIcon = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼';
    if (ext === 'pdf') return '📕';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    return '📄';
};

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
const isPdf = (url: string) => /\.pdf$/i.test(url);

type FurnitureOrderMaterialRef = {
    id: number;
    name: string;
    article?: string;
    unit?: string;
    costPriceInStart?: number;
    firstPrice?: number;
    isSheetMaterial?: boolean;
    imagePath?: string;
};

function materialPriceFallbackFromRefRow(row?: FurnitureOrderMaterialRef): number {
    if (!row) return 0;
    const c = Number(row.costPriceInStart);
    if (Number.isFinite(c) && c > 0) return c;
    const f = Number(row.firstPrice);
    if (Number.isFinite(f) && f > 0) return f;
    return 0;
}

function materialPriceFallbackFromProductRef(refValues?: Product['refValues']): number {
    if (!refValues) return 0;
    const c = Number(refValues.costPriceInStart);
    if (Number.isFinite(c) && c > 0) return c;
    const f = Number(refValues.firstPrice);
    if (Number.isFinite(f) && f > 0) return f;
    return 0;
}

const toInputDate = (ms?: number | string) => {
    if (ms == null || ms === '') return '';
    const num = typeof ms === 'string' ? Number(ms) : ms;
    if (!Number.isFinite(num)) return '';
    const d = new Date(num);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseFileList = (raw?: string): OrderStageFileMeta[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item): OrderStageFileMeta | null => {
                if (typeof item === 'string') {
                    // Legacy format: plain URL is hidden for client by default.
                    return { url: item, visibleToClient: false };
                }
                if (!item || typeof item !== 'object') return null;
                const value = item as Record<string, unknown>;
                const url = typeof value.url === 'string' ? value.url.trim() : '';
                if (!url) return null;
                const originalName =
                    typeof value.originalName === 'string'
                        ? value.originalName
                        : typeof value.originalname === 'string'
                            ? value.originalname
                            : undefined;
                return {
                    url,
                    originalName,
                    visibleToClient: value.visibleToClient === true || value.visibleToClient === 'true',
                };
            })
            .filter((item): item is OrderStageFileMeta => Boolean(item));
    } catch {
        return [];
    }
};

export default function FurnitureOrderCard({ order, onClose, onUpdated, onDeleted }: Props) {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const token = user?.token!;
    const enterpriseId = order.enterpriseId ?? user?.enterpriseId;

    const canManageProductionQueue = useMemo(() => {
        const role = user?.role;
        return role != null && QUEUE_MANAGE_ROLES.includes(role);
    }, [user?.role]);

    const halfstuffWarehouseKey =
        token && enterpriseId ? ['fo-halfstuff-warehouse', token, enterpriseId] : null;
    const { data: halfstuffWarehouseId } = useSWR<number | null>(
        halfstuffWarehouseKey,
        () => fetchHalfstuffWarehouseId(token, enterpriseId!),
    );
    const halfstuffWarehouseLoading = halfstuffWarehouseId === undefined;
    const halfstuffWarehouseMissing =
        !halfstuffWarehouseLoading && halfstuffWarehouseId == null;

    const commonMaterialStorageKey =
        token && enterpriseId ? ['fo-common-material-storage', token, enterpriseId] : null;
    const { data: commonMaterialStorageId } = useSWR<number | null>(
        commonMaterialStorageKey,
        () => fetchCommonMaterialStorageId(token, enterpriseId!),
    );
    const commonMaterialStorageLoading = commonMaterialStorageId === undefined;
    const commonMaterialStorageMissing =
        !commonMaterialStorageLoading && commonMaterialStorageId == null;

    const orderDateMs = useMemo(() => {
        const raw = order.orderDate ?? order.createdDate;
        if (raw != null && raw !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0) {
            return Number(raw);
        }
        return Date.now();
    }, [order.orderDate, order.createdDate]);

    const [tab, setTab] = useState<Tab>('info');
    const [advancing, setAdvancing] = useState(false);
    const [reverting, setReverting] = useState(false);
    const [advanceComment, setAdvanceComment] = useState('');
    const [productionDepts, setProductionDepts] = useState<{ id: number; name: string; article?: string }[]>([]);
    const [worksReferences, setWorksReferences] = useState<
        { id: number; name: string; article?: string; norma?: number; unit?: string; workDeptId?: number }[]
    >([]);
    const [worksDraft, setWorksDraft] = useState<DraftWorkRow[]>([]);
    const [savingWorks, setSavingWorks] = useState(false);
    const [commonWorksDraft, setCommonWorksDraft] = useState<DraftCommonWorkRow[]>([]);
    const [savingCommonWorks, setSavingCommonWorks] = useState(false);
    const [commonWorksCatalog, setCommonWorksCatalog] = useState<
        { id: number; name: string; unit?: string; firstPrice?: number }[]
    >([]);
    const [materialReferences, setMaterialReferences] = useState<FurnitureOrderMaterialRef[]>([]);
    const [materialArticleOverrides, setMaterialArticleOverrides] = useState<Record<number, string>>({});
    const [isMaterialCatalogOpen, setIsMaterialCatalogOpen] = useState(false);
    const [materialsDraft, setMaterialsDraft] = useState<DraftMaterialRow[]>([]);
    const [savingMaterials, setSavingMaterials] = useState(false);
    const [halfstuffReferences, setHalfstuffReferences] = useState<FurnitureOrderMaterialRef[]>([]);
    const [isHalfstuffCatalogOpen, setIsHalfstuffCatalogOpen] = useState(false);
    const [halfstuffsDraft, setHalfstuffsDraft] = useState<DraftHalfstuffRow[]>([]);
    const [savingHalfstuffs, setSavingHalfstuffs] = useState(false);
    const [importingFromCard, setImportingFromCard] = useState(false);
    const [savingInfo, setSavingInfo] = useState(false);
    const [editOrderDate, setEditOrderDate] = useState('');
    const [editDeadlineDate, setEditDeadlineDate] = useState('');
    const [editCount, setEditCount] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [loadingEditPrice, setLoadingEditPrice] = useState(false);
    const [editAnaliticId, setEditAnaliticId] = useState('');
    const [editAnaliticDisplayName, setEditAnaliticDisplayName] = useState('');
    const [editComment, setEditComment] = useState('');
    const [editDiscount, setEditDiscount] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showGantt, setShowGantt] = useState(false);
    const [deptSchedule, setDeptSchedule] = useState<DeptSchedule[] | null>(null);
    const [loadingGantt, setLoadingGantt] = useState(false);
    const [techMapDraft, setTechMapDraft] = useState<TechMapRow[]>([]);
    const { pendingDraftId, requestFocus, clearFocus, shouldFocus } = usePendingRowFocus();
    const [savingTechMap, setSavingTechMap] = useState(false);
    const [uploadVisibleToClient, setUploadVisibleToClient] = useState(false);
    const [salaryMonthRate, setSalaryMonthRate] = useState(0);
    const [orderPricingUsesComponents, setOrderPricingUsesComponents] = useState(false);
    const [orderProductPriceClass, setOrderProductPriceClass] = useState<PriceClass>(PriceClass.A);
    const [orderPricingMetaLoading, setOrderPricingMetaLoading] = useState(false);
    const [orderPricingMetaError, setOrderPricingMetaError] = useState('');
    const [deletingOrder, setDeletingOrder] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
    const [deleteConfirmError, setDeleteConfirmError] = useState('');

    const handleOpenGantt = async () => {
        if (!enterpriseId) return;
        setLoadingGantt(true);
        try {
            const data = await foApi.getDeptLoadAnalysis(token, enterpriseId, order.id);
            setDeptSchedule(data);
            setShowGantt(true);
        } catch (e) {
            alert('Хато: ' + (e as Error).message);
        } finally {
            setLoadingGantt(false);
        }
    };

    const formatDate = (ms?: number | string) => {
        if (ms == null || ms === '') return '—';
        const num = typeof ms === 'string' ? Number(ms) : ms;
        if (!Number.isFinite(num)) return '—';
        return new Date(num).toLocaleDateString('ru-RU');
    };

    const formatDateTime = (ms?: number | string) => {
        if (ms == null || ms === '') return '—';
        const num = typeof ms === 'string' ? Number(ms) : ms;
        if (!Number.isFinite(num)) return '—';
        const d = new Date(num);
        return `${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const activeStage = order.pipelineStages?.find(s => s.status === 'ACTIVE')?.stageName ?? order.currentStage;
    const visiblePipelineStages = useMemo(
        () =>
            (order.pipelineStages ?? [])
                .filter((s) => !TEMPORARILY_DISABLED_STAGES.includes(s.stageName))
                .sort((a, b) => a.sequence - b.sequence),
        [order.pipelineStages],
    );
    const cuttingPipelineStage = order.pipelineStages?.find(s => s.stageName === 'CUTTING');
    const canEditCutting =
        cuttingPipelineStage?.status === 'ACTIVE' ||
        activeStage === 'CUTTING' ||
        order.currentStage === 'CUTTING';

    const cardTabs = useMemo(
        (): Tab[] => getTabsForStage(activeStage, user?.role),
        [activeStage, user?.role],
    );

    const tabLabels: Record<Tab, string> = {
        info: 'Маълумот',
        scaling: 'Ўлчов',
        drawing: 'Чизма',
        works: 'Ишлар',
        commonWorks: 'Умумий ишлар',
        cutting: 'Раскрой',
        materials: 'Материаллар',
        halfstuffs: 'Ярим тайёр махсулот',
        pricing: 'Нархлаш',
        techMap: 'Технологик харита',
        processes: 'Жараенлар',
        history: 'Тарих',
        storeWork: 'Омбор ишлари',
        files: 'Файллар',
    };
    const canEditOrderCoreFields =
        activeStage === 'TALABGOR' ||
        activeStage === 'PRICING' ||
        activeStage === 'DOGOVOR';
    const canEditOrderDates = canEditOrderCoreFields;
    const canEditFinishedProduct = canEditOrderCoreFields;
    const canEditOrderQuantityAndPrice = canEditOrderCoreFields;
    const isDrawingRole = user?.role === UserRoles.DRAWING;
    const canEditCompositionTabs =
        !isDrawingRole || canDrawingRoleEditComposition(activeStage);
    const compositionLocked = !canEditCompositionTabs;
    const activeFileField = FILE_FIELD_BY_STAGE[activeStage];

    useEffect(() => {
        if (!cardTabs.includes(tab)) {
            setTab('info');
        }
    }, [cardTabs, tab]);

    useEffect(() => {
        const resolvedEnterpriseId = enterpriseId ?? undefined;
        foApi.getReferences(token, 'PRODUCTION_DEPTS', resolvedEnterpriseId).then(setProductionDepts).catch(() => setProductionDepts([]));
        foApi.getReferences(token, 'MATERIALS', resolvedEnterpriseId).then(setMaterialReferences).catch(() => setMaterialReferences([]));
        foApi.getReferences(token, 'HALFSTUFFS', resolvedEnterpriseId).then(setHalfstuffReferences).catch(() => setHalfstuffReferences([]));
        foApi.getReferences(token, 'WORKS', resolvedEnterpriseId).then(setWorksReferences).catch(() => setWorksReferences([]));
        ReferencesService.getReferencesByType('COMMON_WORKS', token)
            .then((list) =>
                setCommonWorksCatalog(
                    list
                        .filter((w) => !w.isFolder && w.id != null)
                        .map((w) => ({
                            id: Number(w.id),
                            name: w.name,
                            unit: w.refValues?.unit,
                            firstPrice: w.refValues?.firstPrice,
                        })),
                ),
            )
            .catch(() => setCommonWorksCatalog([]));
    }, [token, enterpriseId]);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        const raw = order.orderDate ?? order.createdDate;
        const dateMs = raw != null && raw !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : Date.now();
        void (async () => {
            const rate = await getSettingPereodicValueForDateByKey(
                'salary.month',
                dateMs,
                token,
                enterpriseId ?? undefined,
            );
            if (!cancelled) setSalaryMonthRate(rate);
        })();
        return () => {
            cancelled = true;
        };
    }, [token, enterpriseId, order.orderDate, order.createdDate]);

    const serverWorksKey = useMemo(
        () =>
            JSON.stringify(
                (order.works ?? [])
                    .slice()
                    .sort((a, b) => a.id - b.id)
                    .map(w => [
                        w.id,
                        w.lineIndex ?? '',
                        w.workRefId ?? '',
                        w.workName,
                        w.workArticle ?? '',
                        w.assignedDeptId ?? '',
                        w.unit ?? '',
                        w.hourRate ?? '',
                        w.countInUnit ?? '',
                        w.finishedProductQty ?? '',
                        w.countInOrder ?? '',
                        w.timeInUnit ?? '',
                        w.timeInOrder ?? '',
                        w.salaryRate ?? '',
                        w.salaryInUnit ?? '',
                        w.salaryInOrder ?? '',
                    ]),
            ),
        [order.works],
    );

    useEffect(() => {
        setWorksDraft((order.works ?? []).map(orderWorkToDraft));
    }, [order.id, serverWorksKey]);

    const serverCommonWorksKey = useMemo(
        () =>
            JSON.stringify(
                (order.commonWorks ?? []).map((w) => [
                    w.id,
                    w.commonWorkRefId,
                    w.workName,
                    w.unit,
                    w.quantity,
                    w.price,
                    w.amount,
                    w.selected,
                ]),
            ),
        [order.commonWorks],
    );

    useEffect(() => {
        setCommonWorksDraft((order.commonWorks ?? []).map(orderCommonWorkToDraft));
    }, [order.id, serverCommonWorksKey]);

    const worksDirty = useMemo(() => {
        const d = buildWorksDiff(order.works ?? [], worksDraft);
        return d.toDelete.length + d.toCreate.length + d.toUpdate.length > 0;
    }, [order.works, worksDraft]);

    const commonWorksDirty = useMemo(() => {
        const server = JSON.stringify(
            (order.commonWorks ?? []).map((w) => [
                w.id,
                w.selected,
                w.quantity,
                w.price,
                w.amount,
                w.workName,
            ]),
        );
        const local = JSON.stringify(
            commonWorksDraft.map((w) => [
                w.serverId,
                w.selected,
                Number(w.quantity.replace(',', '.')) || 0,
                Number(w.price.replace(',', '.')) || 0,
                Number(w.amount.replace(',', '.')) || 0,
                w.workName,
            ]),
        );
        return server !== local;
    }, [order.commonWorks, commonWorksDraft]);

    const serverMaterialsKey = useMemo(
        () =>
            JSON.stringify(
                (order.materials ?? [])
                    .slice()
                    .sort((a, b) => a.id - b.id)
                    .map(m => [
                        m.id,
                        m.materialId,
                        m.price ?? '',
                        m.countPlanned ?? '',
                        m.finishedProductQty ?? '',
                        m.countInOrder ?? '',
                        m.total ?? '',
                    ]),
            ),
        [order.materials],
    );

    useEffect(() => {
        setMaterialsDraft((order.materials ?? []).map(m => orderMaterialToDraft(m, order.count)));
    }, [order.id, order.count, serverMaterialsKey]);

    const serverHalfstuffsKey = useMemo(
        () =>
            JSON.stringify(
                (order.halfstuffs ?? [])
                    .slice()
                    .sort((a, b) => a.id - b.id)
                    .map(h => [
                        h.id,
                        h.halfstuffId,
                        h.countPlanned ?? '',
                        h.finishedProductQty ?? '',
                        h.countInOrder ?? '',
                        h.price ?? '',
                        h.total ?? '',
                    ]),
            ),
        [order.halfstuffs],
    );

    useEffect(() => {
        setHalfstuffsDraft((order.halfstuffs ?? []).map(h => orderHalfstuffToDraft(h, order.count)));
    }, [order.id, order.count, serverHalfstuffsKey]);

    const materialsDirty = useMemo(() => {
        const d = buildMaterialsDiff(order.materials ?? [], materialsDraft);
        return d.toDelete.length + d.toCreate.length + d.toUpdate.length > 0;
    }, [order.materials, materialsDraft]);

    const halfstuffsDirty = useMemo(() => {
        const d = buildHalfstuffsDiff(order.halfstuffs ?? [], halfstuffsDraft);
        return d.toDelete.length + d.toCreate.length + d.toUpdate.length > 0;
    }, [order.halfstuffs, halfstuffsDraft]);

    const orderWorksSumForPricing = useMemo(
        () => selectedOrderCommonWorksSum(commonWorksDraft, Number(order.count) || 1),
        [commonWorksDraft, order.count],
    );
    const orderMaterialsSumForPricing = useMemo(() => {
        const sumRows = (rows: { total?: number; countInOrder?: number; price?: number }[]) =>
            rows.reduce((acc, m) => {
                const total = m.total;
                if (total != null && Number.isFinite(Number(total))) {
                    return acc + Number(total);
                }
                const cio = Number(m.countInOrder ?? 0);
                const p = Number(m.price ?? 0);
                return acc + cio * p;
            }, 0);
        return sumRows(order.materials ?? []) + sumRows(order.halfstuffs ?? []);
    }, [order.materials, order.halfstuffs]);

    const worksDraftSalaryInOrderTotal = useMemo(
        () =>
            worksDraft.reduce((acc, w) => {
                const t = String(w.salaryInOrder ?? '').trim();
                if (t === '') return acc;
                const n = Number(t.replace(',', '.'));
                return acc + (Number.isFinite(n) ? n : 0);
            }, 0),
        [worksDraft],
    );

    const materialsDraftSumTotal = useMemo(
        () =>
            materialsDraft.reduce((acc, row) => {
                const r = withDerivedMaterialTotal(row);
                const totalStr = String(r.total ?? '').trim();
                if (totalStr === '') return acc;
                const n = Number(totalStr.replace(',', '.'));
                return acc + (Number.isFinite(n) ? n : 0);
            }, 0),
        [materialsDraft],
    );

    const halfstuffsDraftSumTotal = useMemo(
        () =>
            halfstuffsDraft.reduce((acc, row) => {
                const r = withDerivedHalfstuffTotal(row);
                const totalStr = String(r.total ?? '').trim();
                if (totalStr === '') return acc;
                const n = Number(totalStr.replace(',', '.'));
                return acc + (Number.isFinite(n) ? n : 0);
            }, 0),
        [halfstuffsDraft],
    );

    useEffect(() => {
        if (tab !== 'pricing' || !token || !order.analiticId) {
            return;
        }
        let cancelled = false;
        setOrderPricingMetaLoading(true);
        setOrderPricingMetaError('');
        void Promise.all([
            productNormsApi.getPricing(token, order.analiticId),
            ReferencesService.getReferenceById(order.analiticId, token),
        ])
            .then(([pricing, productRef]) => {
                if (cancelled) return;
                setOrderPricingUsesComponents(pricing.usesComponents ?? false);
                setOrderProductPriceClass(productRef.refValues?.priceClass ?? PriceClass.A);
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setOrderPricingMetaError(e instanceof Error ? e.message : 'Хато');
                }
            })
            .finally(() => {
                if (!cancelled) setOrderPricingMetaLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [tab, token, order.analiticId]);

    const materialArticleDisplay = useCallback(
        (materialIdStr: string) => {
            if (!materialIdStr.trim()) return '';
            const refArt = materialReferences.find(m => String(m.id) === materialIdStr)?.article?.trim() ?? '';
            if (refArt) return refArt;
            const id = Number(materialIdStr);
            if (!Number.isFinite(id)) return '';
            return (materialArticleOverrides[id] ?? '').trim();
        },
        [materialReferences, materialArticleOverrides],
    );

    const materialUnitDisplay = useCallback(
        (materialIdStr: string) => {
            if (!materialIdStr.trim()) return '';
            return materialReferences.find(m => String(m.id) === materialIdStr)?.unit?.trim() ?? '';
        },
        [materialReferences],
    );

    const halfstuffArticleDisplay = useCallback(
        (halfstuffIdStr: string) => {
            if (!halfstuffIdStr.trim()) return '';
            return halfstuffReferences.find(h => String(h.id) === halfstuffIdStr)?.article?.trim() ?? '';
        },
        [halfstuffReferences],
    );

    const getHalfstuffSelectOptionsForRow = useCallback(
        (row: DraftHalfstuffRow): SearchableTableSelectOption[] => {
            const selectedId = row.halfstuffId.trim();
            const opts = halfstuffReferences.map(h => ({
                id: h.id,
                name: h.article ? `${h.article} — ${h.name}` : h.name,
            }));
            if (selectedId && !opts.some(o => String(o.id) === selectedId)) {
                const fromOrder = order.halfstuffs?.find(h => String(h.halfstuffId) === selectedId);
                if (fromOrder?.halfstuff?.name) {
                    opts.unshift({
                        id: Number(selectedId),
                        name: fromOrder.halfstuff.name,
                    });
                }
            }
            return opts;
        },
        [halfstuffReferences, order.halfstuffs],
    );

    const materialNameByIdFromOrder = useMemo(() => {
        return new Map(
            (order.materials ?? [])
                .filter(m => m.material?.name)
                .map(m => [String(m.materialId), m.material?.name?.trim() ?? '']),
        );
    }, [order.materials]);

    const materialSelectBaseOptions = useMemo(
        (): SearchableTableSelectOption[] =>
            materialReferences.map(m => ({
                id: m.id,
                name: m.article ? `${m.article} — ${m.name}` : m.name,
            })),
        [materialReferences],
    );

    const getMaterialSelectOptionsForRow = useCallback(
        (row: DraftMaterialRow): SearchableTableSelectOption[] => {
            const hasReferenceOption = materialReferences.some(
                material => String(material.id) === row.materialId,
            );
            if (!hasReferenceOption && row.materialId.trim()) {
                const fallbackName = materialNameByIdFromOrder.get(row.materialId) || '';
                const fallbackLabel = `${fallbackName || `ID ${row.materialId}`} (маълумотномада топилмади)`;
                return [{ id: row.materialId, name: fallbackLabel }, ...materialSelectBaseOptions];
            }
            return materialSelectBaseOptions;
        },
        [materialReferences, materialNameByIdFromOrder, materialSelectBaseOptions],
    );

    const workSelectBaseOptions = useMemo(
        (): SearchableTableSelectOption[] =>
            worksReferences
                .filter(w => w.id != null)
                .map(w => ({
                    id: w.id!,
                    name: w.name,
                })),
        [worksReferences],
    );

    const getWorkSelectOptionsForRow = useCallback(
        (row: DraftWorkRow): SearchableTableSelectOption[] => {
            const inList = worksReferences.some(w => String(w.id) === row.workRefId);
            if (!inList && row.workRefId.trim()) {
                return [{ id: row.workRefId, name: row.workName || `ID ${row.workRefId}` }, ...workSelectBaseOptions];
            }
            return workSelectBaseOptions;
        },
        [worksReferences, workSelectBaseOptions],
    );

    const productionDeptNameByIdFromOrder = useMemo(() => {
        return new Map(
            (order.productionQueue ?? [])
                .filter(item => item.dept?.name)
                .map(item => [String(item.deptId), item.dept?.name?.trim() ?? '']),
        );
    }, [order.productionQueue]);

    useEffect(() => {
        const rows = (order.productionQueue ?? [])
            .slice()
            .sort((a, b) => {
                const seqDiff = Number(a.sequence) - Number(b.sequence);
                if (seqDiff !== 0) return seqDiff;
                return Number(a.id) - Number(b.id);
            })
            .map((item, index) => ({
                draftId: `pq-${item.id}-${index}`,
                serverId: item.id,
                deptId: item.deptId == null ? '' : String(item.deptId),
                sequence: item.sequence == null ? '' : String(item.sequence),
                status: item.status,
            }));
        setTechMapDraft(rows);
    }, [order.id, order.productionQueue]);

    const techMapDirty = useMemo(() => {
        const baseline = (order.productionQueue ?? [])
            .slice()
            .sort((a, b) => {
                const seqDiff = Number(a.sequence) - Number(b.sequence);
                if (seqDiff !== 0) return seqDiff;
                return Number(a.id) - Number(b.id);
            })
            .map((item) => `${item.deptId}:${item.sequence}`)
            .join('|');
        const current = techMapDraft
            .map((item) => `${item.deptId.trim()}:${item.sequence.trim()}`)
            .join('|');
        return baseline !== current;
    }, [order.productionQueue, techMapDraft]);

    const worksCountByDept = useMemo(() => {
        const map = new Map<number, number>();
        for (const work of order.works ?? []) {
            const deptId = Number(work.assignedDeptId);
            if (!Number.isFinite(deptId) || deptId <= 0) continue;
            map.set(deptId, (map.get(deptId) ?? 0) + 1);
        }
        return map;
    }, [order.works]);

    const techMapEmptyDeptIds = useMemo(() => {
        const empty: number[] = [];
        for (const row of techMapDraft) {
            const deptId = Number(row.deptId);
            if (!Number.isFinite(deptId) || deptId <= 0) continue;
            if ((worksCountByDept.get(deptId) ?? 0) === 0) {
                empty.push(deptId);
            }
        }
        return empty;
    }, [techMapDraft, worksCountByDept]);

    useEffect(() => {
        setEditOrderDate(toInputDate(order.orderDate ?? order.createdDate));
        setEditDeadlineDate(toInputDate(order.deadlineDate));
        setEditCount(order.count == null ? '' : String(order.count));
        setEditPrice(order.price == null ? '' : String(Math.round(order.price)));
        setEditAnaliticId(order.analiticId == null ? '' : String(order.analiticId));
        setEditAnaliticDisplayName(order.analitic?.name ?? '');
        setEditComment(order.comment || '');
        setEditDiscount(order.discount == null ? '' : String(order.discount));
    }, [order]);

    const loadEditPriceForProduct = useCallback(
        async (productId: number, dateStr: string) => {
            if (!productId || !dateStr || !token) return;
            setLoadingEditPrice(true);
            try {
                const resolved = await resolveOrderPriceFromProduct(
                    token,
                    productId,
                    new Date(dateStr).getTime(),
                    enterpriseId ?? undefined,
                );
                if (resolved > 0) setEditPrice(String(normalizeOrderPrice(resolved)));
            } finally {
                setLoadingEditPrice(false);
            }
        },
        [token, enterpriseId],
    );

    const handleEditFinishedProductPick = useCallback(
        (id: number, name: string, quantity: number) => {
            setEditAnaliticId(String(id));
            setEditAnaliticDisplayName(name);
            setEditCount(String(quantity));
            void loadEditPriceForProduct(id, editOrderDate || toInputDate(order.orderDate ?? order.createdDate));
        },
        [loadEditPriceForProduct, editOrderDate, order.orderDate, order.createdDate],
    );

    const handleClearFinishedProduct = useCallback(() => {
        setEditAnaliticId('');
        setEditAnaliticDisplayName('');
    }, []);

    const handleAdvance = async () => {
        if (isDrawingRole && !canDrawingRoleAdvance(activeStage)) return;
        setAdvancing(true);
        try {
            const updated = await foApi.advanceStage(token, order.id, user?.id!, advanceComment || undefined);
            setAdvanceComment('');
            onUpdated(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setAdvancing(false);
        }
    };

    const handleRevert = async () => {
        if (!user?.id) return;
        if (isDrawingRole && !canDrawingRoleRevert(activeStage)) return;
        setReverting(true);
        try {
            const updated = await foApi.revertStage(token, order.id, user.id, advanceComment || undefined);
            setAdvanceComment('');
            onUpdated(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setReverting(false);
        }
    };

    const updateWorkDraft = useCallback(
        (
            draftId: string,
            field: keyof DraftWorkRow,
            value: string | WorkStatus,
            opts?: { salaryMonthRate?: number },
        ) => {
            const monthRate = opts?.salaryMonthRate ?? salaryMonthRate;
            setWorksDraft(prev =>
                prev.map(row => {
                    if (row.draftId !== draftId) return row;
                    let next: DraftWorkRow = { ...row, [field]: value } as DraftWorkRow;

                    if (field === 'workRefId') {
                        const ref = worksReferences.find(r => String(r.id) === value);
                        if (ref) {
                            next.workName = ref.name;
                            next.workArticle = ref.article ?? '';
                            if (ref.unit) next.unit = ref.unit;
                            if (ref.norma != null) next.hourRate = String(ref.norma);
                            if (ref.workDeptId != null && Number(ref.workDeptId) > 0) {
                                next.assignedDeptId = String(ref.workDeptId);
                            } else {
                                next.assignedDeptId = '';
                            }
                            const prevSalNum = Number(String(next.salaryRate).trim().replace(',', '.'));
                            const salaryMissingOrZero =
                                !String(next.salaryRate).trim() ||
                                !Number.isFinite(prevSalNum) ||
                                prevSalNum === 0;
                            if (monthRate > 0 && salaryMissingOrZero) {
                                next.salaryRate = String(monthRate);
                            }
                            const mult =
                                order.count != null && Number(order.count) > 0 ? Number(order.count) : 1;
                            next.finishedProductQty = String(mult);
                            next.countInOrder = countInOrderFromUnitAndFinished(next.countInUnit, next.finishedProductQty);
                            next = recomputeDerived(next, 'hourRate');
                            next = recomputeDerived(next, 'countInOrder');
                        } else {
                            next.workName = '';
                            next.workArticle = '';
                            next.assignedDeptId = '';
                            next.finishedProductQty = '';
                            next.countInOrder = '';
                            next = recomputeDerived(next, 'countInOrder');
                        }
                    }

                    if (field === 'countInUnit' && next.finishedProductQty.trim() !== '') {
                        next.countInOrder = countInOrderFromUnitAndFinished(next.countInUnit, next.finishedProductQty);
                    }

                    const baseKeys = ['hourRate', 'countInUnit', 'countInOrder', 'salaryRate'] as const;
                    if (baseKeys.includes(field as (typeof baseKeys)[number])) {
                        next = recomputeDerived(next, field as (typeof baseKeys)[number]);
                    }
                    if (field === 'countInUnit' && next.finishedProductQty.trim() !== '') {
                        next = recomputeDerived(next, 'countInOrder');
                    }
                    const calcKeys = ['timeInUnit', 'timeInOrder', 'salaryInUnit', 'salaryInOrder'] as const;
                    if (calcKeys.includes(field as (typeof calcKeys)[number])) {
                        next = {
                            ...next,
                            overrides: { ...next.overrides, [field as (typeof calcKeys)[number]]: true },
                        };
                    }
                    return next;
                }),
            );
        },
        [worksReferences, order.count, salaryMonthRate],
    );

    const handleWorkRefPick = useCallback(
        async (draftId: string, value: string) => {
            if (!value.trim()) {
                updateWorkDraft(draftId, 'workRefId', '');
                return;
            }
            if (!token) {
                updateWorkDraft(draftId, 'workRefId', value);
                return;
            }
            const raw = order.orderDate ?? order.createdDate;
            const dateMs =
                raw != null && raw !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0
                    ? Number(raw)
                    : Date.now();
            let rate = await getSettingPereodicValueForDateByKey(
                'salary.month',
                dateMs,
                token,
                enterpriseId ?? undefined,
            );
            if (!Number.isFinite(rate) || rate <= 0) {
                rate = await getSettingPereodicValueForDateByKey('salary.month', dateMs, token);
            }
            setSalaryMonthRate(rate);
            updateWorkDraft(draftId, 'workRefId', value, { salaryMonthRate: rate });
        },
        [token, enterpriseId, order.orderDate, order.createdDate, updateWorkDraft],
    );

    const addWorkDraftRow = () => {
        if (compositionLocked) return;
        const draftId = `t-${Date.now()}-${worksDraft.length}`;
        setWorksDraft(prev => [...prev, emptyDraftRow(draftId)]);
        requestFocus(draftId);
    };

    const removeWorkDraftRow = (row: DraftWorkRow) => {
        if (compositionLocked) return;
        if (row.serverId != null && !confirm('Ишни ўчириш? (сақлашда сервердан ҳам ўчирилади)')) return;
        setWorksDraft(prev => prev.filter(r => r.draftId !== row.draftId));
    };

    const handleSaveWorks = async () => {
        if (compositionLocked) return;
        const baseline = order.works ?? [];
        const { toDelete, toCreate, toUpdate } = buildWorksDiff(baseline, worksDraft);
        if (toDelete.length + toCreate.length + toUpdate.length === 0) {
            alert('Ўзгаришлар йўқ');
            return;
        }
        setSavingWorks(true);
        const errors: string[] = [];
        const newIdByDraftId = new Map<string, number>();
        try {
            for (const id of toDelete) {
                try {
                    await foApi.deleteWork(token, id);
                } catch (e: any) {
                    errors.push(`Ўчириш id=${id}: ${e.message}`);
                }
            }
            for (const r of toCreate) {
                try {
                    const payload = draftRowToCreatePayload(order.id, r);
                    const created = await foApi.createWork(token, payload);
                    const nid = Number(created.id);
                    if (!Number.isFinite(nid)) {
                        errors.push(`Қўшиш "${r.workName.trim() || '—'}": сервердан нотўғри id`);
                    } else {
                        newIdByDraftId.set(r.draftId, nid);
                    }
                } catch (e: any) {
                    errors.push(`Қўшиш "${r.workName.trim() || '—'}": ${e.message}`);
                }
            }
            for (const { id, row } of toUpdate) {
                try {
                    await foApi.updateWork(token, id, draftRowToUpdatePayload(row) as Partial<OrderWork>);
                } catch (e: any) {
                    errors.push(`Янгилаш id=${id}: ${e.message}`);
                }
            }

            if (errors.length === 0) {
                const orderedIds: number[] = [];
                for (const r of worksDraft) {
                    if (!r.workName.trim()) continue;
                    const raw = r.serverId ?? newIdByDraftId.get(r.draftId);
                    if (raw == null) continue;
                    const nid = Number(raw);
                    if (Number.isFinite(nid)) orderedIds.push(nid);
                }
                if (orderedIds.length > 0) {
                    try {
                        await foApi.setWorksLineOrder(token, order.id, orderedIds);
                    } catch (e: any) {
                        errors.push(`Тартиб: ${e.message}`);
                    }
                }
            }

            try {
                const updated = await foApi.getOrder(token, order.id);
                onUpdated(updated);
            } catch (e: any) {
                errors.push(`Рўйхатни қайта юклаш: ${e.message}`);
            }

            if (errors.length) {
                alert(errors.join('\n'));
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSavingWorks(false);
        }
    };

    const updateMaterialDraft = useCallback(
        (draftId: string, field: keyof DraftMaterialRow, value: string) => {
            const orderCount = order.count;
            const fpqFromOrder =
                orderCount != null && Number(orderCount) > 0 ? String(orderCount) : undefined;

            setMaterialsDraft(prev =>
                prev.map(row => {
                    if (row.draftId !== draftId) return row;
                    let next: DraftMaterialRow = { ...row, [field]: value };
                    if (field === 'materialId' && value.trim() && fpqFromOrder != null) {
                        next = { ...next, finishedProductQty: fpqFromOrder };
                    }
                    if (
                        field === 'countPlanned' ||
                        field === 'finishedProductQty' ||
                        field === 'price' ||
                        field === 'materialId'
                    ) {
                        return withDerivedMaterialTotal(next);
                    }
                    return next;
                }),
            );

            if (field === 'materialId' && value && token) {
                const mid = Number(value);
                if (Number.isFinite(mid) && mid > 0) {
                    getMaterialAveragePrice(mid, token).then(avgPrice => {
                        let priceToSet = avgPrice > 0 ? avgPrice : 0;
                        if (priceToSet === 0) {
                            const mat = materialReferences.find(m => m.id === mid);
                            const fallback = materialPriceFallbackFromRefRow(mat);
                            if (fallback > 0) priceToSet = fallback;
                        }
                        setMaterialsDraft(prev =>
                            prev.map(row => {
                                if (row.draftId !== draftId) return row;
                                return withDerivedMaterialTotal({ ...row, price: String(priceToSet) });
                            }),
                        );
                    });
                }
            }
        },
        [token, order.count, materialReferences],
    );

    const handleMaterialFromCatalog = useCallback(
        (product: Product, quantity: number) => {
            if (compositionLocked) return;
            const mid = product.id;
            const draftId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const orderCount = order.count;
            const fpq =
                orderCount != null && Number(orderCount) > 0 ? String(orderCount) : '';
            const qtyStr = formatMaterialQtyFromCatalog(quantity);

            const baseRow: DraftMaterialRow = {
                draftId,
                materialId: String(mid),
                finishedProductQty: fpq,
                countPlanned: qtyStr,
                countInOrder: '',
                price: '',
                total: '',
            };
            const row = withDerivedMaterialTotal(baseRow);
            setMaterialsDraft(prev => [...prev, row]);

            const art = product.article?.trim();
            if (art) {
                setMaterialArticleOverrides(prev => ({ ...prev, [mid]: art }));
            }

            if (token) {
                getMaterialAveragePrice(mid, token).then(avgPrice => {
                    let priceToSet = avgPrice > 0 ? avgPrice : 0;
                    if (priceToSet === 0) {
                        const fb = materialPriceFallbackFromProductRef(product.refValues);
                        if (fb > 0) priceToSet = fb;
                        if (priceToSet === 0) {
                            const mat = materialReferences.find(m => m.id === mid);
                            const fb2 = materialPriceFallbackFromRefRow(mat);
                            if (fb2 > 0) priceToSet = fb2;
                        }
                    }
                    setMaterialsDraft(prev =>
                        prev.map(r => {
                            if (r.draftId !== draftId) return r;
                            return withDerivedMaterialTotal({ ...r, price: String(priceToSet) });
                        }),
                    );
                });
            }
            setIsMaterialCatalogOpen(false);
        },
        [token, order.count, materialReferences, compositionLocked],
    );

    const addMaterialDraftRow = () => {
        if (compositionLocked) return;
        const draftId = `t-${Date.now()}-${materialsDraft.length}`;
        setMaterialsDraft(prev => [...prev, emptyMaterialDraftRow(draftId)]);
        requestFocus(draftId);
    };

    const removeMaterialDraftRow = (row: DraftMaterialRow) => {
        if (compositionLocked) return;
        if (row.serverId != null && !confirm('Материални ўчириш? (сақлашда сервердан ҳам ўчирилади)')) return;
        setMaterialsDraft(prev => prev.filter(r => r.draftId !== row.draftId));
    };

    const persistMaterialsChanges = useCallback(
        async (
            baseline: OrderMaterial[],
            draft: DraftMaterialRow[],
            options?: { silent?: boolean },
        ): Promise<FurnitureOrder | null> => {
            if (compositionLocked) return null;
            const { toDelete, toCreate, toUpdate } = buildMaterialsDiff(baseline, draft);
            if (toDelete.length + toCreate.length + toUpdate.length === 0) {
                if (!options?.silent) {
                    alert('Ўзгаришлар йўқ');
                }
                return null;
            }
            setSavingMaterials(true);
            const errors: string[] = [];
            try {
                for (const id of toDelete) {
                    try {
                        await foApi.deleteMaterial(token, id);
                    } catch (e: any) {
                        errors.push(`Ўчириш id=${id}: ${e.message}`);
                    }
                }
                for (const r of toCreate) {
                    try {
                        const payload = draftMaterialToCreatePayload(order.id, r);
                        await foApi.createMaterial(token, payload);
                    } catch (e: any) {
                        errors.push(`Қўшиш: ${e.message}`);
                    }
                }
                for (const { id, row } of toUpdate) {
                    if (!row.materialId.trim()) {
                        errors.push(`Янгилаш id=${id}: материални танланг`);
                        continue;
                    }
                    try {
                        const body = draftMaterialToUpdateBody(row);
                        await foApi.updateMaterial(token, id, body);
                    } catch (e: any) {
                        errors.push(`Янгилаш id=${id}: ${e.message}`);
                    }
                }

                try {
                    return await foApi.getOrder(token, order.id);
                } catch (e: any) {
                    errors.push(`Рўйхатни қайта юклаш: ${e.message}`);
                    return null;
                }
            } catch (e: any) {
                if (!options?.silent) {
                    alert(e.message);
                }
                throw e;
            } finally {
                setSavingMaterials(false);
                if (errors.length) {
                    alert(errors.join('\n'));
                }
            }
        },
        [token, order.id, compositionLocked],
    );

    const handleSaveMaterials = async () => {
        if (compositionLocked) return;
        try {
            const updated = await persistMaterialsChanges(order.materials ?? [], materialsDraft);
            if (updated) {
                onUpdated(updated);
            }
        } catch {
            // persistMaterialsChanges already surfaced errors
        }
    };

    const updateHalfstuffDraft = useCallback(
        (draftId: string, field: keyof DraftHalfstuffRow, value: string) => {
            const orderCount = order.count;
            const fpqFromOrder =
                orderCount != null && Number(orderCount) > 0 ? String(orderCount) : undefined;

            setHalfstuffsDraft(prev =>
                prev.map(row => {
                    if (row.draftId !== draftId) return row;
                    let next: DraftHalfstuffRow = { ...row, [field]: value };
                    if (field === 'halfstuffId' && value.trim() && fpqFromOrder != null) {
                        next = { ...next, finishedProductQty: fpqFromOrder };
                    }
                    if (
                        field === 'countPlanned' ||
                        field === 'finishedProductQty' ||
                        field === 'price' ||
                        field === 'halfstuffId'
                    ) {
                        return withDerivedHalfstuffTotal(next);
                    }
                    return next;
                }),
            );

            if (field === 'halfstuffId' && value && token && enterpriseId) {
                const hid = Number(value);
                if (Number.isFinite(hid) && hid > 0) {
                    const hs = halfstuffReferences.find(h => h.id === hid);
                    void resolveHalfstuffStockPrice(
                        token,
                        Number(enterpriseId),
                        hid,
                        orderDateMs,
                        hs
                            ? {
                                  firstPrice: hs.firstPrice,
                                  costPriceInStart: hs.costPriceInStart,
                              }
                            : null,
                    ).then(({ price: priceToSet }) => {
                        if (priceToSet <= 0) return;
                        setHalfstuffsDraft(prev =>
                            prev.map(row => {
                                if (row.draftId !== draftId) return row;
                                return withDerivedHalfstuffTotal({
                                    ...row,
                                    price: String(priceToSet),
                                });
                            }),
                        );
                    });
                }
            }
        },
        [order.count, halfstuffReferences, token, enterpriseId, orderDateMs],
    );

    const addHalfstuffDraftRow = () => {
        if (compositionLocked) return;
        const draftId = `t-${Date.now()}-${halfstuffsDraft.length}`;
        setHalfstuffsDraft(prev => [...prev, emptyHalfstuffDraftRow(draftId)]);
        requestFocus(draftId);
    };

    const removeHalfstuffDraftRow = (row: DraftHalfstuffRow) => {
        if (compositionLocked) return;
        if (row.serverId != null && !confirm('Полуфабрикатни ўчириш? (сақлашда сервердан ҳам ўчирилади)')) return;
        setHalfstuffsDraft(prev => prev.filter(r => r.draftId !== row.draftId));
    };

    const persistHalfstuffsChanges = useCallback(
        async (
            baseline: OrderHalfstuff[],
            draft: DraftHalfstuffRow[],
            options?: { silent?: boolean },
        ): Promise<FurnitureOrder | null> => {
            if (compositionLocked) return null;
            const { toDelete, toCreate, toUpdate } = buildHalfstuffsDiff(baseline, draft);
            if (toDelete.length + toCreate.length + toUpdate.length === 0) {
                if (!options?.silent) {
                    alert('Ўзгаришлар йўқ');
                }
                return null;
            }
            setSavingHalfstuffs(true);
            const errors: string[] = [];
            try {
                for (const id of toDelete) {
                    try {
                        await foApi.deleteHalfstuff(token, id);
                    } catch (e: any) {
                        errors.push(`Ўчириш id=${id}: ${e.message}`);
                    }
                }
                for (const r of toCreate) {
                    try {
                        const payload = draftHalfstuffToCreatePayload(order.id, r);
                        await foApi.createHalfstuff(token, payload);
                    } catch (e: any) {
                        errors.push(`Қўшиш: ${e.message}`);
                    }
                }
                for (const { id, row } of toUpdate) {
                    if (!row.halfstuffId.trim()) {
                        errors.push(`Янгилаш id=${id}: полуфабрикатни танланг`);
                        continue;
                    }
                    try {
                        const body = draftHalfstuffToUpdateBody(row);
                        await foApi.updateHalfstuff(token, id, body);
                    } catch (e: any) {
                        errors.push(`Янгилаш id=${id}: ${e.message}`);
                    }
                }

                try {
                    return await foApi.getOrder(token, order.id);
                } catch (e: any) {
                    errors.push(`Рўйхатни қайта юклаш: ${e.message}`);
                    return null;
                }
            } finally {
                setSavingHalfstuffs(false);
                if (errors.length) {
                    alert(errors.join('\n'));
                }
            }
        },
        [token, order.id, compositionLocked],
    );

    const handleSaveHalfstuffs = async () => {
        if (compositionLocked) return;
        try {
            const updated = await persistHalfstuffsChanges(order.halfstuffs ?? [], halfstuffsDraft);
            if (updated) {
                onUpdated(updated);
            }
        } catch {
            // persistHalfstuffsChanges already surfaced errors
        }
    };

    const handleHalfstuffFromCatalog = useCallback(
        (product: Product, quantity: number) => {
            if (compositionLocked) return;
            const hid = product.id;
            const draftId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const orderCount = order.count;
            const fpq =
                orderCount != null && Number(orderCount) > 0 ? String(orderCount) : '';
            const baseRow: DraftHalfstuffRow = {
                draftId,
                halfstuffId: String(hid),
                finishedProductQty: fpq,
                countPlanned: formatMaterialQtyFromCatalog(quantity),
                countInOrder: '',
                price: '',
                total: '',
            };
            setHalfstuffsDraft(prev => [...prev, withDerivedHalfstuffTotal(baseRow)]);
            setIsHalfstuffCatalogOpen(false);

            if (token && enterpriseId) {
                void resolveHalfstuffStockPrice(
                    token,
                    Number(enterpriseId),
                    hid,
                    orderDateMs,
                    {
                        firstPrice: product.refValues?.firstPrice,
                        costPriceInStart: product.refValues?.costPriceInStart,
                    },
                ).then(({ price: priceToSet }) => {
                    if (priceToSet <= 0) return;
                    setHalfstuffsDraft(prev =>
                        prev.map(r => {
                            if (r.draftId !== draftId) return r;
                            return withDerivedHalfstuffTotal({
                                ...r,
                                price: String(priceToSet),
                            });
                        }),
                    );
                });
            }
        },
        [order.count, token, enterpriseId, orderDateMs, compositionLocked],
    );

    const updateTechMapRow = (draftId: string, field: 'deptId' | 'sequence', value: string) => {
        if (compositionLocked) return;
        setTechMapDraft(prev => prev.map(row => row.draftId === draftId ? { ...row, [field]: value } : row));
    };

    const addTechMapRow = () => {
        if (compositionLocked) return;
        const draftId = `pq-new-${Date.now()}-${techMapDraft.length}`;
        setTechMapDraft(prev => [
            ...prev,
            {
                draftId,
                deptId: '',
                sequence: '',
            },
        ]);
        requestFocus(draftId);
    };

    const removeTechMapRow = (draftId: string) => {
        if (compositionLocked) return;
        setTechMapDraft(prev => prev.filter(row => row.draftId !== draftId));
    };

    const handleSaveTechMap = async () => {
        if (compositionLocked) return;
        const normalized = techMapDraft
            .map((row) => ({
                deptId: Number(row.deptId),
                sequence: Number(row.sequence),
            }))
            .filter((row) => Number.isFinite(row.deptId) && Number.isFinite(row.sequence) && row.sequence > 0);

        if (normalized.length === 0) {
            alert('Камида битта цех ва босқич рақамини киритинг');
            return;
        }
        if (normalized.length !== techMapDraft.length) {
            alert('Барча қаторларда цех ва босқич рақами тўлдирилиши керак');
            return;
        }

        const emptyDepts = normalized.filter((row) => (worksCountByDept.get(row.deptId) ?? 0) === 0);
        if (emptyDepts.length > 0) {
            alert(
                `Технологик харитада ишлари йўқ цехлар бор (ID: ${emptyDepts.map((row) => row.deptId).join(', ')}). Ишларни цехга бириктиринг ёки цехни ўчиринг.`,
            );
            return;
        }

        setSavingTechMap(true);
        try {
            const updated = await foApi.updateProductionQueue(token, order.id, normalized);
            onUpdated(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSavingTechMap(false);
        }
    };

    const handleSaveInfo = async () => {
        setSavingInfo(true);
        try {
            const patch: UpdateFurnitureOrderPayload = {
                comment: editComment || undefined,
            };
            if (canEditOrderDates) {
                patch.orderDate = editOrderDate ? new Date(editOrderDate).getTime() : undefined;
                patch.deadlineDate = editDeadlineDate ? new Date(editDeadlineDate).getTime() : undefined;
            }
            if (canEditOrderQuantityAndPrice) {
                patch.count = editCount ? Number(editCount) : undefined;
                patch.price = editPrice ? Number(editPrice) : undefined;
            }
            if (canEditFinishedProduct) {
                patch.analiticId = editAnaliticId ? Number(editAnaliticId) : undefined;
            }
            if (activeStage === 'PRICING') {
                patch.discount = editDiscount ? Number(editDiscount) : undefined;
            }
            const updated = await foApi.updateOrder(token, order.id, patch);
            onUpdated(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSavingInfo(false);
        }
    };

    const handleImportFromCard = async () => {
        if (compositionLocked) return;
        if (!order.analiticId) {
            alert('Аввал «Тайёр маҳсулот» майдонида тайёр маҳсулотни танланг');
            return;
        }
        const ok = confirm(
            'Карточкадан импорт ҳозирги ишлар, умумий ишлар, материаллар, ярим тайёр махсулотлар ва технологик харитани тўлиқ алмаштиради. Давом эттирасизми?',
        );
        if (!ok) return;
        setImportingFromCard(true);
        try {
            const imported = await foApi.importFromCard(token, order.id);
            let updated = await foApi.getOrder(token, order.id);
            // Не терять commonWorks, если последующие ответы их не вернули
            if (!(updated.commonWorks?.length) && (imported.commonWorks?.length)) {
                updated = { ...updated, commonWorks: imported.commonWorks };
            }
            // Fallback: если sync пуст, подтянуть с карточки ТМЗ напрямую
            if (!(updated.commonWorks?.length) && order.analiticId) {
                try {
                    const bundle = await productNormsApi.getBundle(token, Number(order.analiticId));
                    const fromCard = bundle.commonWorks ?? [];
                    if (fromCard.length > 0) {
                        const mult = Number(updated.count) > 0 ? Number(updated.count) : 1;
                        const payload = fromCard.map((w, i) => {
                            const quantity = Number(w.quantity ?? 0);
                            const price = Number(w.price ?? 0);
                            const amount =
                                w.amount != null && Number.isFinite(Number(w.amount))
                                    ? Number(w.amount)
                                    : quantity * price;
                            return {
                                orderId: order.id,
                                lineIndex: i,
                                commonWorkRefId: w.commonWorkRefId,
                                workName: w.workName,
                                unit: w.unit,
                                quantity,
                                price,
                                amount,
                                quantityInOrder: quantity * mult,
                                amountInOrder: amount * mult,
                                selected: Boolean(w.selected),
                            };
                        });
                        await orderCommonWorksApi.replaceForOrder(token, order.id, payload);
                        updated = await foApi.getOrder(token, order.id);
                    }
                } catch (fallbackErr) {
                    console.error('commonWorks fallback import failed', fallbackErr);
                }
            }
            const worksDraftNew = (updated.works ?? []).map(orderWorkToDraft);
            const commonWorksDraftNew = (updated.commonWorks ?? []).map(orderCommonWorkToDraft);
            const materialsDraftNew = (updated.materials ?? []).map(m =>
                orderMaterialToDraft(m, updated.count),
            );
            const halfstuffsDraftNew = (updated.halfstuffs ?? []).map(h =>
                orderHalfstuffToDraft(h, updated.count),
            );
            setWorksDraft(worksDraftNew);
            setCommonWorksDraft(commonWorksDraftNew);
            setMaterialsDraft(materialsDraftNew);
            setHalfstuffsDraft(halfstuffsDraftNew);
            const refreshed = await persistMaterialsChanges(
                updated.materials ?? [],
                materialsDraftNew,
                { silent: true },
            );
            const refreshed2 = await persistHalfstuffsChanges(
                refreshed?.halfstuffs ?? updated.halfstuffs ?? [],
                halfstuffsDraftNew,
                { silent: true },
            );
            const finalOrder = {
                ...(refreshed2 ?? refreshed ?? updated),
                commonWorks:
                    (refreshed2 ?? refreshed ?? updated).commonWorks?.length
                        ? (refreshed2 ?? refreshed ?? updated).commonWorks
                        : updated.commonWorks,
            };
            setCommonWorksDraft((finalOrder.commonWorks ?? []).map(orderCommonWorkToDraft));
            onUpdated(finalOrder);
            if (!(finalOrder.commonWorks?.length)) {
                alert(
                    'Умумий ишлар бўш. Карточка ТМЗда «ИшларУмумий»ни тўлдириб «Нормаларни сақлаш» қилинг, сўнг қайта импорт қилинг.',
                );
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setImportingFromCard(false);
        }
    };

    const handleUploadStageFiles = async (files: FileList | null, field: FileField) => {
        if (compositionLocked || !files) return;
        const currentList = parseFileList(order[field]);
        setSavingInfo(true);
        try {
            const uploadedFiles: OrderStageFileMeta[] = [];
            for (const file of Array.from(files)) {
                const uploaded = await foApi.uploadFurnitureOrderFile(token, file);
                uploadedFiles.push({
                    url: uploaded.url,
                    originalName: file.name,
                    visibleToClient: uploadVisibleToClient,
                });
            }
            const merged = [...currentList, ...uploadedFiles];
            const updated = await foApi.updateOrder(token, order.id, {
                [field]: JSON.stringify(merged),
            } satisfies UpdateFurnitureOrderPayload);
            onUpdated(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSavingInfo(false);
        }
    };

    const handleRemoveStageFile = async (url: string, field: FileField) => {
        if (compositionLocked) return;
        const merged = parseFileList(order[field]).filter(item => item.url !== url);
        setSavingInfo(true);
        try {
            const updated = await foApi.updateOrder(token, order.id, {
                [field]: JSON.stringify(merged),
            } satisfies UpdateFurnitureOrderPayload);
            onUpdated(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSavingInfo(false);
        }
    };

    const handleToggleStageFileVisible = async (field: FileField, url: string, visibleToClient: boolean) => {
        if (compositionLocked) return;
        const currentList = parseFileList(order[field]);
        const merged = currentList.map(item => (item.url === url ? { ...item, visibleToClient } : item));
        setSavingInfo(true);
        try {
            const updated = await foApi.updateOrder(token, order.id, {
                [field]: JSON.stringify(merged),
            } satisfies UpdateFurnitureOrderPayload);
            onUpdated(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSavingInfo(false);
        }
    };

    const openDeleteConfirm = () => {
        setDeleteConfirmInput('');
        setDeleteConfirmError('');
        setShowDeleteConfirm(true);
    };

    const closeDeleteConfirm = () => {
        if (deletingOrder) return;
        setShowDeleteConfirm(false);
        setDeleteConfirmInput('');
        setDeleteConfirmError('');
    };

    const handleConfirmDeleteOrder = async () => {
        const entered = deleteConfirmInput.trim();
        if (entered !== order.orderNumber) {
            setDeleteConfirmError('Номер заявки не совпадает');
            return;
        }
        setDeleteConfirmError('');
        setDeletingOrder(true);
        try {
            await foApi.deleteOrder(token, order.id);
            setShowDeleteConfirm(false);
            onDeleted?.();
        } catch (e: unknown) {
            setDeleteConfirmError(e instanceof Error ? e.message : 'Ошибка удаления заявки');
        } finally {
            setDeletingOrder(false);
        }
    };

    const currentPipeStage = order.pipelineStages?.find(s => s.status === 'ACTIVE');
    const isCompleted = order.currentStage === 'COMPLETED';
    const canAdvanceStage =
        !isCompleted &&
        Boolean(currentPipeStage) &&
        (!isDrawingRole || canDrawingRoleAdvance(activeStage));
    const canRevertStage =
        !isCompleted &&
        currentPipeStage != null &&
        currentPipeStage.stageName !== 'TALABGOR' &&
        (!isDrawingRole || canDrawingRoleRevert(activeStage));
    const resolvedOrderType = (order.orderType ?? 'individualPrice') as FurnitureOrderType;
    const modalTypeClass =
        resolvedOrderType === 'readyPrice' ? styles.modalReadyPrice : styles.modalIndividualPrice;
    const orderTypeBadgeClass =
        resolvedOrderType === 'readyPrice' ? styles.orderTypeBadgeReady : styles.orderTypeBadgeIndividual;
    const stageBg = STAGE_BG[order.currentStage] ?? '#9e9e9e';

    const renderStageFilesSection = (field: FileField, stage: OrderStageType) => {
        const fileList = parseFileList(order[field]);
        return (
            <section className={styles.infoSection}>
                <h3 className={styles.infoFilesSectionTitle}>Файллар — {STAGE_LABELS[stage]}</h3>
                <p className={styles.infoSectionHint}>Жорий босқич ({STAGE_LABELS[stage]}) учун ҳужжатлар.</p>
                <div className={styles.filesSection} style={{ marginTop: 0 }}>
                    <div className={styles.filesHeader}>
                        {canEditCompositionTabs && (
                            <>
                        <label className={styles.hint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                                type="checkbox"
                                checked={uploadVisibleToClient}
                                onChange={e => setUploadVisibleToClient(e.target.checked)}
                            />
                            Клиентга кўрсатиш
                        </label>
                        <label className={styles.uploadLabel}>
                            ↑ Файл юклаш
                            <input
                                className={styles.uploadInput}
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                onChange={e => { void handleUploadStageFiles(e.target.files, field); e.target.value = ''; }}
                            />
                        </label>
                            </>
                        )}
                    </div>
                    {savingInfo && <div className={styles.uploadingHint}>Юкланмоқда...</div>}
                    {fileList.length === 0 && !savingInfo && (
                        <div className={styles.hint}>Ҳали файл юкланмаган</div>
                    )}
                    <div className={styles.fileList}>
                        {fileList.map(file => {
                            const filename = file.originalName || file.url.split('/').pop() || file.url;
                            return (
                                <div key={file.url} className={styles.fileItem}>
                                    <a
                                        className={styles.fileItemName}
                                        href={`${process.env.NEXT_PUBLIC_DOMAIN}${file.url}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={filename}
                                    >
                                        📄 {filename}
                                    </a>
                                    <label className={styles.hint} style={{ marginRight: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <input
                                            type="checkbox"
                                            checked={file.visibleToClient}
                                            disabled={savingInfo || compositionLocked}
                                            onChange={e => {
                                                void handleToggleStageFileVisible(field, file.url, e.target.checked);
                                            }}
                                        />
                                        Клиент
                                    </label>
                                    {canEditCompositionTabs && (
                                    <button
                                        className={styles.fileItemDel}
                                        title="Ўчириш"
                                        onClick={() => { void handleRemoveStageFile(file.url, field); }}
                                    >
                                        ×
                                    </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        );
    };

    return (
        <div className={`${styles.modal} ${modalTypeClass}`}>
            {/* Top bar */}
            <div
                className={`${styles.topBar} ${styles.topBarByStage}`}
                style={{ background: stageBg, borderBottomColor: stageBg }}
            >
                <div>
                    <div className={styles.orderTitle}>{order.orderNumber} — {order.client?.name ?? `ID ${order.clientId}`} — {order.analitic?.name ?? '—'}</div>
                    <div className={styles.orderMeta}>
                        <span className={styles.stageBadgeTop}>
                            {STAGE_LABELS[order.currentStage]}
                        </span>
                        <span className={`${styles.orderTypeBadge} ${styles.orderTypeBadgeOnStage} ${orderTypeBadgeClass}`}>
                            {ORDER_TYPE_LABELS[resolvedOrderType]}
                        </span>
                        <span className={styles.orderMetaDates}>
                            Сана: {formatDate(order.orderDate ?? order.createdDate)} · Муддат:{' '}
                            {formatDate(order.deadlineDate)}
                        </span>
                    </div>
                </div>
                <div className={styles.topBarActions}>
                    <button
                        type="button"
                        className={styles.deleteOrderBtn}
                        onClick={openDeleteConfirm}
                        disabled={deletingOrder}
                    >
                        {deletingOrder ? 'Удаление…' : 'Удалить заявку'}
                    </button>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>
            </div>

            {/* Pipeline visual */}
            <div className={styles.pipeline}>
                {visiblePipelineStages.map((stage, i) => (
                    <div key={stage.id} className={styles.pipeStep}>
                        <div className={`${styles.pipeStepBox} ${stage.status === 'ACTIVE' ? styles.pipeActive : ''} ${stage.status === 'DONE' ? styles.pipeDone : ''}`}>
                            <div className={styles.pipeStepLabel}>{STAGE_LABELS[stage.stageName]}</div>
                            <div className={styles.pipeStepDot} style={{ background: PIPE_COLORS[stage.status] }} />
                        </div>
                        {i < visiblePipelineStages.length - 1 && <span className={styles.pipeArrow}>›</span>}
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                {cardTabs.map(t => (
                    <div key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
                        {tabLabels[t]}
                    </div>
                ))}
            </div>

            <div className={styles.body}>
                {/* INFO TAB */}
                {tab === 'info' && (
                    <div className={styles.infoTab}>
                        <section className={styles.infoSection}>
                            <div className={styles.infoFormCard}>
                                <div className={styles.infoFormInner}>
                                    <div className={styles.infoDatesProductRow}>
                                        {canEditOrderDates ? (
                                            <>
                                                <div className={styles.editField}>
                                                    <label className={styles.editLabel}>Сана</label>
                                                    <input
                                                        className={styles.editInput}
                                                        type="date"
                                                        value={editOrderDate}
                                                        onChange={(e) => {
                                                            setEditOrderDate(e.target.value);
                                                            if (editAnaliticId) {
                                                                void loadEditPriceForProduct(Number(editAnaliticId), e.target.value);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className={styles.editField}>
                                                    <label className={styles.editLabel}>Муддат</label>
                                                    <input className={styles.editInput} type="date" value={editDeadlineDate} onChange={e => setEditDeadlineDate(e.target.value)} />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className={styles.editField}>
                                                    <label className={styles.editLabel}>Сана</label>
                                                    <div className={styles.infoProductReadout}>
                                                        {formatDate(order.orderDate ?? order.createdDate)}
                                                    </div>
                                                </div>
                                                <div className={styles.editField}>
                                                    <label className={styles.editLabel}>Муддат</label>
                                                    <div className={styles.infoProductReadout}>
                                                        {formatDate(order.deadlineDate)}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {canEditFinishedProduct ? (
                                            <div className={`${styles.editField} ${styles.infoProductField}`}>
                                                <label className={styles.editLabel}>Тайёр маҳсулот (каталог)</label>
                                                <FinishedProductCatalogPicker
                                                    enterpriseId={enterpriseId ?? undefined}
                                                    warehouseId={user?.sectionId}
                                                    documentDate={editOrderDate ? new Date(editOrderDate).getTime() : Date.now()}
                                                    disabled={!enterpriseId}
                                                    displayName={editAnaliticDisplayName}
                                                    hasSelection={Boolean(editAnaliticId)}
                                                    selectedProductId={editAnaliticId ? Number(editAnaliticId) : undefined}
                                                    onPick={handleEditFinishedProductPick}
                                                    onClear={handleClearFinishedProduct}
                                                    readoutClassName={styles.editInput}
                                                    rowClassName={styles.infoProductPickerRow}
                                                />
                                            </div>
                                        ) : (
                                            <div className={`${styles.editField} ${styles.infoProductField}`}>
                                                <label className={styles.editLabel}>Тайёр маҳсулот</label>
                                                <div className={styles.infoProductReadout}>
                                                    <div className={styles.infoProductName}>
                                                        {order.analitic?.name ?? editAnaliticDisplayName ?? '—'}
                                                    </div>
                                                    {order.analitic?.article?.trim() ? (
                                                        <span className={styles.infoArticleBadge}>
                                                            Артикул: {order.analitic.article.trim()}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.editPriceRow}>
                                        <label className={styles.editLabel}>
                                            Миқдор × нарх = жами
                                            {loadingEditPrice ? ' (нарх юкланмоқда…)' : ''}
                                        </label>
                                        <OrderPriceSummary
                                            count={editCount}
                                            price={editPrice}
                                            onCountChange={canEditOrderQuantityAndPrice ? setEditCount : undefined}
                                            onPriceChange={canEditOrderQuantityAndPrice ? setEditPrice : undefined}
                                            countReadOnly={!canEditOrderQuantityAndPrice}
                                            priceReadOnly={!canEditOrderQuantityAndPrice}
                                        />
                                    </div>

                                    <div className={`${styles.editField} ${styles.infoCommentField}`}>
                                        <label className={styles.editLabel}>Буюртма изоҳи</label>
                                        <textarea
                                            className={styles.editTextarea}
                                            placeholder="Буюртма учун изоҳ киритинг..."
                                            value={editComment}
                                            onChange={e => setEditComment(e.target.value)}
                                        />
                                    </div>

                                </div>
                                <div className={styles.infoFormFooter}>
                                    <button type="button" className={styles.saveInfoBtn} style={{ marginTop: 0 }} onClick={handleSaveInfo} disabled={savingInfo}>
                                        {savingInfo ? 'Сақланмоқда...' : 'Сақлаш'}
                                    </button>
                                    <div className={styles.infoFormFooterRight}>
                                        {canRevertStage && (
                                            <button
                                                type="button"
                                                className={styles.revertBtn}
                                                onClick={handleRevert}
                                                disabled={reverting || advancing}
                                            >
                                                {reverting ? 'Қайтилмоқда...' : '← Олдинги босқичга'}
                                            </button>
                                        )}
                                        {canAdvanceStage && currentPipeStage && (
                                            <button
                                                type="button"
                                                className={styles.advanceBtn}
                                                onClick={handleAdvance}
                                                disabled={advancing || reverting}
                                            >
                                                {advancing ? 'Ўтилмоқда...' : `✓ "${STAGE_LABELS[currentPipeStage.stageName]}" босқичини якунла`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {activeFileField && activeStage !== 'SCALING' && activeStage !== 'DRAWING' && (
                            renderStageFilesSection(activeFileField, activeStage)
                        )}

                    </div>
                )}

                {tab === 'scaling' && renderStageFilesSection('filesFromScaling', 'SCALING')}

                {tab === 'drawing' && renderStageFilesSection('filesFromDrawing', 'DRAWING')}

                {/* WORKS TAB */}
                {tab === 'works' && (
                    <>
                        <div className={styles.worksToolbar}>
                            <div className={styles.worksToolbarLeft}>
                                {canEditCompositionTabs && (
                                    <>
                                <button type="button" className={styles.btnAdd} onClick={addWorkDraftRow}>
                                    + Қатор
                                </button>
                                <button
                                    type="button"
                                    className={styles.importFromCardBtn}
                                    onClick={handleImportFromCard}
                                    disabled={importingFromCard || !order.analiticId}
                                    title={!order.analiticId ? 'Аввал тайёр маҳсулотни танланг' : 'Ишлар, материаллар ва технологик харитани карточкадан алмаштириш'}
                                >
                                    {importingFromCard ? 'Импорт...' : 'Карточкадан импорт'}
                                </button>
                                <button
                                    type="button"
                                    className={styles.saveInfoBtn}
                                    onClick={handleSaveWorks}
                                    disabled={savingWorks || !worksDirty}
                                    style={{ marginTop: 0 }}
                                >
                                    {savingWorks ? 'Сақланмоқда...' : 'Сақлаш'}
                                </button>
                                {worksDirty && (
                                    <span className={styles.worksDirtyHint}>Сақланмаган ўзгаришлар бор</span>
                                )}
                                    </>
                                )}
                                <button
                                    type="button"
                                    className={styles.infoAnalyticsBtn}
                                    onClick={handleOpenGantt}
                                    disabled={loadingGantt}
                                    title="Цехлар бўйича юкланишни кўриш"
                                >
                                    <span aria-hidden>📅</span>
                                    <span>{loadingGantt ? 'Юкланмоқда...' : 'Цехлар юкланишини таҳлил қилиш'}</span>
                                </button>
                            </div>
                            {worksDraft.length > 0 && (
                                <div className={styles.worksToolbarTotals}>
                                    <div className={styles.worksToolbarTotalLine}>
                                        <span className={styles.worksToolbarTotalLabel}>Жами</span>
                                        <span className={styles.worksToolbarTotalValue}>
                                            {formatWorksNumberDisplay(String(worksDraftSalaryInOrderTotal), 2)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* <div className={styles.hint} style={{ marginBottom: 10 }}>
                            Меҳнат сарфи ва нарх: <code>ҳажм / ишлаб чиқариш нормаси</code>, нарх = меҳнат сарфи × норма-соат ёки ҳажм × нарх ставкаси.
                            Қўлда ўзгартирган майдонлар автоматик қайта ҳисобланмайди (норма/ҳажм/ставка ўзгаргунча).
                        </div> */}
                        <div className={styles.worksTableScroll}>
                            <table className={`${styles.worksTable} ${styles.worksTableWide}`}>
                                <thead>
                                    <tr>
                                        <th className={styles.cellNumHead}>№</th>
                                        <th>Артикул</th>
                                        <th>Номи</th>
                                        <th className={styles.worksColDept}>Цех</th>
                                        <th>Ўлч. б.</th>
                                        <th>Норма</th>
                                        <th>Тайёр маҳ. миқд.</th>
                                        <th className={styles.worksLaborColHead}>
                                            <div className={styles.worksLaborStackHead}>
                                                <div className={styles.worksLaborStackHeadRow}>Иш. ҳажм</div>
                                                <div className={styles.worksLaborStackHeadRow}>Буюрт. ҳажм</div>
                                            </div>
                                        </th>
                                        <th className={styles.worksLaborColHead}>
                                            <div className={styles.worksLaborStackHead}>
                                                <div className={styles.worksLaborStackHeadRow}>Меҳнат (и)</div>
                                                <div className={styles.worksLaborStackHeadRow}>Меҳнат (б)</div>
                                            </div>
                                        </th>
                                        <th>Норма-соат</th>
                                        <th className={`${styles.worksLaborColHead} ${styles.colSalaryOrder}`}>
                                            <div className={styles.worksLaborStackHead}>
                                                <div className={styles.worksLaborStackHeadRow}>Қиймат (и)</div>
                                                <div className={styles.worksLaborStackHeadRow}>Қиймат (б)</div>
                                            </div>
                                        </th>
                                        <th>Ҳолат</th>
                                        <th style={{ width: 36 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {worksDraft.length === 0 && (
                                        <tr>
                                            <td colSpan={13} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                                Ишлар йўқ — «+ Қатор» босинг
                                            </td>
                                        </tr>
                                    )}
                                    {worksDraft.map((row, rowIndex) => (
                                        <tr key={row.draftId}>
                                            <td className={styles.cellNum}>{rowIndex + 1}</td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {row.workArticle || '—'}
                                                </div>
                                            </td>
                                            <td style={{ position: 'relative', minWidth: 200 }}>
                                                <SearchableTableSelect
                                                    className={styles.materialSearchSelect}
                                                    options={getWorkSelectOptionsForRow(row)}
                                                    value={row.workRefId}
                                                    onChange={val => void handleWorkRefPick(row.draftId, val)}
                                                    placeholder="— Ишни танланг —"
                                                    disabled={compositionLocked}
                                                    autoFocus={shouldFocus(row.draftId)}
                                                    onAutoFocusApplied={clearFocus}
                                                />
                                            </td>
                                            <td className={styles.worksColDept}>
                                                <select
                                                    className={styles.cellSelectTable}
                                                    value={row.assignedDeptId}
                                                    disabled={compositionLocked}
                                                    onChange={e => updateWorkDraft(row.draftId, 'assignedDeptId', e.target.value)}
                                                >
                                                    <option value="">—</option>
                                                    {productionDepts.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <WorkEditableCell
                                                    value={row.unit}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNarrow}`}
                                                    onChange={v => updateWorkDraft(row.draftId, 'unit', v)}
                                                />
                                            </td>
                                            <td>
                                                <WorkNumericCell
                                                    value={row.hourRate}
                                                    title="Ишлаб чиқариш нормаси"
                                                    fractionDigits={4}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                    onChange={v => updateWorkDraft(row.draftId, 'hourRate', v)}
                                                />
                                            </td>
                                            <td>
                                                <div
                                                    className={styles.cellDerivedNum}
                                                    title="Буюртма бўйича тайёр маҳсулот миқдори; иш танланганда автоматик тўлдирилади"
                                                >
                                                    {row.finishedProductQty.trim() !== ''
                                                        ? formatWorksNumberDisplay(row.finishedProductQty, 3)
                                                        : '—'}
                                                </div>
                                            </td>
                                            <td className={styles.worksLaborCol}>
                                                <div className={styles.worksLaborStack}>
                                                    <div className={styles.worksLaborStackRow}>
                                                        <WorkNumericCell
                                                            value={row.countInUnit}
                                                            disabled={compositionLocked}
                                                            className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                            onChange={v => updateWorkDraft(row.draftId, 'countInUnit', v)}
                                                        />
                                                    </div>
                                                    <div className={styles.worksLaborStackRow}>
                                                        <WorkNumericCell
                                                            value={row.countInOrder}
                                                            disabled={compositionLocked}
                                                            className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                            onChange={v => updateWorkDraft(row.draftId, 'countInOrder', v)}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={styles.worksLaborCol}>
                                                <div className={styles.worksLaborStack}>
                                                    <div className={styles.worksLaborStackRow}>
                                                        <WorkNumericCell
                                                            value={row.timeInUnit}
                                                            title={row.overrides.timeInUnit ? 'Қўлда' : 'Автоматик'}
                                                            disabled={compositionLocked}
                                                            className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                            onChange={v => updateWorkDraft(row.draftId, 'timeInUnit', v)}
                                                        />
                                                    </div>
                                                    <div className={styles.worksLaborStackRow}>
                                                        <WorkNumericCell
                                                            value={row.timeInOrder}
                                                            disabled={compositionLocked}
                                                            className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                            onChange={v => updateWorkDraft(row.draftId, 'timeInOrder', v)}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <WorkNumericCell
                                                    value={row.salaryRate}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                    onChange={v => updateWorkDraft(row.draftId, 'salaryRate', v)}
                                                />
                                            </td>
                                            <td className={`${styles.worksLaborCol} ${styles.colSalaryOrder}`}>
                                                <div className={styles.worksLaborStack}>
                                                    <div className={styles.worksLaborStackRow}>
                                                        <WorkNumericCell
                                                            value={row.salaryInUnit}
                                                            disabled={compositionLocked}
                                                            className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                            onChange={v => updateWorkDraft(row.draftId, 'salaryInUnit', v)}
                                                        />
                                                    </div>
                                                    <div className={styles.worksLaborStackRow}>
                                                        <WorkNumericCell
                                                            value={row.salaryInOrder}
                                                            disabled={compositionLocked}
                                                            className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                            onChange={v => updateWorkDraft(row.draftId, 'salaryInOrder', v)}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span
                                                    className={styles.statusBadge}
                                                    style={{ background: WORK_STATUS_COLORS[row.workStatus] }}
                                                >
                                                    {WORK_STATUS_LABELS[row.workStatus]}
                                                </span>
                                            </td>
                                            <td>
                                                {canEditCompositionTabs && (
                                                <button
                                                    type="button"
                                                    className={styles.fileItemDel}
                                                    onClick={() => removeWorkDraftRow(row)}
                                                    title="Ўчириш"
                                                >
                                                    ✕
                                                </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {productionDepts.length === 0 && (
                            <div className={styles.hint}>
                                Ишлаб чиқариш цехлари рўйхати бўш — маълумотномада PRODUCTION омборларни текширинг.
                            </div>
                        )}
                    </>
                )}

                {tab === 'commonWorks' && (
                    <>
                        <div className={styles.worksToolbar}>
                            <div className={styles.worksToolbarLeft}>
                                {canEditCompositionTabs && (
                                    <>
                                <button
                                    type="button"
                                    className={styles.btnAdd}
                                    onClick={() => {
                                        const row = emptyCommonWorkDraftRow();
                                        setCommonWorksDraft((prev) => [...prev, row]);
                                        requestFocus(row.draftId);
                                    }}
                                >
                                    + Қатор
                                </button>
                                <button
                                    type="button"
                                    className={styles.importFromCardBtn}
                                    disabled={importingFromCard || !order.analiticId}
                                    onClick={handleImportFromCard}
                                    title={
                                        !order.analiticId
                                            ? 'Аввал тайёр маҳсулотни танланг'
                                            : 'Умумий ишларни карточкадан алмаштириш'
                                    }
                                >
                                    {importingFromCard ? 'Импорт...' : 'Карточкадан импорт'}
                                </button>
                                <button
                                    type="button"
                                    className={styles.btnImport}
                                    disabled={savingCommonWorks || !token}
                                                    onClick={() => {
                                        if (compositionLocked) return;
                                        if (
                                            commonWorksDraft.length > 0 &&
                                            !confirm('Жадвалдаги қаторлар алмаштирилади. Давом этишни хоҳлайсизми?')
                                        ) {
                                            return;
                                        }
                                        void (async () => {
                                            const raw =
                                                order.orderDate ?? order.createdDate ?? Date.now();
                                            const dateMs = Number(raw) > 0 ? Number(raw) : Date.now();
                                            const rows: DraftCommonWorkRow[] = [];
                                            for (const ref of commonWorksCatalog) {
                                                const price = await getPereodicValue(
                                                    ref.id,
                                                    'firstPrice',
                                                    token,
                                                    dateMs,
                                                    enterpriseId,
                                                );
                                                rows.push(
                                                    recomputeCommonWorkAmount({
                                                        ...emptyCommonWorkDraftRow(),
                                                        commonWorkRefId: String(ref.id),
                                                        workName: ref.name ?? '',
                                                        unit: ref.unit ?? '',
                                                        quantity: '0',
                                                        price: String(price || 0),
                                                        selected: false,
                                                    }),
                                                );
                                            }
                                            setCommonWorksDraft(rows);
                                        })();
                                    }}
                                >
                                    Умумий ишларни тулдириш
                                </button>
                                <button
                                    type="button"
                                    className={styles.saveInfoBtn}
                                    style={{ marginTop: 0 }}
                                    disabled={savingCommonWorks || !commonWorksDirty}
                                    onClick={() => {
                                        if (compositionLocked) return;
                                        void (async () => {
                                            setSavingCommonWorks(true);
                                            try {
                                                const payload = commonWorksDraft.map((row, i) =>
                                                    draftCommonWorkToApiPayload(
                                                        row,
                                                        order.id,
                                                        i,
                                                        Number(order.count) || 1,
                                                    ),
                                                );
                                                await orderCommonWorksApi.replaceForOrder(
                                                    token,
                                                    order.id,
                                                    payload,
                                                );
                                                const updated = await foApi.getOrder(token, order.id);
                                                onUpdated(updated);
                                            } catch (e: any) {
                                                alert(e.message);
                                            } finally {
                                                setSavingCommonWorks(false);
                                            }
                                        })();
                                    }}
                                >
                                    {savingCommonWorks ? 'Сақланмоқда…' : 'Сақлаш'}
                                </button>
                                {commonWorksDirty && (
                                    <span className={styles.worksDirtyHint}>Сақланмаган ўзгаришлар бор</span>
                                )}
                                    </>
                                )}
                            </div>
                            {commonWorksDraft.length > 0 && (
                                <div className={styles.worksToolbarTotals}>
                                    <div className={styles.worksToolbarTotalLine}>
                                        <span className={styles.worksToolbarTotalLabel}>Жами (танланган)</span>
                                        <span className={styles.worksToolbarTotalValue}>
                                            {formatWorksNumberDisplay(
                                                String(orderWorksSumForPricing),
                                                2,
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.worksTableScroll}>
                            <table className={`${styles.worksTable} ${styles.worksTableWide}`}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 48 }}>✓</th>
                                        <th>Общая работа</th>
                                        <th>Ед. изм</th>
                                        <th>Количество</th>
                                        <th>Цена</th>
                                        <th>Сумма</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {commonWorksDraft.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className={styles.hint}>
                                                Карточкадан импорт қилинг, «+ Қатор» ёки «Умумий ишларни тулдириш».
                                            </td>
                                        </tr>
                                    )}
                                    {commonWorksDraft.map((row) => {
                                        const selectOptions: SearchableTableSelectOption[] = (() => {
                                            const base = commonWorksCatalog.map((r) => ({
                                                id: r.id,
                                                name: r.name,
                                            }));
                                            const inList = base.some(
                                                (o) => String(o.id) === row.commonWorkRefId,
                                            );
                                            if (!inList && row.commonWorkRefId.trim()) {
                                                return [
                                                    {
                                                        id: row.commonWorkRefId,
                                                        name: row.workName || `ID ${row.commonWorkRefId}`,
                                                    },
                                                    ...base,
                                                ];
                                            }
                                            return base;
                                        })();
                                        return (
                                        <tr key={row.draftId}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    className={styles.worksSelectCheckbox}
                                                    checked={Boolean(row.selected)}
                                                    disabled={compositionLocked}
                                                    onChange={(e) => {
                                                        const selected = e.target.checked;
                                                        setCommonWorksDraft((prev) =>
                                                            prev.map((r) =>
                                                                r.draftId === row.draftId
                                                                    ? { ...r, selected }
                                                                    : r,
                                                            ),
                                                        );
                                                    }}
                                                />
                                            </td>
                                            <td style={{ position: 'relative', minWidth: 220 }}>
                                                <SearchableTableSelect
                                                    className={styles.materialSearchSelect}
                                                    options={selectOptions}
                                                    value={row.commonWorkRefId}
                                                    placeholder="— Ишни танланг —"
                                                    disabled={compositionLocked}
                                                    autoFocus={shouldFocus(row.draftId)}
                                                    onAutoFocusApplied={clearFocus}
                                                    onChange={(val) => {
                                                        void (async () => {
                                                            const ref = commonWorksCatalog.find(
                                                                (r) => String(r.id) === val,
                                                            );
                                                            const raw =
                                                                order.orderDate ??
                                                                order.createdDate ??
                                                                Date.now();
                                                            const dateMs =
                                                                Number(raw) > 0
                                                                    ? Number(raw)
                                                                    : Date.now();
                                                            let price = 0;
                                                            if (ref && token) {
                                                                price = await getPereodicValue(
                                                                    ref.id,
                                                                    'firstPrice',
                                                                    token,
                                                                    dateMs,
                                                                    enterpriseId,
                                                                );
                                                            }
                                                            setCommonWorksDraft((prev) =>
                                                                prev.map((r) => {
                                                                    if (r.draftId !== row.draftId) return r;
                                                                    if (!ref) {
                                                                        return recomputeCommonWorkAmount({
                                                                            ...r,
                                                                            commonWorkRefId: '',
                                                                            workName: '',
                                                                            unit: '',
                                                                            price: '0',
                                                                        });
                                                                    }
                                                                    return recomputeCommonWorkAmount({
                                                                        ...r,
                                                                        commonWorkRefId: String(ref.id),
                                                                        workName: ref.name ?? '',
                                                                        unit: ref.unit ?? '',
                                                                        price: String(price || 0),
                                                                    });
                                                                }),
                                                            );
                                                        })();
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {row.unit || '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <WorkNumericCell
                                                    value={row.quantity}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                    onChange={(v) => {
                                                        setCommonWorksDraft((prev) =>
                                                            prev.map((r) =>
                                                                r.draftId === row.draftId
                                                                    ? recomputeCommonWorkAmount({
                                                                          ...r,
                                                                          quantity: v,
                                                                      })
                                                                    : r,
                                                            ),
                                                        );
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <WorkNumericCell
                                                    value={row.price}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                    onChange={(v) => {
                                                        setCommonWorksDraft((prev) =>
                                                            prev.map((r) =>
                                                                r.draftId === row.draftId
                                                                    ? recomputeCommonWorkAmount({
                                                                          ...r,
                                                                          price: v,
                                                                      })
                                                                    : r,
                                                            ),
                                                        );
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {formatWorksNumberDisplay(row.amount || '0', 2)}
                                                </div>
                                            </td>
                                            <td>
                                                {canEditCompositionTabs && (
                                                <button
                                                    type="button"
                                                    className={styles.fileItemDel}
                                                    onClick={() => {
                                                        setCommonWorksDraft((prev) =>
                                                            prev.filter((r) => r.draftId !== row.draftId),
                                                        );
                                                    }}
                                                    title="Ўчириш"
                                                >
                                                    ✕
                                                </button>
                                                )}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {tab === 'cutting' && (
                    <OrderCuttingTab
                        order={order}
                        token={token}
                        canEdit={canEditCutting}
                        materialReferences={materialReferences}
                        onUpdated={onUpdated}
                    />
                )}

                {tab === 'storeWork' && (
                    <OrderStoreWorkTab
                        order={order}
                        token={token}
                        userId={user?.id}
                        readOnly={order.currentStage !== 'STORE'}
                        onOrderUpdated={onUpdated}
                    />
                )}

                {tab === 'processes' && (
                    <OrderProductionWorksTab
                        order={order}
                        token={token}
                        userId={user?.id!}
                        canManageQueue={canManageProductionQueue}
                        onOrderUpdated={onUpdated}
                    />
                )}

                {/* MATERIALS TAB */}
                {tab === 'materials' && (
                    <>
                        <div className={styles.worksToolbar}>
                            <div className={styles.worksToolbarLeft}>
                                {canEditCompositionTabs && (
                                    <>
                                <button type="button" className={styles.btnAdd} onClick={addMaterialDraftRow}>
                                    + Қатор
                                </button>
                                <button
                                    type="button"
                                    className={styles.btnAdd}
                                    disabled={
                                        commonMaterialStorageLoading ||
                                        commonMaterialStorageMissing
                                    }
                                    title={
                                        commonMaterialStorageMissing
                                            ? COMMON_STORAGE_MISSING_MSG
                                            : commonMaterialStorageLoading
                                              ? 'Склад юкланмоқда...'
                                              : undefined
                                    }
                                    onClick={() => {
                                        if (!commonMaterialStorageId) return;
                                        setIsMaterialCatalogOpen(true);
                                    }}
                                >
                                    Каталогдан танлаш
                                </button>
                                <button
                                    type="button"
                                    className={styles.importFromCardBtn}
                                    onClick={handleImportFromCard}
                                    disabled={importingFromCard || !order.analiticId}
                                    title={!order.analiticId ? 'Аввал тайёр маҳсулотни танланг' : 'Ишлар, материаллар ва технологик харитани карточкадан алмаштириш'}
                                >
                                    {importingFromCard ? 'Импорт...' : 'Карточкадан импорт'}
                                </button>
                                <button
                                    type="button"
                                    className={styles.saveInfoBtn}
                                    onClick={handleSaveMaterials}
                                    disabled={savingMaterials || !materialsDirty}
                                    style={{ marginTop: 0 }}
                                >
                                    {savingMaterials ? 'Сақланмоқда...' : 'Сақлаш'}
                                </button>
                                {materialsDirty && (
                                    <span className={styles.worksDirtyHint}>Сақланмаган ўзгаришлар бор</span>
                                )}
                                    </>
                                )}
                            </div>
                            {commonMaterialStorageMissing && (
                                <div className={styles.hint} style={{ marginBottom: 8 }}>
                                    {COMMON_STORAGE_MISSING_MSG} — колдик каталогда кўринмайди.
                                </div>
                            )}
                            {materialsDraft.length > 0 && (
                                <div className={styles.worksToolbarTotals}>
                                    <div className={styles.worksToolbarTotalLine}>
                                        <span className={styles.worksToolbarTotalLabel}>Жами</span>
                                        <span className={styles.worksToolbarTotalValue}>
                                            {formatWorksNumberDisplay(String(materialsDraftSumTotal), 2)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.worksTableScroll}>
                            <table className={`${styles.worksTable} ${styles.worksTableBordered}`}>
                                <thead>
                                    <tr>
                                        <th className={styles.cellNumHead}>№</th>
                                        <th>Материал</th>
                                        <th>Артикул</th>
                                        <th>Ед. изм</th>
                                        <th>Миқдор</th>
                                        <th>Тайёр маҳ. миқд.</th>
                                        <th>Буюртмада</th>
                                        <th>Нарх</th>
                                        <th>Сумма</th>
                                        <th style={{ width: 36 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {materialsDraft.length === 0 && (
                                        <tr>
                                            <td colSpan={10} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                                Материаллар йўқ — «+ Қатор» босинг
                                            </td>
                                        </tr>
                                    )}
                                    {materialsDraft.map((row, rowIndex) => (
                                        <tr key={row.draftId}>
                                            <td className={styles.cellNum}>{rowIndex + 1}</td>
                                            <td style={{ position: 'relative', minWidth: 220 }}>
                                                <SearchableTableSelect
                                                    className={styles.materialSearchSelect}
                                                    options={getMaterialSelectOptionsForRow(row)}
                                                    value={row.materialId}
                                                    onChange={val => updateMaterialDraft(row.draftId, 'materialId', val)}
                                                    placeholder="— Материални танланг —"
                                                    disabled={compositionLocked}
                                                    autoFocus={shouldFocus(row.draftId)}
                                                    onAutoFocusApplied={clearFocus}
                                                />
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {row.materialId ? materialArticleDisplay(row.materialId) || '—' : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {row.materialId ? materialUnitDisplay(row.materialId) || '—' : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <WorkNumericCell
                                                    value={row.countPlanned}
                                                    fractionDigits={3}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                    onChange={v => updateMaterialDraft(row.draftId, 'countPlanned', v)}
                                                />
                                            </td>
                                            <td>
                                                <div
                                                    className={styles.cellDerivedNum}
                                                    title="Буюртма тиражи; материал танланганда қўйилади"
                                                >
                                                    {row.finishedProductQty.trim() !== ''
                                                        ? formatWorksNumberDisplay(row.finishedProductQty, 3)
                                                        : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum} title="Миқдор × тайёр маҳсулот миқдори">
                                                    {row.countInOrder.trim() !== ''
                                                        ? formatWorksNumberDisplay(row.countInOrder, 3)
                                                        : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <WorkNumericCell
                                                    value={row.price}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                    onChange={v => updateMaterialDraft(row.draftId, 'price', v)}
                                                />
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum} title="Буюртмадаги миқдор × нарх">
                                                    {row.total.trim() !== ''
                                                        ? formatWorksNumberDisplay(row.total, 2)
                                                        : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                {canEditCompositionTabs && (
                                                <button
                                                    type="button"
                                                    className={styles.fileItemDel}
                                                    onClick={() => removeMaterialDraftRow(row)}
                                                    title="Ўчириш"
                                                >
                                                    ✕
                                                </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {materialReferences.length === 0 && (
                            <div className={styles.hint}>
                                Материаллар маълумотномаси бўш — аввал «Номлар → ТМЗ»да материалларни киритинг.
                            </div>
                        )}
                        <ProductCatalog
                            isOpen={canEditCompositionTabs && isMaterialCatalogOpen && Boolean(commonMaterialStorageId)}
                            onClose={() => setIsMaterialCatalogOpen(false)}
                            onSelectProduct={handleMaterialFromCatalog}
                            typeDocumentByComeOut="come"
                            documentType={DocumentType.ComeMaterial}
                            documentDate={orderDateMs}
                            warehouseId={commonMaterialStorageId ?? undefined}
                            allowNegativeStock
                            referenceEnterpriseId={enterpriseId ?? null}
                            quantityFractionDigits={3}
                        />
                    </>
                )}

                {/* HALFSTUFFS TAB */}
                {tab === 'halfstuffs' && (
                    <>
                        <div className={styles.worksToolbar}>
                            <div className={styles.worksToolbarLeft}>
                                {canEditCompositionTabs && (
                                    <>
                                <button type="button" className={styles.btnAdd} onClick={addHalfstuffDraftRow}>
                                    + Қатор
                                </button>
                                <button
                                    type="button"
                                    className={styles.btnAdd}
                                    disabled={halfstuffWarehouseLoading || halfstuffWarehouseMissing}
                                    title={
                                        halfstuffWarehouseMissing
                                            ? COMMON_STORAGE_MISSING_MSG
                                            : halfstuffWarehouseLoading
                                              ? 'Склад юкланмоқда...'
                                              : undefined
                                    }
                                    onClick={() => {
                                        if (!halfstuffWarehouseId) return;
                                        setIsHalfstuffCatalogOpen(true);
                                    }}
                                >
                                    Каталогдан танлаш
                                </button>
                                <button
                                    type="button"
                                    className={styles.importFromCardBtn}
                                    onClick={handleImportFromCard}
                                    disabled={importingFromCard || !order.analiticId}
                                >
                                    {importingFromCard ? 'Импорт...' : 'Карточкадан импорт'}
                                </button>
                                <button
                                    type="button"
                                    className={styles.saveInfoBtn}
                                    onClick={handleSaveHalfstuffs}
                                    disabled={savingHalfstuffs || !halfstuffsDirty}
                                    style={{ marginTop: 0 }}
                                >
                                    {savingHalfstuffs ? 'Сақланмоқда...' : 'Сақлаш'}
                                </button>
                                {halfstuffsDirty && (
                                    <span className={styles.worksDirtyHint}>Сақланмаган ўзгаришлар бор</span>
                                )}
                                    </>
                                )}
                            </div>
                            {halfstuffsDraft.length > 0 && (
                                <div className={styles.worksToolbarTotals}>
                                    <div className={styles.worksToolbarTotalLine}>
                                        <span className={styles.worksToolbarTotalLabel}>Жами</span>
                                        <span className={styles.worksToolbarTotalValue}>
                                            {formatWorksNumberDisplay(String(halfstuffsDraftSumTotal), 2)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {halfstuffWarehouseMissing && (
                            <div className={styles.hint} style={{ marginBottom: 8 }}>
                                {COMMON_STORAGE_MISSING_MSG} — колдик ва нарх каталогда кўринмайди.
                            </div>
                        )}
                        <div className={styles.worksTableScroll}>
                            <table className={`${styles.worksTable} ${styles.worksTableBordered}`}>
                                <thead>
                                    <tr>
                                        <th className={styles.cellNumHead}>№</th>
                                        <th>Ярим тайёр махсулот</th>
                                        <th>Артикул</th>
                                        <th>Миқдор</th>
                                        <th>Тайёр маҳ. миқд.</th>
                                        <th>Буюртмада</th>
                                        <th>Нарх</th>
                                        <th>Сумма</th>
                                        <th style={{ width: 36 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {halfstuffsDraft.length === 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                                Я.Т.М йўқ — «+ Қатор» босинг
                                            </td>
                                        </tr>
                                    )}
                                    {halfstuffsDraft.map((row, rowIndex) => (
                                        <tr key={row.draftId}>
                                            <td className={styles.cellNum}>{rowIndex + 1}</td>
                                            <td style={{ position: 'relative', minWidth: 220 }}>
                                                <SearchableTableSelect
                                                    className={styles.materialSearchSelect}
                                                    options={getHalfstuffSelectOptionsForRow(row)}
                                                    value={row.halfstuffId}
                                                    onChange={val => updateHalfstuffDraft(row.draftId, 'halfstuffId', val)}
                                                    placeholder="— Я.Т.М танланг —"
                                                    disabled={compositionLocked}
                                                    autoFocus={shouldFocus(row.draftId)}
                                                    onAutoFocusApplied={clearFocus}
                                                />
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {row.halfstuffId ? halfstuffArticleDisplay(row.halfstuffId) || '—' : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <WorkNumericCell
                                                    value={row.countPlanned}
                                                    fractionDigits={3}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                    onChange={v => updateHalfstuffDraft(row.draftId, 'countPlanned', v)}
                                                />
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {row.finishedProductQty.trim() !== ''
                                                        ? formatWorksNumberDisplay(row.finishedProductQty, 3)
                                                        : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {row.countInOrder.trim() !== ''
                                                        ? formatWorksNumberDisplay(row.countInOrder, 3)
                                                        : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <WorkNumericCell
                                                    value={row.price}
                                                    disabled={compositionLocked}
                                                    className={`${styles.cellEditable} ${styles.cellEditableNum}`}
                                                    onChange={v => updateHalfstuffDraft(row.draftId, 'price', v)}
                                                />
                                            </td>
                                            <td>
                                                <div className={styles.cellDerivedNum}>
                                                    {row.total.trim() !== ''
                                                        ? formatWorksNumberDisplay(row.total, 2)
                                                        : '—'}
                                                </div>
                                            </td>
                                            <td>
                                                {canEditCompositionTabs && (
                                                <button
                                                    type="button"
                                                    className={styles.fileItemDel}
                                                    onClick={() => removeHalfstuffDraftRow(row)}
                                                    title="Ўчириш"
                                                >
                                                    ✕
                                                </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {halfstuffReferences.length === 0 && (
                            <div className={styles.hint}>
                                Ярим тайёр махсулотлар бўш — аввал «Номлар → ТМЗ»да киритинг.
                            </div>
                        )}
                        <ProductCatalog
                            isOpen={canEditCompositionTabs && isHalfstuffCatalogOpen && Boolean(halfstuffWarehouseId)}
                            onClose={() => setIsHalfstuffCatalogOpen(false)}
                            onSelectProduct={handleHalfstuffFromCatalog}
                            typeDocumentByComeOut="come"
                            documentType={DocumentType.ComeHalfstuff}
                            documentDate={orderDateMs}
                            warehouseId={halfstuffWarehouseId ?? undefined}
                            stockSchet={Schet.S21}
                            allowNegativeStock
                            referenceEnterpriseId={enterpriseId ?? null}
                            quantityFractionDigits={3}
                        />
                    </>
                )}

                {/* PRICING TAB */}
                {tab === 'pricing' && (
                    !order.analiticId ? (
                        <div className={styles.hint} style={{ padding: 16 }}>
                            Нархни кўриш учун тайёр маҳсулотни каталогдан танланг.
                        </div>
                    ) : (
                        <PricingTabPanel
                            worksTabSum={worksDraftSalaryInOrderTotal}
                            commonWorksSum={orderWorksSumForPricing}
                            materialsSum={orderMaterialsSumForPricing}
                            priceClass={orderProductPriceClass}
                            token={token}
                            enterpriseId={enterpriseId}
                            usesComponents={orderPricingUsesComponents}
                            externalLoading={orderPricingMetaLoading}
                            externalError={orderPricingMetaError || null}
                            disabledBeforeCostMarkupCodes={
                                order.disabledBeforeCostMarkupCodes ?? []
                            }
                            disabledBeforeCostMarkupCodesWorks={
                                order.disabledBeforeCostMarkupCodesWorks ?? []
                            }
                            onDisabledBeforeCostMarkupCodesChange={(codes) => {
                                void (async () => {
                                    try {
                                        const updated = await foApi.updateOrder(token, order.id, {
                                            disabledBeforeCostMarkupCodes: codes,
                                        });
                                        onUpdated(updated);
                                    } catch (e: any) {
                                        alert(e.message);
                                    }
                                })();
                            }}
                            onDisabledBeforeCostMarkupCodesWorksChange={(codes) => {
                                void (async () => {
                                    try {
                                        const updated = await foApi.updateOrder(token, order.id, {
                                            disabledBeforeCostMarkupCodesWorks: codes,
                                        });
                                        onUpdated(updated);
                                    } catch (e: any) {
                                        alert(e.message);
                                    }
                                })();
                            }}
                        />
                    )
                )}

                {/* TECH MAP TAB */}
                {tab === 'techMap' && (
                    <>
                        {/* <div className={styles.sectionTitle} style={{ marginTop: 0 }}>Ишлаб чиқариш цехлари</div> */}
                        {/* <div className={styles.hint} style={{ marginBottom: 10 }}>
                            Бир хил босқич рақами — бир вақтда ишловчи цехлар. Кейинги босқич фақат олдинги босқич тўлиқ тугаганда очилади.
                        </div> */}
                        <div className={styles.worksToolbar}>
                            {canEditCompositionTabs && (
                                <>
                            <button
                                type="button"
                                className={styles.importFromCardBtn}
                                onClick={handleImportFromCard}
                                disabled={importingFromCard || !order.analiticId}
                                title={!order.analiticId ? 'Аввал тайёр маҳсулотни танланг' : 'Ишлар, материаллар ва технологик харитани карточкадан алмаштириш'}
                            >
                                {importingFromCard ? 'Импорт...' : 'Карточкадан импорт'}
                            </button>
                            <button
                                type="button"
                                className={styles.saveInfoBtn}
                                onClick={handleSaveTechMap}
                                disabled={savingTechMap || !techMapDirty}
                                style={{ marginTop: 0 }}
                            >
                                {savingTechMap ? 'Сақланмоқда...' : 'Сақлаш'}
                            </button>
                            {techMapDirty && (
                                <span className={styles.worksDirtyHint}>Сақланмаган ўзгаришлар бор</span>
                            )}
                                </>
                            )}
                        </div>

                        {techMapEmptyDeptIds.length > 0 && (
                            <p className={styles.hint} style={{ color: '#b45309', marginBottom: 10 }}>
                                Диққат: қатордаги цехларда ишлар йўқ (ID: {techMapEmptyDeptIds.join(', ')}).
                                Ишларни «Ишлар» ёрлиғида бириктиринг ёки цехни ўчиринг — сақлаш блокланади.
                            </p>
                        )}

                        <div className={styles.techMapTableCard}>
                            <div className={styles.techMapTableHeader}>
                                <div className={styles.techMapTableTitle}>Технологик харита</div>
                                {canEditCompositionTabs && (
                                <button type="button" className={styles.btnAdd} onClick={addTechMapRow}>
                                    + Қатор
                                </button>
                                )}
                            </div>
                            <div className={styles.worksTableScroll}>
                                <table className={`${styles.worksTable} ${styles.worksTableBordered}`}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 58 }}>Босқич</th>
                                            <th>Цех</th>
                                            <th style={{ width: 120 }}>Ҳолат</th>
                                            <th style={{ width: 40 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {techMapDraft.length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                                    Қаторлар йўқ
                                                </td>
                                            </tr>
                                        )}
                                        {techMapDraft.map((row) => {
                                            const rowDeptId = Number(row.deptId);
                                            const rowHasNoWorks =
                                                Number.isFinite(rowDeptId) &&
                                                rowDeptId > 0 &&
                                                (worksCountByDept.get(rowDeptId) ?? 0) === 0;
                                            return (
                                            <tr
                                                key={row.draftId}
                                                style={
                                                    rowHasNoWorks
                                                        ? { background: '#fff8e1' }
                                                        : undefined
                                                }
                                            >
                                                <td>
                                                    <input
                                                        className={`${styles.editInput} ${styles.techMapSequenceInput}`}
                                                        type="number"
                                                        min={1}
                                                        value={row.sequence}
                                                        disabled={compositionLocked}
                                                        onChange={e => updateTechMapRow(row.draftId, 'sequence', e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const hasDeptOption = productionDepts.some(
                                                            d => String(d.id) === row.deptId,
                                                        );
                                                        const fallbackDeptName = productionDeptNameByIdFromOrder.get(row.deptId) || '';
                                                        const fallbackDeptLabel = row.deptId
                                                            ? `${fallbackDeptName || `ID ${row.deptId}`} (маълумотномада топилмади)`
                                                            : '';
                                                        return (
                                                    <select
                                                        className={styles.editSelect}
                                                        value={row.deptId}
                                                        disabled={compositionLocked}
                                                        onChange={e => updateTechMapRow(row.draftId, 'deptId', e.target.value)}
                                                        ref={el => applyNativeFocus(el, row.draftId, pendingDraftId, clearFocus)}
                                                    >
                                                        <option value="">— танланг —</option>
                                                        {!hasDeptOption && row.deptId && (
                                                            <option value={row.deptId}>{fallbackDeptLabel}</option>
                                                        )}
                                                        {productionDepts.map(d => (
                                                            <option key={d.id} value={d.id}>{d.name}</option>
                                                        ))}
                                                    </select>
                                                        );
                                                    })()}
                                                </td>
                                                <td>
                                                    <span className={styles[QUEUE_STATUS_CLASS[row.status ?? 'PENDING'] ?? 'queueStatusPending']}>
                                                        {QUEUE_STATUS_LABELS[row.status ?? 'PENDING'] ?? 'Кутилмоқда'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {canEditCompositionTabs && (
                                                    <button
                                                        type="button"
                                                        className={styles.fileItemDel}
                                                        onClick={() => removeTechMapRow(row.draftId)}
                                                        title="Ўчириш"
                                                    >
                                                        ✕
                                                    </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </>
                )}

                {/* HISTORY TAB */}
                {tab === 'history' && (
                    <table className={styles.worksTable}>
                        <thead>
                            <tr>
                                <th style={{ width: 150 }}>Сана</th>
                                <th style={{ width: 220 }}>Босқич ўзгариши</th>
                                <th style={{ width: 180 }}>Фойдаланувчи</th>
                                <th>Изоҳ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(!order.stageHistory || order.stageHistory.length === 0) && (
                                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999', padding: 20 }}>Тарих йўқ</td></tr>
                            )}
                            {order.stageHistory
                                ?.slice()
                                .sort((a, b) => Number(b.changedAt) - Number(a.changedAt))
                                .map(item => {
                                    const eventType = item.eventType ?? 'STAGE';
                                    const transitionLabel = eventType === 'DEPT'
                                        ? (() => {
                                            const fromDeptName = item.fromDept?.name ?? (item.fromDeptId ? `ID ${item.fromDeptId}` : null);
                                            const toDeptName = item.toDept?.name ?? (item.toDeptId ? `ID ${item.toDeptId}` : null);
                                            if (fromDeptName && toDeptName) return `Цех: ${fromDeptName} → ${toDeptName}`;
                                            if (toDeptName) return `Цехда бошланиш: ${toDeptName}`;
                                            return 'Цехлар бўйича кўчириш';
                                        })()
                                        : (() => {
                                            const fromStage = item.fromStage ?? item.toStage;
                                            const toStage = item.toStage ?? item.fromStage;
                                            if (!fromStage || !toStage) return 'Босқич алмашиши';
                                            return `${STAGE_LABELS[fromStage]} → ${STAGE_LABELS[toStage]}`;
                                        })();

                                    return (
                                        <tr key={item.id}>
                                            <td>{formatDateTime(item.changedAt)}</td>
                                            <td>{transitionLabel}</td>
                                            <td>{item.changedByUser?.name ?? `ID ${item.changedByUserId}`}</td>
                                            <td>{item.comment || '—'}</td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                )}

                {/* FILES TAB */}
                {tab === 'files' && (
                    <div className={styles.filesTab}>
                        {ALL_FILE_STAGES.map(({ stage, field }) => {
                            const fileList = parseFileList(order[field]);
                            return (
                                <div key={stage} className={styles.filesStageBlock}>
                                    <div className={styles.filesStageTitle}>{STAGE_LABELS[stage]}</div>
                                    {fileList.length === 0 ? (
                                        <div className={styles.filesStageEmpty}>Файл йўқ</div>
                                    ) : (
                                        <div className={styles.filesStageList}>
                                            {fileList.map(file => {
                                                const filename = file.originalName || file.url.split('/').pop() || file.url;
                                                const fullUrl = `${process.env.NEXT_PUBLIC_DOMAIN}${file.url}`;
                                                return (
                                                    <div key={file.url} className={styles.filesStageItem}>
                                                        <span className={styles.filesStageIcon}>{getFileIcon(file.url)}</span>
                                                        <span className={styles.filesStageItemName} title={filename}>{filename}</span>
                                                        <label className={styles.hint} style={{ marginRight: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={file.visibleToClient}
                                                                disabled={savingInfo || compositionLocked}
                                                                onChange={e => {
                                                                    void handleToggleStageFileVisible(field, file.url, e.target.checked);
                                                                }}
                                                            />
                                                            Клиент
                                                        </label>
                                                        <button
                                                            className={styles.filesStageItemBtn}
                                                            onClick={() => setPreviewUrl(fullUrl)}
                                                        >
                                                            Кўриш
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* DEPT GANTT MODAL */}
            {showGantt && deptSchedule && (
                <DeptGanttModal
                    data={deptSchedule}
                    onClose={() => setShowGantt(false)}
                />
            )}

            {/* DELETE CONFIRM */}
            {showDeleteConfirm && (
                <div
                    className={styles.deleteConfirmOverlay}
                    onClick={(e) => { if (e.target === e.currentTarget) closeDeleteConfirm(); }}
                >
                    <div className={styles.deleteConfirmBox} onClick={(e) => e.stopPropagation()}>
                        <h3 className={styles.deleteConfirmTitle}>Удалить заявку?</h3>
                        <p className={styles.deleteConfirmText}>
                            Будут удалены все работы, материалы и журналы. Действие необратимо.
                            Введите номер заявки <strong>{order.orderNumber}</strong> для подтверждения:
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
                                if (e.key === 'Enter') void handleConfirmDeleteOrder();
                                if (e.key === 'Escape') closeDeleteConfirm();
                            }}
                            placeholder={order.orderNumber}
                            autoFocus
                            disabled={deletingOrder}
                        />
                        {deleteConfirmError && (
                            <div className={styles.deleteConfirmError}>{deleteConfirmError}</div>
                        )}
                        <div className={styles.deleteConfirmActions}>
                            <button
                                type="button"
                                className={styles.deleteConfirmCancelBtn}
                                onClick={closeDeleteConfirm}
                                disabled={deletingOrder}
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                className={styles.deleteConfirmSubmitBtn}
                                onClick={() => void handleConfirmDeleteOrder()}
                                disabled={deletingOrder || deleteConfirmInput.trim() === ''}
                            >
                                {deletingOrder ? 'Удаление…' : 'Удалить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FILE PREVIEW MODAL */}
            {previewUrl && (
                <div className={styles.previewOverlay} onClick={() => setPreviewUrl(null)}>
                    <div className={styles.previewBox} onClick={e => e.stopPropagation()}>
                        <button className={styles.previewCloseBtn} onClick={() => setPreviewUrl(null)}>×</button>
                        {isImage(previewUrl) && (
                            <img className={styles.previewImg} src={previewUrl} alt="preview" />
                        )}
                        {isPdf(previewUrl) && (
                            <iframe className={styles.previewFrame} src={previewUrl} title="preview" />
                        )}
                        {!isImage(previewUrl) && !isPdf(previewUrl) && (
                            <div className={styles.previewDownload}>
                                <div className={styles.previewDownloadIcon}>📄</div>
                                <div className={styles.previewDownloadName}>{previewUrl.split('/').pop()}</div>
                                <a className={styles.previewDownloadBtn} href={previewUrl} download>
                                    ↓ Юклаб олиш
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
