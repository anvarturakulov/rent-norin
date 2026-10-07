'use client';

import {
    type ChangeEvent,
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    PriceClass,
    ReferenceModel,
    TmzComponentRow,
    TmzDrawingScalingFile,
    TmzMaterialRow,
    TmzTechMapRow,
    TmzWorkRow,
    TypeSECTION,
    TypeTMZ,
} from '@/app/interfaces/reference.interface';
import { PricingTabPanel } from '@/app/components/pricingPolicy/PricingTabPanel';
import { ReferencesService } from '@/app/service/references/references.service';
import {
    productNormsApi,
    type ProductNormCommonWorkApi,
    type ProductNormComponentApi,
    type ProductNormMaterialApi,
    type ProductNormHalfstuffApi,
    type ProductNormPricing,
    type ProductNormsBundle,
    type ProductNormWorkApi,
    type ReplaceProductNormsPayload,
    type ResolvedProductNorms,
} from '@/app/service/productNorms/productNorms.service';
import type { DraftWorkRow } from '@/app/components/furnitureOrders/furnitureOrderCard/orderWorksDraft';
import { emptyDraftRow, recomputeDerived } from '@/app/components/furnitureOrders/furnitureOrderCard/orderWorksDraft';
import {
    emptyCommonWorkDraftRow,
    recomputeCommonWorkAmount,
    selectedCommonWorksSum,
    type DraftCommonWorkRow,
} from '@/app/components/furnitureOrders/furnitureOrderCard/orderCommonWorksDraft';
import { getPereodicValue } from '@/app/components/reference/helpers/reference.functions';
import { parseWorksShortXlsx } from '@/app/components/furnitureOrders/furnitureOrderCard/parseWorksXlsx';
import type { DraftMaterialRow } from '@/app/components/furnitureOrders/furnitureOrderCard/orderMaterialsDraft';
import {
    emptyHalfstuffDraftRow,
    type DraftHalfstuffRow,
    withDerivedHalfstuffTotal,
} from '@/app/components/furnitureOrders/furnitureOrderCard/orderHalfstuffsDraft';
import {
    emptyMaterialDraftRow,
    formatMaterialQtyFromCatalog,
} from '@/app/components/furnitureOrders/furnitureOrderCard/orderMaterialsDraft';
import { parseMaterialsXlsx } from '@/app/components/furnitureOrders/furnitureOrderCard/parseMaterialsXlsx';
import {
    WorkEditableCell,
    WorkNumericCell,
    formatWorksNumberDisplay,
} from '@/app/components/furnitureOrders/furnitureOrderCard/workTableCells';
import { WORK_STATUS_LABELS, WorkStatus } from '@/app/interfaces/furnitureOrder.interface';
import foStyles from '@/app/components/furnitureOrders/furnitureOrderCard/furnitureOrderCard.module.css';
import { normalizeTmzDrawingFilesList } from '@/app/utils/tmzDrawingScalingFiles';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import { getSettingPereodicValueForDateByKey } from '@/app/service/settings/getSettingPereodicValueForDateByKey';
import { SearchableTableSelect } from '@/app/components/shared/searchableTableSelect/SearchableTableSelect';
import { applyNativeFocus, usePendingRowFocus } from '@/app/hooks/usePendingRowFocus';
import { getMaterialAveragePrice, getMaterialAveragePrices } from '@/app/service/documents/getMaterialAveragePrice';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Schet } from '@/app/interfaces/report.interface';
import {
    COMMON_STORAGE_MISSING_MSG,
    fetchCommonMaterialStorageId,
    fetchHalfstuffWarehouseId,
    resolveHalfstuffStockPrice,
} from '@/app/components/furnitureOrders/productionWorkBoard/workExecutionHelpers';
import { Product } from '@/app/interfaces/product.interface';
import useSWR from 'swr';
import styles from './TmzProductTabs.module.css';
import { useAppContext } from '@/app/context/app.context';
import {
    getVisibleTmzTabs,
    TmzProductTabKey,
} from '@/app/utils/referencePermissions';

/** Расм / PDF / Excel — инпут accept + согласовано с tmzProductFileFilter на бэкенде */
const TMZ_ATTACHMENT_ACCEPT =
    'image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,application/pdf,.pdf,application/vnd.ms-excel,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx';

function isAllowedTmzAttachmentFile(file: File): boolean {
    const okMime = new Set([
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    const okExt = /\.(jpe?g|png|gif|webp|bmp|svg|pdf|xlsx|xls)$/i.test(file.name);
    if (okMime.has(file.type)) return true;
    if (file.type === '' || file.type === 'application/octet-stream') return okExt;
    return okExt;
}

/** Относительные пути /api/upload/... грузим с хоста API (не страницы Next). */
function resolveTmzPublicFileUrl(raw: string): string {
    const u = raw?.trim() ?? '';
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    return withApiDomain(path);
}

const WORK_STATUS_COLORS: Record<WorkStatus, string> = {
    OPEN: '#9e9e9e',
    PENDING: '#ff9800',
    IN_PROGRESS: '#2196f3',
    PAUSE: '#ff5722',
    DONE: '#4caf50',
};

type ProductTab = TmzProductTabKey;

const TAB_LABELS: Record<ProductTab, string> = {
    works: 'Ишлар',
    commonWorks: 'Умумий ишлар',
    materials: 'Материаллар',
    halfstuffs: 'Ярим тайёр махсулот',
    components: 'Составные части',
    techMap: 'Техкарт',
    files: 'Файллар',
    pricing: 'Нархлаш',
};

type Props = {
    body: ReferenceModel;
    setBody: Dispatch<SetStateAction<ReferenceModel>>;
    token?: string;
    isReadOnly?: boolean;
    canUploadFiles?: boolean;
};

type NormDraft = {
    works: DraftWorkRow[];
    commonWorks: DraftCommonWorkRow[];
    materials: DraftMaterialRow[];
    halfstuffs: DraftHalfstuffRow[];
    routes: Array<TmzTechMapRow & { serverId?: number }>;
    components: Array<TmzComponentRow & { serverId?: number }>;
};

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function numFromDraftString(s: string | undefined): number {
    const t = (s ?? '').trim();
    if (t === '') return 0;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

function optNumFromDraftString(s: string | undefined): number | undefined {
    const t = (s ?? '').trim();
    if (t === '') return undefined;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
}

function refreshWorkRowNormaFromRef(row: DraftWorkRow, ref: ReferenceModel): DraftWorkRow {
    if (ref.refValues?.norma == null) return row;
    return recomputeDerived({ ...row, hourRate: String(ref.refValues.norma) }, 'hourRate');
}

function strNum(n: number | undefined | null): string {
    return n == null || !Number.isFinite(Number(n)) ? '' : String(n);
}

function productNormToDraft(w: ProductNormWorkApi): DraftWorkRow {
    return {
        draftId: w.id != null ? `srv-w-${w.id}` : makeId(),
        serverId: w.id,
        workRefId: w.workRefId != null ? String(w.workRefId) : '',
        workName: w.workName ?? '',
        workArticle: w.workArticle ?? '',
        assignedDeptId: w.assignedDeptId != null ? String(w.assignedDeptId) : '',
        unit: w.unit ?? '',
        hourRate: strNum(w.hourRate),
        countInUnit: strNum(w.countInUnit),
        finishedProductQty: '',
        countInOrder: strNum(w.countInOrder),
        timeInUnit: strNum(w.timeInUnit),
        timeInOrder: strNum(w.timeInOrder),
        salaryRate: strNum(w.salaryRate),
        salaryInUnit: strNum(w.salaryInUnit),
        salaryInOrder: strNum(w.salaryInOrder),
        workStatus: 'OPEN',
        overrides: {},
    };
}

function productMaterialNormToDraft(m: ProductNormMaterialApi & { id?: number; material?: { name?: string } }): DraftMaterialRow {
    const cp = m.countPlanned ?? 0;
    const p = m.price ?? 0;
    const computedTotal = cp > 0 && p > 0 ? Math.round(cp * p * 100) / 100 : 0;
    return {
        draftId: m.id != null ? `srv-m-${m.id}` : makeId(),
        serverId: m.id,
        materialId: String(m.materialId ?? ''),
        finishedProductQty: '',
        countPlanned: strNum(m.countPlanned),
        countInOrder: strNum(m.countPlanned),
        price: strNum(m.price),
        total: strNum(computedTotal || m.total),
    };
}

function productHalfstuffNormToDraft(
    h: ProductNormHalfstuffApi & { id?: number; halfstuff?: { name?: string } },
): DraftHalfstuffRow {
    const cp = h.countPlanned ?? 0;
    const p = h.price ?? 0;
    const computedTotal = cp > 0 && p > 0 ? Math.round(cp * p * 100) / 100 : 0;
    return {
        draftId: h.id != null ? `srv-h-${h.id}` : makeId(),
        serverId: h.id,
        halfstuffId: String(h.halfstuffId ?? ''),
        finishedProductQty: '',
        countPlanned: strNum(h.countPlanned),
        countInOrder: strNum(h.countPlanned),
        price: strNum(h.price),
        total: strNum(computedTotal || h.total),
    };
}

function productCommonWorkNormToDraft(w: ProductNormCommonWorkApi): DraftCommonWorkRow {
    const quantity = w.quantity ?? 0;
    const price = w.price ?? 0;
    const amount =
        w.amount != null && Number.isFinite(Number(w.amount))
            ? Number(w.amount)
            : Math.round(quantity * price * 100) / 100;
    return recomputeCommonWorkAmount({
        draftId: w.id != null ? `srv-cw-${w.id}` : makeId(),
        serverId: w.id,
        commonWorkRefId: w.commonWorkRefId != null ? String(w.commonWorkRefId) : '',
        workName: w.workName ?? '',
        unit: w.unit ?? '',
        quantity: strNum(quantity) || '0',
        price: strNum(price) || '0',
        amount: strNum(amount) || '0',
        selected: Boolean(w.selected),
    });
}

/** Полная строка из refValues (новый формат) или короткий TmzWorkRow. */
function refValuesRowToWorkDraft(raw: unknown, idx: number): DraftWorkRow {
    if (raw && typeof raw === 'object' && 'workName' in raw && 'hourRate' in raw) {
        const o = raw as DraftWorkRow;
        return {
            ...emptyDraftRow(o.draftId || `leg-w-${idx}`),
            ...o,
            draftId: o.draftId || `leg-w-${idx}`,
            workStatus: o.workStatus ?? 'OPEN',
            overrides: o.overrides ?? {},
        };
    }
    const w = raw as TmzWorkRow;
    return {
        draftId: w.draftId || `leg-w-${idx}`,
        workRefId: '',
        workName: w.workName ?? '',
        workArticle: '',
        assignedDeptId: '',
        unit: w.unit ?? '',
        hourRate: '',
        countInUnit: w.countInUnit != null ? String(w.countInUnit) : '',
        finishedProductQty: '',
        countInOrder: '',
        timeInUnit: w.timeInUnit != null ? String(w.timeInUnit) : '',
        timeInOrder: '',
        salaryRate: '',
        salaryInUnit: w.salaryInUnit != null ? String(w.salaryInUnit) : '',
        salaryInOrder: '',
        workStatus: 'OPEN',
        overrides: {},
    };
}

function workDraftToRefValuesStored(r: DraftWorkRow): unknown {
    return { ...r };
}

function computeMaterialTotal(countPlanned: string, price: string): string {
    const cp = numFromDraftString(countPlanned);
    const p = numFromDraftString(price);
    return (cp > 0 && p > 0) ? String(Math.round(cp * p * 100) / 100) : '';
}

function refValuesRowToMaterialDraft(raw: unknown, idx: number): DraftMaterialRow {
    if (raw && typeof raw === 'object' && 'materialId' in raw && typeof (raw as DraftMaterialRow).materialId === 'string') {
        const o = raw as DraftMaterialRow;
        const countPlanned = String(o.countPlanned ?? '');
        const price = String(o.price ?? '');
        return {
            draftId: o.draftId || `leg-m-${idx}`,
            serverId: o.serverId,
            materialId: String(o.materialId ?? ''),
            finishedProductQty: String(o.finishedProductQty ?? ''),
            countPlanned,
            countInOrder: countPlanned,
            price,
            total: computeMaterialTotal(countPlanned, price) || String(o.total ?? ''),
        };
    }
    const m = raw as TmzMaterialRow;
    const countPlanned = m.countPlanned != null ? String(m.countPlanned) : '';
    const price = m.price != null ? String(m.price) : '';
    return {
        draftId: m.draftId || `leg-m-${idx}`,
        materialId: m.materialId ? String(m.materialId) : '',
        finishedProductQty: '',
        countPlanned,
        countInOrder: countPlanned,
        price,
        total: computeMaterialTotal(countPlanned, price),
    };
}

function materialDraftToRefValuesStored(r: DraftMaterialRow): unknown {
    return { ...r, total: computeMaterialTotal(r.countPlanned, r.price) || r.total };
}

function draftWorkToTmzEffective(w: DraftWorkRow): TmzWorkRow {
    return {
        draftId: w.draftId,
        workName: w.workName,
        unit: w.unit,
        countInUnit: numFromDraftString(w.countInUnit) || numFromDraftString(w.countInOrder),
        timeInUnit: numFromDraftString(w.timeInUnit) || numFromDraftString(w.timeInOrder),
        salaryInUnit: numFromDraftString(w.salaryInUnit) || numFromDraftString(w.salaryInOrder),
    };
}

function draftMaterialToTmzEffective(m: DraftMaterialRow, materialById: Map<number, ReferenceModel>): TmzMaterialRow {
    const mid = Number(m.materialId);
    return {
        draftId: m.draftId,
        materialId: mid,
        materialName: materialById.get(mid)?.name,
        countPlanned: numFromDraftString(m.countPlanned),
        price: numFromDraftString(m.price),
    };
}

function bundleToDraft(bundle: ProductNormsBundle): NormDraft {
    return {
        works: (bundle.works ?? []).map((w) => productNormToDraft(w)),
        commonWorks: (bundle.commonWorks ?? []).map((w) => productCommonWorkNormToDraft(w)),
        materials: (bundle.materials ?? []).map((m) => productMaterialNormToDraft(m)),
        halfstuffs: (bundle.halfstuffs ?? []).map((h) => productHalfstuffNormToDraft(h)),
        routes: (bundle.routes ?? []).map((r) => ({
            draftId: r.id != null ? `srv-r-${r.id}` : makeId(),
            serverId: r.id,
            deptId: Number(r.deptId) || 0,
            sequence: Number(r.sequence) || 0,
        })),
        components: (bundle.components ?? []).map((c: ProductNormComponentApi & { component?: { name?: string } }) => ({
            draftId: c.id != null ? `srv-c-${c.id}` : makeId(),
            serverId: c.id,
            componentId: Number(c.componentReferenceId) || 0,
            componentName: c.component?.name,
            qty: Number(c.qty) > 0 ? Number(c.qty) : 1,
        })),
    };
}

function draftWorkRowToPayloadItem(r: DraftWorkRow, lineIndex: number): NonNullable<ReplaceProductNormsPayload['works']>[number] {
    const countInUnit = numFromDraftString(r.countInUnit) || numFromDraftString(r.countInOrder);
    const countInOrder = optNumFromDraftString(r.countInOrder);
    const timeInUnit = numFromDraftString(r.timeInUnit) || numFromDraftString(r.timeInOrder);
    const timeInOrder = optNumFromDraftString(r.timeInOrder);
    const salaryInUnit = numFromDraftString(r.salaryInUnit) || numFromDraftString(r.salaryInOrder);
    const salaryInOrder = optNumFromDraftString(r.salaryInOrder);
    const item: Record<string, unknown> = {
        lineIndex,
        workName: (r.workName?.trim() || '—') as string,
        unit: r.unit || undefined,
        countInUnit,
        countInOrder,
        timeInUnit,
        timeInOrder,
        salaryInUnit,
        salaryInOrder,
    };
    if (r.workArticle?.trim()) item.workArticle = r.workArticle.trim();
    const aid = r.assignedDeptId?.trim();
    if (aid && Number(aid) > 0) item.assignedDeptId = Number(aid);
    const wrid = r.workRefId?.trim();
    if (wrid && Number(wrid) > 0) item.workRefId = Number(wrid);
    const sr = optNumFromDraftString(r.salaryRate);
    const hr = optNumFromDraftString(r.hourRate);
    if (sr != null) item.salaryRate = sr;
    if (hr != null) item.hourRate = hr;
    return item as NonNullable<ReplaceProductNormsPayload['works']>[number];
}

function draftToPayload(d: NormDraft): ReplaceProductNormsPayload {
    return {
        works: d.works.map((w, i) => draftWorkRowToPayloadItem(w, i)),
        commonWorks: d.commonWorks.map((w, i) => {
            const quantity = numFromDraftString(w.quantity);
            const price = numFromDraftString(w.price);
            const amount = numFromDraftString(w.amount) || Math.round(quantity * price * 100) / 100;
            const refId = Number(w.commonWorkRefId);
            return {
                lineIndex: i,
                commonWorkRefId: Number.isFinite(refId) && refId > 0 ? refId : undefined,
                workName: (w.workName?.trim() || '—') as string,
                unit: w.unit || undefined,
                quantity,
                price,
                amount,
                selected: Boolean(w.selected),
            };
        }),
        materials: d.materials
            .filter((m) => Number(m.materialId) > 0)
            .map((m, i) => {
                const q = optNumFromDraftString(m.countPlanned);
                const p = optNumFromDraftString(m.price);
                const total = (q != null && p != null) ? Math.round(q * p * 100) / 100 : undefined;
                return {
                    lineIndex: i,
                    materialId: Number(m.materialId),
                    price: p,
                    countPlanned: q,
                    total,
                };
            }),
        halfstuffs: d.halfstuffs
            .filter((h) => Number(h.halfstuffId) > 0)
            .map((h, i) => {
                const q = optNumFromDraftString(h.countPlanned);
                const p = optNumFromDraftString(h.price);
                const total = q != null && p != null ? Math.round(q * p * 100) / 100 : undefined;
                return {
                    lineIndex: i,
                    halfstuffId: Number(h.halfstuffId),
                    price: p,
                    countPlanned: q,
                    total,
                };
            }),
        routes: d.routes
            .filter((r) => toNum(r.deptId) > 0)
            .map((r) => ({
                sequence: toNum(r.sequence) || 1,
                deptId: toNum(r.deptId),
            }))
            .sort((a, b) => a.sequence - b.sequence),
        components: d.components
            .filter((c) => toNum(c.componentId) > 0 && toNum(c.qty) > 0)
            .map((c) => ({
                componentReferenceId: toNum(c.componentId),
                qty: toNum(c.qty),
            })),
    };
}

function getFileUrl(f: TmzDrawingScalingFile): string {
    if (typeof f === 'string') return f;
    return f?.url?.trim() ?? '';
}

function fileDisplayName(f: TmzDrawingScalingFile): string {
    const url = getFileUrl(f);
    if (typeof f === 'object' && f?.originalName?.trim()) return f.originalName.trim();
    const legacyName = (f as { originalname?: string }).originalname?.trim();
    if (legacyName) return legacyName;
    const seg = url.split('/').pop()?.split('?')[0];
    return seg || url || 'файл';
}

function isLikelyImageUrl(url: string): boolean {
    const u = url.trim();
    if (!u) return false;
    try {
        const parsed = u.startsWith('http') ? new URL(u) : new URL(u, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(parsed.pathname);
    } catch {
        return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i.test(u);
    }
}

function fileThumbBadge(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'PDF';
    if (ext === 'xlsx' || ext === 'xls') return 'XLS';
    return '📄';
}

async function downloadTmzAttachment(url: string, suggestedName: string, token?: string): Promise<void> {
    const abs = resolveTmzPublicFileUrl(url);
    const safe = (suggestedName || 'file').replace(/[/\\?%*:|"<>]/g, '_');
    try {
        const headers: Record<string, string> = {
            ...getNgrokBypassHeaders(abs),
        };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(abs, { mode: 'cors', credentials: 'omit', headers });
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const obj = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = obj;
        a.download = safe;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(obj);
    } catch {
        window.open(abs, '_blank', 'noopener,noreferrer');
    }
}

export default function TmzProductTabs({
    body,
    setBody,
    token,
    isReadOnly = false,
    canUploadFiles = true,
}: Props): JSX.Element | null {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const visibleTabs = useMemo(() => getVisibleTmzTabs(user), [user]);
    const [tab, setTab] = useState<ProductTab>('works');
    const filesReadOnly = isReadOnly || !canUploadFiles;

    useEffect(() => {
        if (visibleTabs.length === 0) return;
        if (!visibleTabs.includes(tab)) {
            setTab(visibleTabs[0]);
        }
    }, [visibleTabs, tab]);
    const [products, setProducts] = useState<ReferenceModel[]>([]);
    const [materials, setMaterials] = useState<ReferenceModel[]>([]);
    const [halfstuffsCatalog, setHalfstuffsCatalog] = useState<ReferenceModel[]>([]);
    const [productionDepts, setProductionDepts] = useState<ReferenceModel[]>([]);
    const [worksReferences, setWorksReferences] = useState<ReferenceModel[]>([]);
    const [commonWorksCatalog, setCommonWorksCatalog] = useState<ReferenceModel[]>([]);

    const referenceId = body.id != null ? Number(body.id) : NaN;
    const apiMode = Boolean(token && Number.isFinite(referenceId) && referenceId > 0);

    const [normDraft, setNormDraft] = useState<NormDraft | null>(null);
    const [resolved, setResolved] = useState<ResolvedProductNorms | null>(null);
    const [pricingCalc, setPricingCalc] = useState<ProductNormPricing | null>(null);
    const [normsLoading, setNormsLoading] = useState(false);
    const [normsSaving, setNormsSaving] = useState(false);
    const [normsError, setNormsError] = useState('');
    const [normsDirty, setNormsDirty] = useState(false);
    const [importingWorks, setImportingWorks] = useState(false);
    const [recalcingWorkNorms, setRecalcingWorkNorms] = useState(false);
    const [worksImportWarning, setWorksImportWarning] = useState('');
    const [importingMaterials, setImportingMaterials] = useState(false);
    const [materialsImportWarning, setMaterialsImportWarning] = useState('');
    const [isMaterialCatalogOpen, setIsMaterialCatalogOpen] = useState(false);
    const [isHalfstuffCatalogOpen, setIsHalfstuffCatalogOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [filesListSaving, setFilesListSaving] = useState(false);
    const [salaryMonthRate, setSalaryMonthRate] = useState<number>(0);
    const { pendingDraftId, requestFocus, clearFocus, shouldFocus } = usePendingRowFocus();

    const halfstuffWarehouseKey =
        token && body.enterpriseId
            ? ['tmz-halfstuff-warehouse', token, body.enterpriseId]
            : null;
    const { data: halfstuffWarehouseId } = useSWR<number | null>(
        halfstuffWarehouseKey,
        () => fetchHalfstuffWarehouseId(token!, Number(body.enterpriseId)),
    );
    const halfstuffWarehouseLoading = halfstuffWarehouseId === undefined;
    const halfstuffWarehouseMissing =
        !halfstuffWarehouseLoading && halfstuffWarehouseId == null;

    const commonMaterialStorageKey =
        token && body.enterpriseId
            ? ['tmz-common-material-storage', token, body.enterpriseId]
            : null;
    const { data: commonMaterialStorageId } = useSWR<number | null>(
        commonMaterialStorageKey,
        () => fetchCommonMaterialStorageId(token!, Number(body.enterpriseId)),
    );
    const commonMaterialStorageLoading = commonMaterialStorageId === undefined;
    const commonMaterialStorageMissing =
        !commonMaterialStorageLoading && commonMaterialStorageId == null;

    const tmzMaterialStockDateMs = useMemo(
        () => Date.now(),
        [tab, isMaterialCatalogOpen],
    );

    const tmzHalfstuffStockDateMs = useMemo(
        () => Date.now(),
        [tab, isHalfstuffCatalogOpen],
    );

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        (async () => {
            const rate = await getSettingPereodicValueForDateByKey(
                'salary.month',
                Date.now(),
                token,
                body.enterpriseId ?? undefined,
            );
            if (!cancelled) setSalaryMonthRate(rate);
        })();
        return () => { cancelled = true; };
    }, [token, body.enterpriseId]);

    useEffect(() => {
        if (!previewUrl) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPreviewUrl(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [previewUrl]);

    useEffect(() => {
        const loadReferences = async () => {
            if (!token) return;
            try {
                const [tmzList, storages, worksList, commonWorksList] = await Promise.all([
                    ReferencesService.getReferencesByType('TMZ', token),
                    ReferencesService.getReferencesByType('STORAGES', token),
                    ReferencesService.getReferencesByType('WORKS', token),
                    ReferencesService.getReferencesByType('COMMON_WORKS', token),
                ]);
                setProducts(tmzList.filter((r) => r.refValues?.typeTMZ === TypeTMZ.PRODUCT && !r.isFolder));
                setMaterials(tmzList.filter((r) => r.refValues?.typeTMZ === TypeTMZ.MATERIAL && !r.isFolder));
                setHalfstuffsCatalog(tmzList.filter((r) => r.refValues?.typeTMZ === TypeTMZ.HALFSTUFF && !r.isFolder));
                setProductionDepts(storages.filter((s) => s.refValues?.typeSection === TypeSECTION.PRODUCTION && !s.isFolder));
                setWorksReferences(worksList.filter((w) => !w.isFolder));
                setCommonWorksCatalog(commonWorksList.filter((w) => !w.isFolder));
            } catch (e) {
                console.error('Failed to load TMZ tabs references', e);
            }
        };
        void loadReferences();
    }, [token]);

    useEffect(() => {
        if (!apiMode || !token) {
            setNormDraft(null);
            setResolved(null);
            setPricingCalc(null);
            setNormsDirty(false);
            setNormsError('');
            setWorksImportWarning('');
            setMaterialsImportWarning('');
            return;
        }
        let cancelled = false;
        (async () => {
            setNormsLoading(true);
            setNormsError('');
            setWorksImportWarning('');
            setMaterialsImportWarning('');
            try {
                const [bundle, res, calc] = await Promise.all([
                    productNormsApi.getBundle(token, referenceId),
                    productNormsApi.getResolved(token, referenceId),
                    productNormsApi.getPricing(token, referenceId),
                ]);
                if (cancelled) return;
                setNormDraft(bundleToDraft(bundle));
                setResolved(res);
                setPricingCalc(calc);
                setNormsDirty(false);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (!cancelled) setNormsError(msg);
            } finally {
                if (!cancelled) setNormsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [apiMode, token, referenceId]);

    const patchNormDraft = useCallback((patch: Partial<NormDraft>) => {
        setNormDraft((prev) => {
            if (!prev) return prev;
            setNormsDirty(true);
            return { ...prev, ...patch };
        });
    }, []);

    const legacyWorksDraft = useMemo(
        () =>
            (Array.isArray(body.refValues?.tmzWorks) ? body.refValues.tmzWorks : []).map((raw, i) =>
                refValuesRowToWorkDraft(raw, i),
            ),
        [body.refValues?.tmzWorks],
    );
    const legacyMaterialsDraft = useMemo(
        () =>
            (Array.isArray(body.refValues?.tmzMaterials) ? body.refValues.tmzMaterials : []).map((raw, i) =>
                refValuesRowToMaterialDraft(raw, i),
            ),
        [body.refValues?.tmzMaterials],
    );
    const legacyTechMap: TmzTechMapRow[] = useMemo(
        () => (Array.isArray(body.refValues?.tmzTechMap) ? body.refValues?.tmzTechMap : []),
        [body.refValues?.tmzTechMap],
    );
    const legacyComponents: TmzComponentRow[] = useMemo(
        () => (Array.isArray(body.refValues?.tmzComponents) ? body.refValues?.tmzComponents : []),
        [body.refValues?.tmzComponents],
    );

    const worksDraft = apiMode ? normDraft?.works ?? [] : legacyWorksDraft;
    const commonWorksDraft = apiMode ? normDraft?.commonWorks ?? [] : [];
    const materialsDraft = apiMode ? normDraft?.materials ?? [] : legacyMaterialsDraft;
    const halfstuffsDraft = apiMode ? normDraft?.halfstuffs ?? [] : [];
    const techMapRows = apiMode ? normDraft?.routes ?? [] : legacyTechMap;
    const componentRows = apiMode ? normDraft?.components ?? [] : legacyComponents;

    const commonWorksSelectedSum = useMemo(
        () => selectedCommonWorksSum(commonWorksDraft),
        [commonWorksDraft],
    );

    const worksDraftTableSumSalaryUnit = useMemo(
        () => worksDraft.reduce((acc, row) => acc + numFromDraftString(row.salaryInUnit), 0),
        [worksDraft],
    );

    const materialsDraftTableSum = useMemo(
        () =>
            materialsDraft.reduce((acc, row) => {
                const computed = computeMaterialTotal(row.countPlanned, row.price);
                const s = (computed || row.total.trim()).trim();
                return acc + (s ? numFromDraftString(s) : 0);
            }, 0),
        [materialsDraft],
    );

    const halfstuffsDraftTableSum = useMemo(
        () =>
            halfstuffsDraft.reduce((acc, row) => {
                const computed = computeMaterialTotal(row.countPlanned, row.price);
                const s = (computed || row.total.trim()).trim();
                return acc + (s ? numFromDraftString(s) : 0);
            }, 0),
        [halfstuffsDraft],
    );

    const scalingFiles = normalizeTmzDrawingFilesList(body.refValues?.filesFromScaling);
    const drawingFiles = normalizeTmzDrawingFilesList(body.refValues?.filesFromDrawing);

    /**
     * Снимок последнего ИЗВЕСТНО СОХРАНЁННОГО состояния списков файлов (для сравнения с текущим
     * локальным состоянием и показа предупреждения «Сақланмаган файллар бор»).
     */
    const fileListSignature = useCallback((list: TmzDrawingScalingFile[]) => {
        return JSON.stringify(
            normalizeTmzDrawingFilesList(list).map((f) => ({
                url: getFileUrl(f),
                originalName: typeof f === 'object' ? (f.originalName ?? '') : '',
                visibleToClient: typeof f === 'object' ? f.visibleToClient !== false : true,
            })),
        );
    }, []);

    const [savedFilesSnapshot, setSavedFilesSnapshot] = useState<{ scaling: string; drawing: string }>(
        () => ({
            scaling: fileListSignature(normalizeTmzDrawingFilesList(body.refValues?.filesFromScaling)),
            drawing: fileListSignature(normalizeTmzDrawingFilesList(body.refValues?.filesFromDrawing)),
        }),
    );

    useEffect(() => {
        setSavedFilesSnapshot({
            scaling: fileListSignature(normalizeTmzDrawingFilesList(body.refValues?.filesFromScaling)),
            drawing: fileListSignature(normalizeTmzDrawingFilesList(body.refValues?.filesFromDrawing)),
        });
    }, [referenceId, fileListSignature]);

    const currentScalingSig = fileListSignature(scalingFiles);
    const currentDrawingSig = fileListSignature(drawingFiles);
    const hasUnsavedScalingFiles = currentScalingSig !== savedFilesSnapshot.scaling;
    const hasUnsavedDrawingFiles = currentDrawingSig !== savedFilesSnapshot.drawing;
    const hasUnsavedFiles = hasUnsavedScalingFiles || hasUnsavedDrawingFiles;

    useEffect(() => {
        if (!hasUnsavedFiles) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasUnsavedFiles]);

    const productById = useMemo(() => new Map(products.map((p) => [Number(p.id), p])), [products]);
    const materialById = useMemo(() => new Map(materials.map((m) => [Number(m.id), m])), [materials]);
    const materialArticleById = useMemo(() => new Map(materials.map((m) => [String(m.id), m.article ?? ''])), [materials]);
    const materialUnitById = useMemo(
        () => new Map(materials.map((m) => [String(m.id), m.refValues?.unit ?? ''])),
        [materials],
    );
    const halfstuffById = useMemo(
        () => new Map(halfstuffsCatalog.map((h) => [Number(h.id), h])),
        [halfstuffsCatalog],
    );
    const halfstuffArticleById = useMemo(
        () => new Map(halfstuffsCatalog.map((h) => [String(h.id), h.article ?? ''])),
        [halfstuffsCatalog],
    );

    const updateTmzWorkDraft = useCallback(
        (draftId: string, field: keyof DraftWorkRow, value: string | WorkStatus) => {
            const applyToRows = (rows: DraftWorkRow[]): DraftWorkRow[] =>
                rows.map((row) => {
                    if (row.draftId !== draftId) return row;
                    let next: DraftWorkRow = { ...row, [field]: value } as DraftWorkRow;

                    if (field === 'workRefId') {
                        const ref = worksReferences.find((r) => String(r.id) === value);
                        if (ref) {
                            next.workName = ref.name;
                            next.workArticle = ref.article ?? '';
                            if (ref.refValues?.unit) next.unit = ref.refValues.unit;
                            if (ref.refValues?.norma != null) next.hourRate = String(ref.refValues.norma);
                            if (ref.refValues?.workDeptId != null) next.assignedDeptId = String(ref.refValues.workDeptId);
                            if (salaryMonthRate > 0 && !next.salaryRate) next.salaryRate = String(salaryMonthRate);
                            next = recomputeDerived(next, 'hourRate');
                        } else {
                            next.workName = '';
                            next.workArticle = '';
                        }
                    }

                    const baseKeys = ['hourRate', 'countInUnit', 'countInOrder', 'salaryRate'] as const;
                    if (baseKeys.includes(field as (typeof baseKeys)[number])) {
                        next = recomputeDerived(next, field as (typeof baseKeys)[number]);
                    }
                    const calcKeys = ['timeInUnit', 'timeInOrder', 'salaryInUnit', 'salaryInOrder'] as const;
                    if (calcKeys.includes(field as (typeof calcKeys)[number])) {
                        next = {
                            ...next,
                            overrides: { ...next.overrides, [field as (typeof calcKeys)[number]]: true },
                        };
                    }
                    return next;
                });

            if (apiMode) {
                setNormDraft((prev) => {
                    if (!prev) return prev;
                    setNormsDirty(true);
                    return { ...prev, works: applyToRows(prev.works) };
                });
            } else {
                setBody((prev) => {
                    const current = (Array.isArray(prev.refValues?.tmzWorks) ? prev.refValues.tmzWorks : []) as unknown[];
                    const drafts = current.map((raw, i) => refValuesRowToWorkDraft(raw, i));
                    return {
                        ...prev,
                        refValues: {
                            ...prev.refValues,
                            tmzWorks: applyToRows(drafts).map(workDraftToRefValuesStored) as TmzWorkRow[],
                        },
                    };
                });
            }
        },
        [apiMode, setBody, worksReferences, salaryMonthRate],
    );

    const updateTmzMaterialDraft = useCallback(
        (draftId: string, field: keyof DraftMaterialRow, value: string) => {
            const mapRow = (row: DraftMaterialRow): DraftMaterialRow => {
                if (row.draftId !== draftId) return row;
                const next: DraftMaterialRow = { ...row, [field]: value };
                if (field === 'countPlanned' || field === 'price' || field === 'materialId') {
                    const cp = numFromDraftString(next.countPlanned);
                    const p = numFromDraftString(next.price);
                    const t = (cp > 0 && p > 0) ? String(Math.round(cp * p * 100) / 100) : '';
                    return { ...next, total: t };
                }
                return next;
            };

            if (apiMode) {
                setNormDraft((prev) => {
                    if (!prev) return prev;
                    setNormsDirty(true);
                    return { ...prev, materials: prev.materials.map(mapRow) };
                });
            } else {
                setBody((prev) => {
                    const current = (Array.isArray(prev.refValues?.tmzMaterials) ? prev.refValues.tmzMaterials : []) as unknown[];
                    const drafts = current.map((raw, i) => refValuesRowToMaterialDraft(raw, i));
                    return {
                        ...prev,
                        refValues: {
                            ...prev.refValues,
                            tmzMaterials: drafts.map(mapRow).map(materialDraftToRefValuesStored) as TmzMaterialRow[],
                        },
                    };
                });
            }

            if (field === 'materialId' && value && token) {
                const mid = Number(value);
                if (Number.isFinite(mid) && mid > 0) {
                    getMaterialAveragePrice(mid, token).then((avgPrice) => {
                        let priceToSet = avgPrice > 0 ? avgPrice : 0;
                        if (priceToSet === 0) {
                            const mat = materials.find((m) => Number(m.id) === mid);
                            const fallback = mat?.refValues?.costPriceInStart ?? mat?.refValues?.firstPrice ?? 0;
                            if (fallback > 0) priceToSet = fallback;
                        }
                        const setPriceRow = (row: DraftMaterialRow): DraftMaterialRow => {
                            if (row.draftId !== draftId) return row;
                            const updated = { ...row, price: String(priceToSet) };
                            const cp = numFromDraftString(updated.countPlanned);
                            const p = priceToSet;
                            updated.total = (cp > 0 && p > 0) ? String(Math.round(cp * p * 100) / 100) : '';
                            return updated;
                        };
                        if (apiMode) {
                            setNormDraft((prev) => {
                                if (!prev) return prev;
                                setNormsDirty(true);
                                return { ...prev, materials: prev.materials.map(setPriceRow) };
                            });
                        } else {
                            setBody((prev) => {
                                const current = (Array.isArray(prev.refValues?.tmzMaterials) ? prev.refValues.tmzMaterials : []) as unknown[];
                                const drafts = current.map((raw, i) => refValuesRowToMaterialDraft(raw, i));
                                return {
                                    ...prev,
                                    refValues: {
                                        ...prev.refValues,
                                        tmzMaterials: drafts.map(setPriceRow).map(materialDraftToRefValuesStored) as TmzMaterialRow[],
                                    },
                                };
                            });
                        }
                    });
                }
            }
        },
        [apiMode, setBody, token],
    );

    const removeTmzWorkRow = useCallback(
        (row: DraftWorkRow) => {
            if (apiMode && row.serverId != null && !confirm('Қаторни ўчириш? (сақлашда сервердан ҳам ўчирилади)')) return;
            if (apiMode) {
                setNormDraft((prev) => {
                    if (!prev) return prev;
                    setNormsDirty(true);
                    return { ...prev, works: prev.works.filter((r) => r.draftId !== row.draftId) };
                });
            } else {
                setBody((prev) => {
                    const current = (Array.isArray(prev.refValues?.tmzWorks) ? prev.refValues.tmzWorks : []) as unknown[];
                    const drafts = current.map((raw, i) => refValuesRowToWorkDraft(raw, i));
                    const next = drafts.filter((r) => r.draftId !== row.draftId);
                    return {
                        ...prev,
                        refValues: { ...prev.refValues, tmzWorks: next.map(workDraftToRefValuesStored) as TmzWorkRow[] },
                    };
                });
            }
        },
        [apiMode, setBody],
    );

    const removeTmzMaterialRow = useCallback(
        (row: DraftMaterialRow) => {
            if (apiMode && row.serverId != null && !confirm('Қаторни ўчириш? (сақлашда сервердан ҳам ўчирилади)')) return;
            if (apiMode) {
                setNormDraft((prev) => {
                    if (!prev) return prev;
                    setNormsDirty(true);
                    return { ...prev, materials: prev.materials.filter((r) => r.draftId !== row.draftId) };
                });
            } else {
                setBody((prev) => {
                    const current = (Array.isArray(prev.refValues?.tmzMaterials) ? prev.refValues.tmzMaterials : []) as unknown[];
                    const drafts = current.map((raw, i) => refValuesRowToMaterialDraft(raw, i));
                    const next = drafts.filter((r) => r.draftId !== row.draftId);
                    return {
                        ...prev,
                        refValues: { ...prev.refValues, tmzMaterials: next.map(materialDraftToRefValuesStored) as TmzMaterialRow[] },
                    };
                });
            }
        },
        [apiMode, setBody],
    );

    const updateTmzHalfstuffDraft = useCallback(
        (draftId: string, field: keyof DraftHalfstuffRow, value: string) => {
            const mapRow = (row: DraftHalfstuffRow): DraftHalfstuffRow => {
                if (row.draftId !== draftId) return row;
                const next: DraftHalfstuffRow = { ...row, [field]: value };
                if (field === 'countPlanned' || field === 'price' || field === 'halfstuffId') {
                    const cp = numFromDraftString(next.countPlanned);
                    const p = numFromDraftString(next.price);
                    const t = cp > 0 && p > 0 ? String(Math.round(cp * p * 100) / 100) : '';
                    return { ...next, total: t, countInOrder: next.countPlanned };
                }
                return next;
            };

            setNormDraft((prev) => {
                if (!prev) return prev;
                setNormsDirty(true);
                return { ...prev, halfstuffs: prev.halfstuffs.map(mapRow) };
            });

            if (field === 'halfstuffId' && value && token && body.enterpriseId) {
                const hid = Number(value);
                if (Number.isFinite(hid) && hid > 0) {
                    const hs = halfstuffsCatalog.find((h) => Number(h.id) === hid);
                    void resolveHalfstuffStockPrice(
                        token,
                        Number(body.enterpriseId),
                        hid,
                        tmzHalfstuffStockDateMs,
                        hs?.refValues ?? null,
                    ).then(({ price: priceToSet }) => {
                        if (priceToSet <= 0) return;
                        setNormDraft((prev) => {
                            if (!prev) return prev;
                            setNormsDirty(true);
                            return {
                                ...prev,
                                halfstuffs: prev.halfstuffs.map((row) => {
                                    if (row.draftId !== draftId) return row;
                                    return withDerivedHalfstuffTotal({
                                        ...row,
                                        price: String(priceToSet),
                                    });
                                }),
                            };
                        });
                    });
                }
            }
        },
        [token, halfstuffsCatalog, body.enterpriseId, tmzHalfstuffStockDateMs],
    );

    const removeTmzHalfstuffRow = useCallback((row: DraftHalfstuffRow) => {
        if (row.serverId != null && !confirm('Қаторни ўчириш? (сақлашда сервердан ҳам ўчирилади)')) return;
        setNormDraft((prev) => {
            if (!prev) return prev;
            setNormsDirty(true);
            return { ...prev, halfstuffs: prev.halfstuffs.filter((r) => r.draftId !== row.draftId) };
        });
    }, []);

    const hasComponents = componentRows.some((r) => Number(r.componentId) > 0 && toNum(r.qty) > 0);

    const canImportNorms =
        !isReadOnly &&
        !hasComponents &&
        (!apiMode || (!normsLoading && normDraft != null));

    const resolveEffective = (
        reference: ReferenceModel | undefined,
        visited = new Set<number>(),
    ): { works: TmzWorkRow[]; materials: TmzMaterialRow[] } => {
        if (!reference?.id) return { works: [], materials: [] };
        const currentId = Number(reference.id);
        if (visited.has(currentId)) return { works: [], materials: [] };
        const nextVisited = new Set(visited);
        nextVisited.add(currentId);

        const localComponents = Array.isArray(reference.refValues?.tmzComponents)
            ? reference.refValues.tmzComponents
            : [];
        const effectiveWorks = new Map<string, TmzWorkRow>();
        const effectiveMaterials = new Map<number, TmzMaterialRow>();

        if (localComponents.length > 0) {
            for (const component of localComponents) {
                const componentId = Number(component.componentId);
                const qty = toNum(component.qty);
                if (!componentId || qty <= 0) continue;
                const child = productById.get(componentId);
                const childData = resolveEffective(child, nextVisited);
                for (const w of childData.works) {
                    const key = `${w.workName || ''}|${w.unit || ''}`;
                    const prev =
                        effectiveWorks.get(key) ??
                        ({
                            workName: w.workName || '',
                            unit: w.unit || '',
                            countInUnit: 0,
                            timeInUnit: 0,
                            salaryInUnit: 0,
                        } as TmzWorkRow);
                    prev.countInUnit = toNum(prev.countInUnit) + toNum(w.countInUnit) * qty;
                    prev.timeInUnit = toNum(prev.timeInUnit) + toNum(w.timeInUnit) * qty;
                    prev.salaryInUnit = toNum(prev.salaryInUnit) + toNum(w.salaryInUnit) * qty;
                    effectiveWorks.set(key, prev);
                }
                for (const m of childData.materials) {
                    const key = Number(m.materialId);
                    if (!key) continue;
                    const prev =
                        effectiveMaterials.get(key) ??
                        ({
                            materialId: key,
                            materialName: materialById.get(key)?.name || m.materialName || `ID ${key}`,
                            countPlanned: 0,
                            price: toNum(m.price),
                        } as TmzMaterialRow);
                    prev.countPlanned = toNum(prev.countPlanned) + toNum(m.countPlanned) * qty;
                    if (toNum(prev.price) === 0 && toNum(m.price) > 0) prev.price = toNum(m.price);
                    effectiveMaterials.set(key, prev);
                }
            }
            return { works: Array.from(effectiveWorks.values()), materials: Array.from(effectiveMaterials.values()) };
        }

        const worksRaw = Array.isArray(reference.refValues?.tmzWorks) ? reference.refValues.tmzWorks : [];
        const matsRaw = Array.isArray(reference.refValues?.tmzMaterials) ? reference.refValues.tmzMaterials : [];
        return {
            works: worksRaw.map((raw, i) => draftWorkToTmzEffective(refValuesRowToWorkDraft(raw, i))),
            materials: matsRaw.map((raw, i) => draftMaterialToTmzEffective(refValuesRowToMaterialDraft(raw, i), materialById)),
        };
    };

    const legacyEffective = useMemo(() => resolveEffective(body), [body, productById, materialById]);

    const worksSum = useMemo(() => {
        // Нархлаш (правая колонка): сумма выбранных общих работ (Умумий ишлар)
        if (apiMode) return commonWorksSelectedSum;
        return 0;
    }, [apiMode, commonWorksSelectedSum]);

    const worksTabSumForPricing = useMemo(() => {
        // Нархлаш (левая колонка): сумма вкладки Ишлар (salaryInUnit)
        if (apiMode) return worksDraftTableSumSalaryUnit;
        return 0;
    }, [apiMode, worksDraftTableSumSalaryUnit]);

    const materialsSum = useMemo(() => {
        let base = 0;
        if (apiMode && pricingCalc) {
            base = pricingCalc.materialsSum + (pricingCalc.halfstuffsSum ?? 0);
        } else if (apiMode && resolved) {
            base = resolved.materials.reduce(
                (acc, row) => acc + toNum(row.countPlanned) * toNum(row.price),
                0,
            );
            base += (resolved.halfstuffs ?? []).reduce(
                (acc, row) => acc + toNum(row.countPlanned) * toNum(row.price),
                0,
            );
        } else {
            base = legacyEffective.materials.reduce(
                (acc, row) => acc + toNum(row.countPlanned) * toNum(row.price),
                0,
            );
        }
        if (apiMode && !pricingCalc && !resolved) {
            base += halfstuffsDraftTableSum;
        }
        return base;
    }, [
        apiMode,
        pricingCalc,
        resolved,
        legacyEffective.materials,
        halfstuffsDraftTableSum,
    ]);

    const updateRefValues = (patch: Record<string, unknown>) => {
        setBody((prev) => ({
            ...prev,
            refValues: {
                ...prev.refValues,
                ...patch,
            },
        }));
    };

    /**
     * Как в furnitureOrder: после загрузки — PATCH только изменённого поля со списком в JSON.stringify(merged).
     * Не шлём второй список, чтобы не затереть его устаревшим состоянием из body.
     */
    const persistTmzFileListsPatch = useCallback(
        async (patch: Partial<{ filesFromScaling: TmzDrawingScalingFile[]; filesFromDrawing: TmzDrawingScalingFile[] }>) => {
            if (!apiMode || !token) return;
            const refValues: Record<string, string> = {};
            if (patch.filesFromScaling !== undefined) {
                refValues.filesFromScaling = JSON.stringify(normalizeTmzDrawingFilesList(patch.filesFromScaling));
            }
            if (patch.filesFromDrawing !== undefined) {
                refValues.filesFromDrawing = JSON.stringify(normalizeTmzDrawingFilesList(patch.filesFromDrawing));
            }
            if (Object.keys(refValues).length === 0) return;

            const updated = await ReferencesService.updateReference(
                referenceId,
                {
                    name: body.name,
                    typeReference: body.typeReference,
                    article: String(body.article ?? '').trim(),
                    isFolder: body.isFolder ?? false,
                    parentId: body.parentId ?? undefined,
                    enterpriseId: body.enterpriseId ?? null,
                    refValues: refValues as any,
                },
                token,
            );

            const rv = updated.refValues as ReferenceModel['refValues'] | undefined;
            if (rv) {
                setBody((prev) => ({
                    ...prev,
                    refValues: {
                        ...prev.refValues,
                        ...(rv.filesFromScaling !== undefined && {
                            filesFromScaling: normalizeTmzDrawingFilesList(rv.filesFromScaling),
                        }),
                        ...(rv.filesFromDrawing !== undefined && {
                            filesFromDrawing: normalizeTmzDrawingFilesList(rv.filesFromDrawing),
                        }),
                    },
                }));
            }
        },
        [
            apiMode,
            token,
            referenceId,
            body.name,
            body.typeReference,
            body.article,
            body.isFolder,
            body.parentId,
            body.enterpriseId,
        ],
    );

    /** Явное сохранение обоих списков в карточку (как отдельный шаг после загрузки файлов на сервер). */
    const handleSaveTmzFilesToCard = async () => {
        if (!apiMode || !token || isReadOnly) return;
        setFilesListSaving(true);
        try {
            const sentScaling = scalingFiles;
            const sentDrawing = drawingFiles;
            await persistTmzFileListsPatch({
                filesFromScaling: sentScaling,
                filesFromDrawing: sentDrawing,
            });
            setSavedFilesSnapshot({
                scaling: fileListSignature(sentScaling),
                drawing: fileListSignature(sentDrawing),
            });
            alert('Файллар карточкага сақланди.');
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : 'Файлларни сақлашда хатолик');
        } finally {
            setFilesListSaving(false);
        }
    };

    const updateListLegacy = <T,>(
        field: 'tmzWorks' | 'tmzMaterials' | 'tmzTechMap' | 'tmzComponents',
        updater: (prev: T[]) => T[],
    ) => {
        const current = (Array.isArray((body.refValues as any)?.[field]) ? (body.refValues as any)[field] : []) as T[];
        updateRefValues({ [field]: updater(current) });
    };

    const saveNormsToApi = async () => {
        if (!apiMode || !token || !normDraft) return;
        setNormsSaving(true);
        setNormsError('');
        try {
            const payload = draftToPayload(normDraft);
            const bundle = await productNormsApi.replaceAll(token, referenceId, payload);
            const [res, calc] = await Promise.all([
                productNormsApi.getResolved(token, referenceId),
                productNormsApi.getPricing(token, referenceId),
            ]);
            setNormDraft(bundleToDraft(bundle));
            setResolved(res);
            setPricingCalc(calc);
            setNormsDirty(false);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setNormsError(msg);
        } finally {
            setNormsSaving(false);
        }
    };

    const uploadBusyRef = useRef(false);
    const handleTmzFilePick = async (kind: 'scaling' | 'drawing', files: FileList | null) => {
        if (!files?.length || !token || filesReadOnly || uploadBusyRef.current) return;
        uploadBusyRef.current = true;
        let nextScaling: TmzDrawingScalingFile[] = [];
        let nextDrawing: TmzDrawingScalingFile[] = [];
        try {
            const uploadedMeta: TmzDrawingScalingFile[] = [];
            for (const file of Array.from(files)) {
                if (!isAllowedTmzAttachmentFile(file)) {
                    alert(
                        `Файл рухсат этилмайди (фақат расм, PDF, Excel): ${file.name}`,
                    );
                    continue;
                }
                const up = await productNormsApi.uploadReferenceFile(token, file, {
                    referenceId: referenceId,
                    kind: kind === 'scaling' ? 'SCALING' : 'DRAWING',
                });
                uploadedMeta.push({
                    url: up.url,
                    originalName: file.name,
                    visibleToClient: true,
                });
            }
            if (uploadedMeta.length === 0) return;

            setBody((prev) => {
                const ps = normalizeTmzDrawingFilesList(prev.refValues?.filesFromScaling);
                const pd = normalizeTmzDrawingFilesList(prev.refValues?.filesFromDrawing);
                nextScaling = kind === 'scaling' ? [...ps, ...uploadedMeta] : ps;
                nextDrawing = kind === 'drawing' ? [...pd, ...uploadedMeta] : pd;
                return {
                    ...prev,
                    refValues: {
                        ...prev.refValues,
                        ...(kind === 'scaling'
                            ? { filesFromScaling: nextScaling }
                            : { filesFromDrawing: nextDrawing }),
                    },
                };
            });

            /** Дарҳол карточкага ёзиш: акс ҳолда фақат маҳаллий state бўлади ва сервердан янгиланишда йўқолади */
            if (apiMode && token) {
                setFilesListSaving(true);
                try {
                    await persistTmzFileListsPatch({
                        filesFromScaling: nextScaling,
                        filesFromDrawing: nextDrawing,
                    });
                    setSavedFilesSnapshot({
                        scaling: fileListSignature(nextScaling),
                        drawing: fileListSignature(nextDrawing),
                    });
                } catch (persistErr) {
                    console.error(persistErr);
                    alert(
                        persistErr instanceof Error
                            ? persistErr.message
                            : 'Файллар юкланди, лекин рўйхатни карточкага сақлашда хатолик. «Файлларни сақлаш»ни босинг.',
                    );
                } finally {
                    setFilesListSaving(false);
                }
            }
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            uploadBusyRef.current = false;
        }
    };

    const handleRemoveScalingFile = async (idx: number) => {
        if (filesReadOnly || !token) return;
        const nextS = scalingFiles.filter((_, i) => i !== idx);
        updateRefValues({ filesFromScaling: nextS });
        if (!apiMode) return;
        setFilesListSaving(true);
        try {
            await persistTmzFileListsPatch({ filesFromScaling: nextS });
            setSavedFilesSnapshot((prev) => ({
                ...prev,
                scaling: fileListSignature(nextS),
            }));
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : 'Ўчиришни сақлашда хатолик');
        } finally {
            setFilesListSaving(false);
        }
    };

    const handleRemoveDrawingFile = async (idx: number) => {
        if (filesReadOnly || !token) return;
        const nextD = drawingFiles.filter((_, i) => i !== idx);
        updateRefValues({ filesFromDrawing: nextD });
        if (!apiMode) return;
        setFilesListSaving(true);
        try {
            await persistTmzFileListsPatch({ filesFromDrawing: nextD });
            setSavedFilesSnapshot((prev) => ({
                ...prev,
                drawing: fileListSignature(nextD),
            }));
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : 'Ўчиришни сақлашда хатолик');
        } finally {
            setFilesListSaving(false);
        }
    };

    const handleWorksExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !canImportNorms) return;

        setImportingWorks(true);
        setWorksImportWarning('');
        try {
            const parsed = await parseWorksShortXlsx(file);
            if (parsed.length === 0) {
                alert('Импортдан ишлар топилмади');
                return;
            }

            let monthRate = salaryMonthRate;
            if (monthRate <= 0 && token) {
                monthRate = await getSettingPereodicValueForDateByKey(
                    'salary.month',
                    Date.now(),
                    token,
                    body.enterpriseId ?? undefined,
                );
                if (monthRate > 0) setSalaryMonthRate(monthRate);
            }

            if (!token) {
                alert('Сессия истекла, войдите снова');
                return;
            }

            const worksList = await ReferencesService.getReferencesByType('WORKS', token);
            const freshWorksReferences = worksList.filter((w) => !w.isFolder);
            setWorksReferences(freshWorksReferences);

            const normalizeArticle = (v: string | undefined | null) => (v ?? '').trim().toLowerCase();
            const workRefByArticle = new Map<string, (typeof freshWorksReferences)[number]>();
            for (const ref of freshWorksReferences) {
                const art = ref.article?.trim();
                if (!art) continue;
                workRefByArticle.set(normalizeArticle(art), ref);
            }

            const importedRows: DraftWorkRow[] = [];
            const notFoundArticles: string[] = [];
            let seq = 0;

            for (const row of parsed) {
                const article = row.workArticle.trim();
                if (!article) continue;

                const ref = workRefByArticle.get(normalizeArticle(article));
                if (!ref) {
                    notFoundArticles.push(article);
                    continue;
                }

                const draftId = `xlsx-${Date.now()}-${seq++}`;
                const r = emptyDraftRow(draftId);
                r.workRefId = String(ref.id);
                r.workName = ref.name;
                r.workArticle = ref.article ?? '';
                r.unit = ref.refValues?.unit ?? '';
                r.assignedDeptId = ref.refValues?.workDeptId != null ? String(ref.refValues.workDeptId) : '';
                r.countInUnit = row.countInUnit;
                if (monthRate > 0) r.salaryRate = String(monthRate);
                if (ref.refValues?.norma != null) {
                    r.hourRate = String(ref.refValues.norma);
                }

                importedRows.push(
                    ref.refValues?.norma != null
                        ? recomputeDerived(r, 'hourRate')
                        : recomputeDerived(r, 'countInUnit'),
                );
            }

            if (importedRows.length === 0) {
                if (notFoundArticles.length > 0) {
                    setWorksImportWarning(
                        `Ни один артикул не найден в справочнике. Не найдено: ${notFoundArticles.join(', ')}`,
                    );
                }
                return;
            }

            const currentCount = apiMode ? (normDraft?.works.length ?? 0) : legacyWorksDraft.length;
            if (currentCount > 0 && !confirm('Жорий ишлар қаторларини Excel билан алмаштирасизми?')) {
                return;
            }

            if (apiMode) {
                setNormDraft((prev) => {
                    if (!prev) return prev;
                    setNormsDirty(true);
                    return { ...prev, works: importedRows };
                });
            } else {
                updateRefValues({ tmzWorks: importedRows.map(workDraftToRefValuesStored) });
            }

            if (notFoundArticles.length > 0) {
                setWorksImportWarning(
                    `Не найдено в справочнике (${notFoundArticles.length}): ${notFoundArticles.join(', ')}`,
                );
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Импорт хатоси');
        } finally {
            setImportingWorks(false);
        }
    };

    const handleRecalcWorkNorms = async () => {
        if (!token || isReadOnly || worksDraft.length === 0) return;

        setRecalcingWorkNorms(true);
        try {
            const worksList = await ReferencesService.getReferencesByType('WORKS', token);
            const freshWorksReferences = worksList.filter((w) => !w.isFolder);
            setWorksReferences(freshWorksReferences);

            const refById = new Map(
                freshWorksReferences
                    .filter((r) => r.id != null)
                    .map((r) => [String(r.id), r]),
            );

            const recalcRows = (rows: DraftWorkRow[]) =>
                rows.map((row) => {
                    if (!row.workRefId) return row;
                    const ref = refById.get(row.workRefId);
                    if (!ref) return row;
                    return refreshWorkRowNormaFromRef(row, ref);
                });

            if (apiMode) {
                patchNormDraft({ works: recalcRows(normDraft?.works ?? []) });
            } else {
                setBody((prev) => {
                    const current = (Array.isArray(prev.refValues?.tmzWorks) ? prev.refValues.tmzWorks : []) as unknown[];
                    const drafts = current.map((raw, i) => refValuesRowToWorkDraft(raw, i));
                    return {
                        ...prev,
                        refValues: {
                            ...prev.refValues,
                            tmzWorks: recalcRows(drafts).map(workDraftToRefValuesStored) as TmzWorkRow[],
                        },
                    };
                });
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Пересчет норм хатоси');
        } finally {
            setRecalcingWorkNorms(false);
        }
    };

    const handleMaterialsExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !canImportNorms) return;

        setImportingMaterials(true);
        setMaterialsImportWarning('');
        try {
            const parsed = await parseMaterialsXlsx(file);
            if (parsed.length === 0) {
                alert('Импортдан материаллар топилмади');
                return;
            }

            const normalizeArticle = (v: string) => v.trim().toLowerCase();
            const materialIdByArticle = new Map<string, number>();
            for (const material of materials) {
                const article = material.article?.trim();
                if (!article) continue;
                materialIdByArticle.set(normalizeArticle(article), Number(material.id));
            }

            const importedRows: DraftMaterialRow[] = [];
            let missedByArticle = 0;
            const notFoundArticles: string[] = [];
            const seenNotFound = new Set<string>();
            const collectedMaterialIds: number[] = [];

            for (const row of parsed) {
                const article = row.article.trim();
                const qty = row.countInOrder.trim();
                if (!article || !qty) continue;
                const mid = materialIdByArticle.get(normalizeArticle(article));
                if (!mid) {
                    missedByArticle += 1;
                    const key = normalizeArticle(article);
                    if (!seenNotFound.has(key)) {
                        seenNotFound.add(key);
                        notFoundArticles.push(article);
                    }
                    continue;
                }
                collectedMaterialIds.push(mid);
                importedRows.push({
                    draftId: makeId(),
                    materialId: String(mid),
                    finishedProductQty: '',
                    countPlanned: qty,
                    countInOrder: qty,
                    price: '',
                    total: '',
                });
            }

            const missedList = notFoundArticles.join(', ');
            const missedWarning =
                missedByArticle > 0
                    ? `Огоҳлантириш: ${missedByArticle} қатор киритилмади (артикул справочникда топилмади): ${missedList}.`
                    : '';

            if (importedRows.length === 0) {
                if (missedWarning) {
                    setMaterialsImportWarning(missedWarning);
                    alert(`Импортга мос материаллар топилмади (артикуллар ТМЗ да йўқ): ${missedList}`);
                } else {
                    alert('Импортга мос материаллар топилмади (артикуллар ТМЗ да йўқ)');
                }
                return;
            }

            if (token && collectedMaterialIds.length > 0) {
                try {
                    const priceMap = await getMaterialAveragePrices(collectedMaterialIds, token);
                    for (const row of importedRows) {
                        const mid = Number(row.materialId);
                        const avgPrice = priceMap[mid];
                        if (avgPrice && avgPrice > 0) {
                            row.price = String(avgPrice);
                            row.total = computeMaterialTotal(row.countPlanned, row.price);
                        }
                    }
                } catch {
                    // prices unavailable — rows stay with empty price
                }
            }

            const currentCount = apiMode ? (normDraft?.materials.length ?? 0) : legacyMaterialsDraft.length;
            if (currentCount > 0 && !confirm('Жорий материал қаторларини Excel билан алмаштирасизми?')) {
                return;
            }

            if (apiMode) {
                setNormDraft((prev) => {
                    if (!prev) return prev;
                    setNormsDirty(true);
                    return { ...prev, materials: importedRows };
                });
            } else {
                updateRefValues({ tmzMaterials: importedRows.map(materialDraftToRefValuesStored) });
            }

            if (missedWarning) {
                setMaterialsImportWarning(missedWarning);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Импорт хатоси');
        } finally {
            setImportingMaterials(false);
        }
    };

    const addWorksRow = () => {
        const draftId = makeId();
        const row = emptyDraftRow(draftId);
        if (salaryMonthRate > 0) row.salaryRate = String(salaryMonthRate);
        if (apiMode) {
            patchNormDraft({
                works: [...(normDraft?.works ?? []), row],
            });
        } else {
            setBody((prev) => {
                const current = (Array.isArray(prev.refValues?.tmzWorks) ? prev.refValues.tmzWorks : []) as unknown[];
                const drafts = current.map((raw, i) => refValuesRowToWorkDraft(raw, i));
                const next = [...drafts, row];
                return {
                    ...prev,
                    refValues: {
                        ...prev.refValues,
                        tmzWorks: next.map(workDraftToRefValuesStored) as TmzWorkRow[],
                    },
                };
            });
        }
        requestFocus(draftId);
    };

    const addMaterialsRow = () => {
        const draftId = makeId();
        const row = emptyMaterialDraftRow(draftId);
        if (apiMode) {
            patchNormDraft({
                materials: [...(normDraft?.materials ?? []), row],
            });
        } else {
            setBody((prev) => {
                const current = (Array.isArray(prev.refValues?.tmzMaterials) ? prev.refValues.tmzMaterials : []) as unknown[];
                const drafts = current.map((raw, i) => refValuesRowToMaterialDraft(raw, i));
                const next = [...drafts, row];
                return {
                    ...prev,
                    refValues: {
                        ...prev.refValues,
                        tmzMaterials: next.map(materialDraftToRefValuesStored) as TmzMaterialRow[],
                    },
                };
            });
        }
        requestFocus(draftId);
    };

    const addHalfstuffsRow = () => {
        const draftId = makeId();
        patchNormDraft({
            halfstuffs: [...(normDraft?.halfstuffs ?? []), emptyHalfstuffDraftRow(draftId)],
        });
        requestFocus(draftId);
    };

    const addComponentRow = () => {
        const draftId = makeId();
        if (apiMode) {
            patchNormDraft({
                components: [...(normDraft?.components ?? []), { draftId, componentId: 0, qty: 1 }],
            });
        } else {
            updateListLegacy<TmzComponentRow>('tmzComponents', (prev) => [
                ...prev,
                { draftId, componentId: 0, qty: 1 },
            ]);
        }
        requestFocus(draftId);
    };

    const addTechMapRow = () => {
        const draftId = makeId();
        if (apiMode) {
            const prevLen = normDraft?.routes?.length ?? 0;
            patchNormDraft({
                routes: [...(normDraft?.routes ?? []), { draftId, deptId: 0, sequence: prevLen + 1 }],
            });
        } else {
            updateListLegacy<TmzTechMapRow>('tmzTechMap', (prev) => [
                ...prev,
                { draftId, deptId: 0, sequence: prev.length + 1 },
            ]);
        }
        requestFocus(draftId);
    };

    const renderTabHeader = (
        <div className={styles.tabsBar}>
            <div className={styles.tabsList}>
                {visibleTabs.map((t) => (
                    <button
                        key={t}
                        type="button"
                        className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ''}`}
                        onClick={() => setTab(t)}
                    >
                        {TAB_LABELS[t]}
                    </button>
                ))}
            </div>
            {apiMode && !isReadOnly ? (
                <div className={styles.tabsNormsTrail}>
                    <button type="button" disabled={normsSaving || !normsDirty || normsLoading} onClick={() => void saveNormsToApi()}>
                        {normsSaving ? 'Сақланмоқда…' : 'Нормаларни сақлаш (сервер)'}
                    </button>
                    {normsDirty ? <span className={styles.normsDirtyInline}>Сақланмаган норма ўзгаришлари бор</span> : null}
                </div>
            ) : null}
        </div>
    );

    if (visibleTabs.length === 0) {
        return null;
    }

    return (
        <div className={styles.wrapper}>
            {renderTabHeader}

            <div className={styles.tabPanel}>
            {normsError && (
                <div className={styles.banner} role="alert">
                    {normsError}
                </div>
            )}
            {apiMode && normsLoading && <div className={styles.banner}>Нормалар юкланмоқда…</div>}

            {hasComponents && (tab === 'works' || tab === 'materials') && (
                <div className={styles.banner}>Есть составные части: прямые работы и материалы текущей карточки игнорируются при расчёте.</div>
            )}

            {tab === 'works' && (
                <div>
                    <div className={foStyles.worksToolbar}>
                        <div className={foStyles.worksToolbarLeft}>
                            <button
                                type="button"
                                className={foStyles.btnAdd}
                                disabled={isReadOnly || (apiMode && normsLoading)}
                                onClick={addWorksRow}
                            >
                                + Қатор
                            </button>
                            <label
                                className={`${foStyles.btnImport} ${!canImportNorms ? styles.btnImportDisabled : ''}`}
                            >
                                {importingWorks ? 'Ўқилмоқда...' : '↑ Excel импорт'}
                                <input
                                    type="file"
                                    className={foStyles.uploadInput}
                                    accept=".xlsx,.xls"
                                    disabled={!canImportNorms || importingWorks}
                                    onChange={(ev) => void handleWorksExcelImport(ev)}
                                />
                            </label>
                            <button
                                type="button"
                                className={foStyles.btnImport}
                                disabled={isReadOnly || recalcingWorkNorms || worksDraft.length === 0 || !token}
                                onClick={() => void handleRecalcWorkNorms()}
                            >
                                {recalcingWorkNorms ? 'Ҳисобланмоқда...' : 'Пересчет норм'}
                            </button>
                        </div>
                        {worksDraft.length > 0 && (
                            <div className={foStyles.worksToolbarTotals}>
                                <div className={foStyles.worksToolbarTotalLine}>
                                    <span className={foStyles.worksToolbarTotalLabel}>Жами</span>
                                    <span className={foStyles.worksToolbarTotalValue}>
                                        {formatWorksNumberDisplay(String(worksDraftTableSumSalaryUnit), 2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    {worksImportWarning && (
                        <div style={{ padding: '6px 10px', margin: '4px 0', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4, whiteSpace: 'pre-line', fontSize: 13 }}>
                            {worksImportWarning}
                        </div>
                    )}
                    <div className={foStyles.worksTableScroll}>
                        <table className={`${foStyles.worksTable} ${foStyles.worksTableWide}`}>
                            <thead>
                                <tr>
                                    <th className={foStyles.cellNumHead}>№</th>
                                    <th>Артикул</th>
                                    <th>Наименование</th>
                                    <th>Цех</th>
                                    <th>Ед.</th>
                                    <th>Норма</th>
                                    <th>Объём изд.</th>
                                    <th>Тр. изд.</th>
                                    <th>Нормо-час</th>
                                    <th>Стоим. изд.</th>
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
                                        <td className={foStyles.cellNum}>{rowIndex + 1}</td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {row.workArticle || '—'}
                                            </div>
                                        </td>
                                        <td style={{ position: 'relative', minWidth: 220 }}>
                                            <SearchableTableSelect
                                                className={foStyles.materialSearchSelect}
                                                options={worksReferences.filter((r) => r.id != null).map((r) => ({ id: r.id!, name: r.name }))}
                                                value={row.workRefId}
                                                onChange={(val) => updateTmzWorkDraft(row.draftId, 'workRefId', val)}
                                                placeholder="— Ишни танланг —"
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                autoFocus={shouldFocus(row.draftId)}
                                                onAutoFocusApplied={clearFocus}
                                            />
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {productionDepts.find((d) => String(d.id) === row.assignedDeptId)?.name || '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {row.unit || '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {row.hourRate ? Number(row.hourRate).toFixed(4) : '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <WorkNumericCell
                                                value={row.countInUnit}
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                className={`${foStyles.cellEditable} ${foStyles.cellEditableNum}`}
                                                onChange={(v) => updateTmzWorkDraft(row.draftId, 'countInUnit', v)}
                                            />
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {row.timeInUnit || '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <WorkNumericCell
                                                value={row.salaryRate}
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                className={`${foStyles.cellEditable} ${foStyles.cellEditableNum}`}
                                                onChange={(v) => updateTmzWorkDraft(row.draftId, 'salaryRate', v)}
                                            />
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {row.salaryInUnit
                                                    ? formatWorksNumberDisplay(row.salaryInUnit, 2)
                                                    : '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className={foStyles.fileItemDel}
                                                onClick={() => removeTmzWorkRow(row)}
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                title="Ўчириш"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {productionDepts.length === 0 && (
                        <div className={foStyles.hint}>
                            Ишлаб чиқариш цехлари рўйхати бўш — справочникда PRODUCTION омборларни текширинг.
                        </div>
                    )}
                </div>
            )}

            {tab === 'commonWorks' && (
                <div>
                    <div className={foStyles.worksToolbar}>
                        <div className={foStyles.worksToolbarLeft}>
                            <button
                                type="button"
                                className={foStyles.btnAdd}
                                disabled={isReadOnly || !apiMode || normsLoading}
                                onClick={() => {
                                    if (!apiMode) {
                                        alert('Аввал карточкани сақланг (сервер ID керак).');
                                        return;
                                    }
                                    const row = emptyCommonWorkDraftRow();
                                    patchNormDraft({
                                        commonWorks: [...commonWorksDraft, row],
                                    });
                                    requestFocus(row.draftId);
                                }}
                            >
                                + Қатор
                            </button>
                            <button
                                type="button"
                                className={foStyles.btnImport}
                                disabled={isReadOnly || !apiMode || normsLoading || !token}
                                onClick={() => {
                                    if (!apiMode || !token) {
                                        alert('Аввал карточкани сақланг (сервер ID керак).');
                                        return;
                                    }
                                    if (
                                        commonWorksDraft.length > 0 &&
                                        !confirm('Жадвалдаги қаторлар алмаштирилади. Давом этишни хоҳлайсизми?')
                                    ) {
                                        return;
                                    }
                                    void (async () => {
                                        const dateMs = Date.now();
                                        const enterpriseId = body.enterpriseId ?? undefined;
                                        const rows: DraftCommonWorkRow[] = [];
                                        for (const ref of commonWorksCatalog) {
                                            if (ref.id == null) continue;
                                            const price = await getPereodicValue(
                                                Number(ref.id),
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
                                                    unit: ref.refValues?.unit ?? '',
                                                    quantity: '0',
                                                    price: String(price || 0),
                                                    selected: false,
                                                }),
                                            );
                                        }
                                        patchNormDraft({ commonWorks: rows });
                                    })();
                                }}
                            >
                                Умумий ишларни тулдириш
                            </button>
                        </div>
                        {commonWorksDraft.length > 0 && (
                            <div className={foStyles.worksToolbarTotals}>
                                <div className={foStyles.worksToolbarTotalLine}>
                                    <span className={foStyles.worksToolbarTotalLabel}>Жами (танланган)</span>
                                    <span className={foStyles.worksToolbarTotalValue}>
                                        {formatWorksNumberDisplay(String(commonWorksSelectedSum), 2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={foStyles.worksTableScroll}>
                        <table className={`${foStyles.worksTable} ${foStyles.worksTableWide}`}>
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
                                        <td colSpan={7} className={foStyles.hint}>
                                            «+ Қатор» ёки «Умумий ишларни тулдириш» орқали тўлдиринг.
                                        </td>
                                    </tr>
                                )}
                                {commonWorksDraft.map((row) => {
                                    const selectOptions = (() => {
                                        const base = commonWorksCatalog
                                            .filter((r) => r.id != null)
                                            .map((r) => ({ id: r.id!, name: r.name }));
                                        const inList = base.some((o) => String(o.id) === row.commonWorkRefId);
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
                                                className={foStyles.worksSelectCheckbox}
                                                disabled={isReadOnly}
                                                checked={Boolean(row.selected)}
                                                onChange={(e) => {
                                                    const selected = e.target.checked;
                                                    patchNormDraft({
                                                        commonWorks: commonWorksDraft.map((r) =>
                                                            r.draftId === row.draftId
                                                                ? { ...r, selected }
                                                                : r,
                                                        ),
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td style={{ position: 'relative', minWidth: 220 }}>
                                            <SearchableTableSelect
                                                className={foStyles.materialSearchSelect}
                                                options={selectOptions}
                                                value={row.commonWorkRefId}
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                placeholder="— Ишни танланг —"
                                                autoFocus={shouldFocus(row.draftId)}
                                                onAutoFocusApplied={clearFocus}
                                                onChange={(val) => {
                                                    void (async () => {
                                                        const ref = commonWorksCatalog.find(
                                                            (r) => String(r.id) === val,
                                                        );
                                                        let price = 0;
                                                        if (ref?.id != null && token) {
                                                            price = await getPereodicValue(
                                                                Number(ref.id),
                                                                'firstPrice',
                                                                token,
                                                                Date.now(),
                                                                body.enterpriseId ?? undefined,
                                                            );
                                                        }
                                                        patchNormDraft({
                                                            commonWorks: commonWorksDraft.map((r) => {
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
                                                                    unit: ref.refValues?.unit ?? '',
                                                                    price: String(price || 0),
                                                                });
                                                            }),
                                                        });
                                                    })();
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {row.unit || '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <WorkNumericCell
                                                value={row.quantity}
                                                disabled={isReadOnly}
                                                className={`${foStyles.cellEditable} ${foStyles.cellEditableNum}`}
                                                onChange={(v) => {
                                                    patchNormDraft({
                                                        commonWorks: commonWorksDraft.map((r) =>
                                                            r.draftId === row.draftId
                                                                ? recomputeCommonWorkAmount({
                                                                      ...r,
                                                                      quantity: v,
                                                                  })
                                                                : r,
                                                        ),
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <WorkNumericCell
                                                value={row.price}
                                                disabled={isReadOnly}
                                                className={`${foStyles.cellEditable} ${foStyles.cellEditableNum}`}
                                                onChange={(v) => {
                                                    patchNormDraft({
                                                        commonWorks: commonWorksDraft.map((r) =>
                                                            r.draftId === row.draftId
                                                                ? recomputeCommonWorkAmount({
                                                                      ...r,
                                                                      price: v,
                                                                  })
                                                                : r,
                                                        ),
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {formatWorksNumberDisplay(row.amount || '0', 2)}
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className={foStyles.fileItemDel}
                                                disabled={isReadOnly}
                                                title="Ўчириш"
                                                onClick={() => {
                                                    if (
                                                        row.serverId != null &&
                                                        !confirm('Қаторни ўчириш? (сақлашда сервердан ҳам ўчирилади)')
                                                    ) {
                                                        return;
                                                    }
                                                    patchNormDraft({
                                                        commonWorks: commonWorksDraft.filter(
                                                            (r) => r.draftId !== row.draftId,
                                                        ),
                                                    });
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {commonWorksCatalog.length === 0 && (
                        <div className={foStyles.hint}>
                            Справочник «Умумий ишлар» бўш — аввал у ерга элементлар қўшинг.
                        </div>
                    )}
                </div>
            )}

            {tab === 'materials' && (
                <div>
                    <div className={foStyles.worksToolbar}>
                        <div className={foStyles.worksToolbarLeft}>
                            <button
                                type="button"
                                className={foStyles.btnAdd}
                                disabled={isReadOnly || (apiMode && normsLoading)}
                                onClick={addMaterialsRow}
                            >
                                + Қатор
                            </button>
                            <button
                                type="button"
                                className={foStyles.btnAdd}
                                disabled={
                                    isReadOnly ||
                                    (apiMode && normsLoading) ||
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
                            <label
                                className={`${foStyles.btnImport} ${!canImportNorms ? styles.btnImportDisabled : ''}`}
                            >
                                {importingMaterials ? 'Ўқилмоқда...' : '↑ Excel импорт'}
                                <input
                                    type="file"
                                    className={foStyles.uploadInput}
                                    accept=".xlsx,.xls"
                                    disabled={!canImportNorms || importingMaterials}
                                    onChange={(ev) => void handleMaterialsExcelImport(ev)}
                                />
                            </label>

                            {materialsImportWarning ? <span className={foStyles.error}>{materialsImportWarning}</span> : null}
                        </div>
                        {commonMaterialStorageMissing && (
                            <div className={foStyles.hint} style={{ marginBottom: 8 }}>
                                {COMMON_STORAGE_MISSING_MSG} — колдик каталогда кўринмайди.
                            </div>
                        )}
                        {materialsDraft.length > 0 && (
                            <div className={foStyles.worksToolbarTotals}>
                                <div className={foStyles.worksToolbarTotalLine}>
                                    <span className={foStyles.worksToolbarTotalLabel}>Жами</span>
                                    <span className={foStyles.worksToolbarTotalValue}>
                                        {formatWorksNumberDisplay(String(materialsDraftTableSum), 2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={foStyles.worksTableScroll}>
                        <table className={`${foStyles.worksTable} ${foStyles.worksTableBordered}`}>
                            <thead>
                                <tr>
                                    <th className={foStyles.cellNumHead}>№</th>
                                    <th>Материал</th>
                                    <th>Артикул</th>
                                    <th>Ед. изм</th>
                                    <th>Количество</th>
                                    <th>Цена</th>
                                    <th>Сумма</th>
                                    <th style={{ width: 36 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {materialsDraft.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                            Материаллар йўқ — «+ Қатор» босинг
                                        </td>
                                    </tr>
                                )}
                                {materialsDraft.map((row, rowIndex) => (
                                    <tr key={row.draftId}>
                                        <td className={foStyles.cellNum}>{rowIndex + 1}</td>
                                        <td style={{ position: 'relative', minWidth: 220 }}>
                                            <SearchableTableSelect
                                                className={foStyles.materialSearchSelect}
                                                options={materials.filter((m) => m.id != null).map((m) => ({
                                                    id: m.id!,
                                                    name: m.article ? `${m.article} — ${m.name}` : m.name,
                                                }))}
                                                value={row.materialId}
                                                onChange={(val) => updateTmzMaterialDraft(row.draftId, 'materialId', val)}
                                                placeholder="— Материални танланг —"
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                autoFocus={shouldFocus(row.draftId)}
                                                onAutoFocusApplied={clearFocus}
                                            />
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {row.materialId ? materialArticleById.get(row.materialId) || '—' : '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum}>
                                                {row.materialId ? materialUnitById.get(row.materialId) || '—' : '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <WorkNumericCell
                                                value={row.countPlanned}
                                                fractionDigits={3}
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                className={`${foStyles.cellEditable} ${foStyles.cellEditableNum}`}
                                                onChange={(v) => updateTmzMaterialDraft(row.draftId, 'countPlanned', v)}
                                            />
                                        </td>
                                        <td>
                                            <WorkNumericCell
                                                value={row.price}
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                className={`${foStyles.cellEditable} ${foStyles.cellEditableNum}`}
                                                onChange={(v) => updateTmzMaterialDraft(row.draftId, 'price', v)}
                                            />
                                        </td>
                                        <td>
                                            <div className={foStyles.cellDerivedNum} title="Количество × цена">
                                                {row.total.trim() !== '' ? formatWorksNumberDisplay(row.total, 2) : '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className={foStyles.fileItemDel}
                                                onClick={() => removeTmzMaterialRow(row)}
                                                disabled={isReadOnly || (apiMode && normsLoading)}
                                                title="Ўчириш"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {materials.length === 0 && (
                        <div className={foStyles.hint}>
                            Материаллар справочниги бўш — аввал «Номлар → ТМЗ» да материалларни киритинг.
                        </div>
                    )}
                    <ProductCatalog
                        isOpen={isMaterialCatalogOpen && Boolean(commonMaterialStorageId)}
                        onClose={() => setIsMaterialCatalogOpen(false)}
                        onSelectProduct={(product: Product, quantity: number) => {
                            const mid = String(product.id);
                            const qtyStr = formatMaterialQtyFromCatalog(quantity);
                            const row: DraftMaterialRow = {
                                draftId: makeId(),
                                materialId: mid,
                                finishedProductQty: '',
                                countPlanned: qtyStr,
                                countInOrder: qtyStr,
                                price: '',
                                total: '',
                            };
                            if (apiMode) {
                                patchNormDraft({
                                    materials: [...(normDraft?.materials ?? []), row],
                                });
                            } else {
                                setBody((prev) => {
                                    const current = (Array.isArray(prev.refValues?.tmzMaterials) ? prev.refValues.tmzMaterials : []) as unknown[];
                                    const drafts = current.map((raw, i) => refValuesRowToMaterialDraft(raw, i));
                                    const next = [...drafts, row];
                                    return {
                                        ...prev,
                                        refValues: {
                                            ...prev.refValues,
                                            tmzMaterials: next.map(materialDraftToRefValuesStored) as TmzMaterialRow[],
                                        },
                                    };
                                });
                            }
                            if (token) {
                                getMaterialAveragePrice(Number(mid), token).then((avgPrice) => {
                                    let priceToSet = avgPrice > 0 ? avgPrice : 0;
                                    if (priceToSet === 0) {
                                        const mat = materials.find((m) => Number(m.id) === Number(mid));
                                        const fallback = mat?.refValues?.costPriceInStart ?? mat?.refValues?.firstPrice ?? 0;
                                        if (fallback > 0) priceToSet = fallback;
                                    }
                                    const setPriceRow = (r: DraftMaterialRow): DraftMaterialRow => {
                                        if (r.draftId !== row.draftId) return r;
                                        const updated = { ...r, price: String(priceToSet) };
                                        updated.total = computeMaterialTotal(updated.countPlanned, updated.price);
                                        return updated;
                                    };
                                    if (apiMode) {
                                        setNormDraft((prev) => {
                                            if (!prev) return prev;
                                            setNormsDirty(true);
                                            return { ...prev, materials: prev.materials.map(setPriceRow) };
                                        });
                                    } else {
                                        setBody((prev) => {
                                            const current = (Array.isArray(prev.refValues?.tmzMaterials) ? prev.refValues.tmzMaterials : []) as unknown[];
                                            const drafts = current.map((raw, i) => refValuesRowToMaterialDraft(raw, i));
                                            return {
                                                ...prev,
                                                refValues: {
                                                    ...prev.refValues,
                                                    tmzMaterials: drafts.map(setPriceRow).map(materialDraftToRefValuesStored) as TmzMaterialRow[],
                                                },
                                            };
                                        });
                                    }
                                });
                            }
                            setIsMaterialCatalogOpen(false);
                        }}
                        typeDocumentByComeOut="come"
                        documentType={DocumentType.ComeMaterial}
                        documentDate={tmzMaterialStockDateMs}
                        warehouseId={commonMaterialStorageId ?? undefined}
                        allowNegativeStock={true}
                        referenceEnterpriseId={body.enterpriseId ?? null}
                        quantityFractionDigits={3}
                    />
                </div>
            )}

            {tab === 'halfstuffs' && (
                <div>
                    {!apiMode ? (
                        <div className={foStyles.hint}>
                            Полуфабрикатларни сақлаш учун аввал карточкани сақланг.
                        </div>
                    ) : (
                        <>
                            <div className={foStyles.worksToolbar}>
                                <div className={foStyles.worksToolbarLeft}>
                                    <button
                                        type="button"
                                        className={foStyles.btnAdd}
                                        disabled={isReadOnly || normsLoading}
                                        onClick={addHalfstuffsRow}
                                    >
                                        + Қатор
                                    </button>
                                    <button
                                        type="button"
                                        className={foStyles.btnAdd}
                                        disabled={
                                            isReadOnly ||
                                            normsLoading ||
                                            halfstuffWarehouseLoading ||
                                            halfstuffWarehouseMissing
                                        }
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
                                </div>
                                {halfstuffsDraft.length > 0 && (
                                    <div className={foStyles.worksToolbarTotals}>
                                        <div className={foStyles.worksToolbarTotalLine}>
                                            <span className={foStyles.worksToolbarTotalLabel}>Жами</span>
                                            <span className={foStyles.worksToolbarTotalValue}>
                                                {formatWorksNumberDisplay(String(halfstuffsDraftTableSum), 2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {halfstuffWarehouseMissing && (
                                <div className={foStyles.hint} style={{ marginBottom: 8 }}>
                                    {COMMON_STORAGE_MISSING_MSG} — колдик ва нарх каталогда кўринмайди.
                                </div>
                            )}
                            <div className={foStyles.worksTableScroll}>
                                <table className={`${foStyles.worksTable} ${foStyles.worksTableBordered}`}>
                                    <thead>
                                        <tr>
                                            <th className={foStyles.cellNumHead}>№</th>
                                            <th>Ярим тайёр махсулот</th>
                                            <th>Артикул</th>
                                            <th>Количество</th>
                                            <th>Цена</th>
                                            <th>Сумма</th>
                                            <th style={{ width: 36 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {halfstuffsDraft.length === 0 && (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                                    Я.Т.М йўқ — «+ Қатор» босинг
                                                </td>
                                            </tr>
                                        )}
                                        {halfstuffsDraft.map((row, rowIndex) => (
                                            <tr key={row.draftId}>
                                                <td className={foStyles.cellNum}>{rowIndex + 1}</td>
                                                <td style={{ position: 'relative', minWidth: 220 }}>
                                                    <SearchableTableSelect
                                                        className={foStyles.materialSearchSelect}
                                                        options={halfstuffsCatalog
                                                            .filter((h) => h.id != null)
                                                            .map((h) => ({
                                                                id: h.id!,
                                                                name: h.article ? `${h.article} — ${h.name}` : h.name,
                                                            }))}
                                                        value={row.halfstuffId}
                                                        onChange={(val) =>
                                                            updateTmzHalfstuffDraft(row.draftId, 'halfstuffId', val)
                                                        }
                                                        placeholder="— Я.Т.М танланг —"
                                                        disabled={isReadOnly || normsLoading}
                                                        autoFocus={shouldFocus(row.draftId)}
                                                        onAutoFocusApplied={clearFocus}
                                                    />
                                                </td>
                                                <td>
                                                    <div className={foStyles.cellDerivedNum}>
                                                        {row.halfstuffId
                                                            ? halfstuffArticleById.get(row.halfstuffId) || '—'
                                                            : '—'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <WorkNumericCell
                                                        value={row.countPlanned}
                                                        fractionDigits={3}
                                                        disabled={isReadOnly || normsLoading}
                                                        className={`${foStyles.cellEditable} ${foStyles.cellEditableNum}`}
                                                        onChange={(v) =>
                                                            updateTmzHalfstuffDraft(row.draftId, 'countPlanned', v)
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <WorkNumericCell
                                                        value={row.price}
                                                        disabled={isReadOnly || normsLoading}
                                                        className={`${foStyles.cellEditable} ${foStyles.cellEditableNum}`}
                                                        onChange={(v) =>
                                                            updateTmzHalfstuffDraft(row.draftId, 'price', v)
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <div className={foStyles.cellDerivedNum}>
                                                        {row.total.trim() !== ''
                                                            ? formatWorksNumberDisplay(row.total, 2)
                                                            : '—'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className={foStyles.fileItemDel}
                                                        onClick={() => removeTmzHalfstuffRow(row)}
                                                        disabled={isReadOnly || normsLoading}
                                                        title="Ўчириш"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {halfstuffsCatalog.length === 0 && (
                                <div className={foStyles.hint}>
                                    Ярим тайёр махсулотлар бўш — аввал «Номлар → ТМЗ»да киритинг.
                                </div>
                            )}
                            <ProductCatalog
                                isOpen={isHalfstuffCatalogOpen && Boolean(halfstuffWarehouseId)}
                                onClose={() => setIsHalfstuffCatalogOpen(false)}
                                onSelectProduct={(product: Product, quantity: number) => {
                                    const draftId = makeId();
                                    const row = emptyHalfstuffDraftRow(draftId);
                                    row.halfstuffId = String(product.id);
                                    const qtyStr = formatMaterialQtyFromCatalog(quantity);
                                    row.countPlanned = qtyStr;
                                    row.countInOrder = qtyStr;
                                    patchNormDraft({
                                        halfstuffs: [...(normDraft?.halfstuffs ?? []), row],
                                    });
                                    setIsHalfstuffCatalogOpen(false);

                                    if (token && body.enterpriseId) {
                                        void resolveHalfstuffStockPrice(
                                            token,
                                            Number(body.enterpriseId),
                                            product.id,
                                            tmzHalfstuffStockDateMs,
                                            {
                                                firstPrice: product.refValues?.firstPrice,
                                                costPriceInStart: product.refValues?.costPriceInStart,
                                            },
                                        ).then(({ price: priceToSet }) => {
                                            if (priceToSet <= 0) return;
                                            setNormDraft((prev) => {
                                                if (!prev) return prev;
                                                setNormsDirty(true);
                                                return {
                                                    ...prev,
                                                    halfstuffs: prev.halfstuffs.map((r) => {
                                                        if (r.draftId !== draftId) return r;
                                                        return withDerivedHalfstuffTotal({
                                                            ...r,
                                                            price: String(priceToSet),
                                                        });
                                                    }),
                                                };
                                            });
                                        });
                                    }
                                }}
                                typeDocumentByComeOut="come"
                                documentType={DocumentType.ComeHalfstuff}
                                documentDate={tmzHalfstuffStockDateMs}
                                warehouseId={halfstuffWarehouseId ?? undefined}
                                stockSchet={Schet.S21}
                                allowNegativeStock={true}
                                referenceEnterpriseId={body.enterpriseId ?? null}
                                quantityFractionDigits={3}
                            />
                        </>
                    )}
                </div>
            )}

            {tab === 'components' && (
                <div>
                    <p className={styles.hint}>
                        Компонент списывается со склада при производстве (LeaveHalfstuff / LeaveProd).
                        Нормы дочернего изделия не разворачиваются.
                    </p>
                    <div className={styles.actions}>
                        <button
                            type="button"
                            disabled={isReadOnly || (apiMode && normsLoading)}
                            onClick={addComponentRow}
                        >
                            + Қатор
                        </button>
                    </div>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Тайёр / Я.Т.М</th>
                                <th>Сони</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {componentRows.map((c, idx) => (
                                <tr key={c.draftId || idx}>
                                    <td>
                                        <select
                                            disabled={isReadOnly}
                                            value={c.componentId || 0}
                                            ref={el => applyNativeFocus(el, c.draftId ?? `idx-${idx}`, pendingDraftId, clearFocus)}
                                            onChange={(e) => {
                                                const id = toNum(e.target.value);
                                                const name = productById.get(id)?.name;
                                                if (apiMode) {
                                                    setNormDraft((prev) => {
                                                        if (!prev) return prev;
                                                        setNormsDirty(true);
                                                        const next = [...prev.components];
                                                        next[idx] = { ...next[idx], componentId: id, componentName: name };
                                                        return { ...prev, components: next };
                                                    });
                                                } else {
                                                    updateListLegacy<TmzComponentRow>('tmzComponents', (prev) =>
                                                        prev.map((x, i) => (i === idx ? { ...x, componentId: id, componentName: name } : x)),
                                                    );
                                                }
                                            }}
                                        >
                                            <option value={0}>— танланг —</option>
                                            {products
                                                .filter(
                                                    (p) =>
                                                        Number(p.id) !== Number(body.id) &&
                                                        (p.refValues?.typeTMZ === TypeTMZ.PRODUCT ||
                                                            p.refValues?.typeTMZ === TypeTMZ.HALFSTUFF),
                                                )
                                                .map((item) => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </td>
                                    <td>
                                        <input
                                            disabled={isReadOnly}
                                            type="number"
                                            min={0}
                                            step={0.001}
                                            value={toNum(c.qty)}
                                            onChange={(e) => {
                                                const n = toNum(e.target.value);
                                                if (apiMode) {
                                                    setNormDraft((prev) => {
                                                        if (!prev) return prev;
                                                        setNormsDirty(true);
                                                        const next = [...prev.components];
                                                        next[idx] = { ...next[idx], qty: n };
                                                        return { ...prev, components: next };
                                                    });
                                                } else {
                                                    updateListLegacy<TmzComponentRow>('tmzComponents', (prev) =>
                                                        prev.map((x, i) => (i === idx ? { ...x, qty: n } : x)),
                                                    );
                                                }
                                            }}
                                        />
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => {
                                                if (apiMode) {
                                                    setNormDraft((prev) => {
                                                        if (!prev) return prev;
                                                        setNormsDirty(true);
                                                        return { ...prev, components: prev.components.filter((_, i) => i !== idx) };
                                                    });
                                                } else {
                                                    updateListLegacy<TmzComponentRow>('tmzComponents', (prev) => prev.filter((_, i) => i !== idx));
                                                }
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'pricing' && token && (
                <PricingTabPanel
                    worksTabSum={worksTabSumForPricing}
                    commonWorksSum={worksSum}
                    materialsSum={materialsSum}
                    priceClass={body.refValues?.priceClass ?? PriceClass.A}
                    token={token}
                    enterpriseId={body.enterpriseId}
                    usesComponents={Boolean(apiMode && (pricingCalc?.usesComponents || resolved?.usesComponents))}
                    disabledBeforeCostMarkupCodes={
                        body.refValues?.tmzPricing?.disabledBeforeCostMarkupCodes ?? []
                    }
                    disabledBeforeCostMarkupCodesWorks={
                        body.refValues?.tmzPricing?.disabledBeforeCostMarkupCodesWorks ?? []
                    }
                    markupsReadOnly={isReadOnly || !apiMode}
                    onDisabledBeforeCostMarkupCodesChange={(codes) => {
                        let nextPricing = {
                            ...(body.refValues?.tmzPricing ?? {}),
                            disabledBeforeCostMarkupCodes: codes,
                        };
                        setBody((prev) => {
                            nextPricing = {
                                ...(prev.refValues?.tmzPricing ?? {}),
                                disabledBeforeCostMarkupCodes: codes,
                            };
                            return {
                                ...prev,
                                refValues: {
                                    ...prev.refValues,
                                    tmzPricing: nextPricing,
                                },
                            };
                        });
                        if (!apiMode || !token) return;
                        void ReferencesService.updateReference(
                            referenceId,
                            {
                                name: body.name,
                                typeReference: body.typeReference,
                                article: String(body.article ?? '').trim(),
                                isFolder: body.isFolder ?? false,
                                parentId: body.parentId ?? undefined,
                                enterpriseId: body.enterpriseId ?? null,
                                refValues: { tmzPricing: nextPricing } as any,
                            },
                            token,
                        ).catch((e) => {
                            console.error(e);
                            alert(
                                e instanceof Error
                                    ? e.message
                                    : 'Наценки флагini сақлашда хато',
                            );
                        });
                    }}
                    onDisabledBeforeCostMarkupCodesWorksChange={(codes) => {
                        let nextPricing = {
                            ...(body.refValues?.tmzPricing ?? {}),
                            disabledBeforeCostMarkupCodesWorks: codes,
                        };
                        setBody((prev) => {
                            nextPricing = {
                                ...(prev.refValues?.tmzPricing ?? {}),
                                disabledBeforeCostMarkupCodesWorks: codes,
                            };
                            return {
                                ...prev,
                                refValues: {
                                    ...prev.refValues,
                                    tmzPricing: nextPricing,
                                },
                            };
                        });
                        if (!apiMode || !token) return;
                        void ReferencesService.updateReference(
                            referenceId,
                            {
                                name: body.name,
                                typeReference: body.typeReference,
                                article: String(body.article ?? '').trim(),
                                isFolder: body.isFolder ?? false,
                                parentId: body.parentId ?? undefined,
                                enterpriseId: body.enterpriseId ?? null,
                                refValues: { tmzPricing: nextPricing } as any,
                            },
                            token,
                        ).catch((e) => {
                            console.error(e);
                            alert(
                                e instanceof Error
                                    ? e.message
                                    : 'Наценки флагini сақлашда хато',
                            );
                        });
                    }}
                />
            )}

            {tab === 'techMap' && (
                <div>
                    <div className={styles.actions}>
                        <button
                            type="button"
                            disabled={isReadOnly || (apiMode && normsLoading)}
                            onClick={addTechMapRow}
                        >
                            + Қатор
                        </button>
                    </div>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Тартиб</th>
                                <th>Цех</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {techMapRows.map((row, idx) => (
                                <tr key={row.draftId || idx}>
                                    <td>
                                        <input
                                            disabled={isReadOnly}
                                            type="number"
                                            value={toNum(row.sequence) || idx + 1}
                                            onChange={(e) => {
                                                const n = toNum(e.target.value);
                                                if (apiMode) {
                                                    setNormDraft((prev) => {
                                                        if (!prev) return prev;
                                                        setNormsDirty(true);
                                                        const next = [...prev.routes];
                                                        next[idx] = { ...next[idx], sequence: n };
                                                        return { ...prev, routes: next };
                                                    });
                                                } else {
                                                    updateListLegacy<TmzTechMapRow>('tmzTechMap', (prev) =>
                                                        prev.map((x, i) => (i === idx ? { ...x, sequence: n } : x)),
                                                    );
                                                }
                                            }}
                                        />
                                    </td>
                                    <td>
                                        <select
                                            disabled={isReadOnly}
                                            value={row.deptId || 0}
                                            ref={el => applyNativeFocus(el, row.draftId ?? `idx-${idx}`, pendingDraftId, clearFocus)}
                                            onChange={(e) => {
                                                const id = toNum(e.target.value);
                                                const deptName = productionDepts.find((d) => Number(d.id) === id)?.name;
                                                if (apiMode) {
                                                    setNormDraft((prev) => {
                                                        if (!prev) return prev;
                                                        setNormsDirty(true);
                                                        const next = [...prev.routes];
                                                        next[idx] = { ...next[idx], deptId: id, deptName };
                                                        return { ...prev, routes: next };
                                                    });
                                                } else {
                                                    updateListLegacy<TmzTechMapRow>('tmzTechMap', (prev) =>
                                                        prev.map((x, i) => (i === idx ? { ...x, deptId: id, deptName } : x)),
                                                    );
                                                }
                                            }}
                                        >
                                            <option value={0}>— танланг —</option>
                                            {productionDepts.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => {
                                                if (apiMode) {
                                                    setNormDraft((prev) => {
                                                        if (!prev) return prev;
                                                        setNormsDirty(true);
                                                        return { ...prev, routes: prev.routes.filter((_, i) => i !== idx) };
                                                    });
                                                } else {
                                                    updateListLegacy<TmzTechMapRow>('tmzTechMap', (prev) => prev.filter((_, i) => i !== idx));
                                                }
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'files' && (
                <div className={styles.filesGrid}>
                    <div className={styles.filesColumn}>
                        <div className={styles.fileTitleRow}>
                            <div className={styles.fileTitle}>Улчаш</div>
                            <label
                                className={`${styles.attachFilesBtn} ${styles.attachFilesBtnIcon} ${filesReadOnly || !token ? styles.attachFilesBtnDisabled : ''}`}
                                title="Файлларни қўшиш"
                                aria-label="Файлларни қўшиш"
                            >
                                <span aria-hidden="true">+</span>
                                <input
                                    type="file"
                                    multiple
                                    accept={TMZ_ATTACHMENT_ACCEPT}
                                    className={styles.uploadInput}
                                    disabled={filesReadOnly || !token}
                                    onChange={(e) => void handleTmzFilePick('scaling', e.target.files)}
                                />
                            </label>
                        </div>
                        <p className={styles.filesHint}>
                            Фақат расм (JPEG, PNG, …), PDF ёки Excel (.xls, .xlsx). Юкланган файллар рўйхати карточкага
                            автоматик сақланади. Янги карточкада аввал пастда «Сақлаш» билан ID олинг.
                        </p>
                        <div className={styles.fileCards}>
                            {scalingFiles.map((file, idx) => {
                                const rawUrl = getFileUrl(file);
                                const url = resolveTmzPublicFileUrl(rawUrl);
                                const img = isLikelyImageUrl(rawUrl);
                                return (
                                    <div key={`scaling-${idx}-${url.slice(0, 48)}`} className={styles.fileCard}>
                                        <button
                                            type="button"
                                            className={styles.fileThumbBtn}
                                            title={img ? 'Катта қилиб кўриш' : ''}
                                            onClick={() => {
                                                if (img) setPreviewUrl(url);
                                                else window.open(url, '_blank', 'noopener,noreferrer');
                                            }}
                                        >
                                            {img ? (
                                                <img src={url} alt="" className={styles.fileThumbImg} />
                                            ) : (
                                                <span className={styles.fileThumbBadge}>{fileThumbBadge(rawUrl)}</span>
                                            )}
                                        </button>
                                        <div className={styles.fileCardBody}>
                                            <div className={styles.fileCardName}>{fileDisplayName(file)}</div>
                                            <div className={styles.fileCardActions}>
                                                <button
                                                    type="button"
                                                    className={styles.fileActionBtn}
                                                    disabled={isReadOnly}
                                                    onClick={() => {
                                                        if (img) setPreviewUrl(url);
                                                        else window.open(url, '_blank', 'noopener,noreferrer');
                                                    }}
                                                >
                                                    Қараш
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.fileActionBtn}
                                                    disabled={isReadOnly}
                                                    onClick={() => void downloadTmzAttachment(rawUrl, fileDisplayName(file), token)}
                                                >
                                                    Юклаб олиш
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.fileActionBtnDanger}
                                                    disabled={filesReadOnly || filesListSaving}
                                                    onClick={() => void handleRemoveScalingFile(idx)}
                                                    title="Ўчириш"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className={styles.filesColumn}>
                        <div className={styles.fileTitleRow}>
                            <div className={styles.fileTitle}>Лойихалаш</div>
                            <label
                                className={`${styles.attachFilesBtn} ${styles.attachFilesBtnIcon} ${filesReadOnly || !token ? styles.attachFilesBtnDisabled : ''}`}
                                title="Файлларни қўшиш"
                                aria-label="Файлларни қўшиш"
                            >
                                <span aria-hidden="true">+</span>
                                <input
                                    type="file"
                                    multiple
                                    accept={TMZ_ATTACHMENT_ACCEPT}
                                    className={styles.uploadInput}
                                    disabled={filesReadOnly || !token}
                                    onChange={(e) => void handleTmzFilePick('drawing', e.target.files)}
                                />
                            </label>
                        </div>
                        <p className={styles.filesHint}>
                            Фақат расм (JPEG, PNG, …), PDF ёки Excel (.xls, .xlsx). Юкланган файллар рўйхати карточкага
                            автоматик сақланади. Янги карточкада аввал пастда «Сақлаш» билан ID олинг.
                        </p>
                        <div className={styles.fileCards}>
                            {drawingFiles.map((file, idx) => {
                                const rawUrl = getFileUrl(file);
                                const url = resolveTmzPublicFileUrl(rawUrl);
                                const img = isLikelyImageUrl(rawUrl);
                                return (
                                    <div key={`drawing-${idx}-${url.slice(0, 48)}`} className={styles.fileCard}>
                                        <button
                                            type="button"
                                            className={styles.fileThumbBtn}
                                            title={img ? 'Катта қилиб кўриш' : ''}
                                            onClick={() => {
                                                if (img) setPreviewUrl(url);
                                                else window.open(url, '_blank', 'noopener,noreferrer');
                                            }}
                                        >
                                            {img ? (
                                                <img src={url} alt="" className={styles.fileThumbImg} />
                                            ) : (
                                                <span className={styles.fileThumbBadge}>{fileThumbBadge(rawUrl)}</span>
                                            )}
                                        </button>
                                        <div className={styles.fileCardBody}>
                                            <div className={styles.fileCardName}>{fileDisplayName(file)}</div>
                                            <div className={styles.fileCardActions}>
                                                <button
                                                    type="button"
                                                    className={styles.fileActionBtn}
                                                    disabled={isReadOnly}
                                                    onClick={() => {
                                                        if (img) setPreviewUrl(url);
                                                        else window.open(url, '_blank', 'noopener,noreferrer');
                                                    }}
                                                >
                                                    Қараш
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.fileActionBtn}
                                                    disabled={isReadOnly}
                                                    onClick={() => void downloadTmzAttachment(rawUrl, fileDisplayName(file), token)}
                                                >
                                                    Юклаб олиш
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.fileActionBtnDanger}
                                                    disabled={filesReadOnly || filesListSaving}
                                                    onClick={() => void handleRemoveDrawingFile(idx)}
                                                    title="Ўчириш"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className={styles.filesSaveBar}>
                        <button
                            type="button"
                            className={styles.filesSaveBtn}
                            disabled={filesReadOnly || !token || !apiMode || filesListSaving}
                            onClick={() => void handleSaveTmzFilesToCard()}
                        >
                            {filesListSaving ? 'Сақланмоқда…' : 'Файлларни сақлаш'}
                        </button>
                        {!apiMode && token ? (
                            <p className={styles.filesSaveHint}>
                                Файлларни карточкага боглаш учун аввал карточкани сақланг (ID керак).
                            </p>
                        ) : null}
                    </div>
                </div>
            )}
            </div>

            {previewUrl ? (
                <div
                    className={styles.lightbox}
                    role="presentation"
                    onClick={() => setPreviewUrl(null)}
                >
                    <button
                        type="button"
                        className={styles.lightboxClose}
                        aria-label="Ёпиш"
                        onClick={() => setPreviewUrl(null)}
                    >
                        ×
                    </button>
                    <img
                        src={previewUrl}
                        alt=""
                        className={styles.lightboxImg}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ) : null}
        </div>
    );
}
