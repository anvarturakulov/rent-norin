export type OrderStageType =
    | 'TALABGOR'
    | 'SCALING'
    | 'DRAWING'
    | 'PRICING'
    | 'DOGOVOR'
    | 'TEXNOLOG'
    | 'CUTTING'
    | 'IN_PRODUCTION'
    | 'STORE'
    | 'DELIVERY'
    | 'COMPLETED';

export const ORDER_STAGE_SEQUENCE: OrderStageType[] = [
    'TALABGOR',
    'SCALING',
    'DRAWING',
    'PRICING',
    'DOGOVOR',
    'TEXNOLOG',
    'CUTTING',
    'IN_PRODUCTION',
    'STORE',
    'DELIVERY',
    'COMPLETED',
];

export type FurnitureOrderType = 'readyPrice' | 'individualPrice';

export const ORDER_TYPE_LABELS: Record<FurnitureOrderType, string> = {
    readyPrice: 'Нархи тайёр',
    individualPrice: 'Индивидуал',
};

const READY_PRICE_EXCLUDED_STAGES: OrderStageType[] = [
    'SCALING',
    'DRAWING',
    'PRICING',
    'IN_PRODUCTION',
    'CUTTING',
    'TEXNOLOG',
];

/** Временно скрытые этапы (не предлагаются в маршруте новых заявок) */
export const TEMPORARILY_DISABLED_STAGES: OrderStageType[] = ['PRICING', 'TEXNOLOG'];

export function getStagesForOrderType(type: FurnitureOrderType): OrderStageType[] {
    const all = ORDER_STAGE_SEQUENCE.filter(
        (s) => s !== 'COMPLETED' && !TEMPORARILY_DISABLED_STAGES.includes(s),
    );
    if (type === 'individualPrice') return [...all];
    return all.filter((s) => !READY_PRICE_EXCLUDED_STAGES.includes(s));
}

const LEGACY_MEETING_STAGE = 'MEETING';
const LEGACY_SAVDO_STAGE = 'SAVDO';
const LEGACY_APPROVED_STAGE = 'APPROVED';

export const normalizeOrderStage = (
    stage?: string | null,
): OrderStageType | undefined => {
    if (!stage) return undefined;
    if (stage === LEGACY_MEETING_STAGE || stage === LEGACY_SAVDO_STAGE) return 'TALABGOR';
    if (stage === LEGACY_APPROVED_STAGE) return 'TEXNOLOG';
    if (ORDER_STAGE_SEQUENCE.includes(stage as OrderStageType)) {
        return stage as OrderStageType;
    }
    return undefined;
};

export type PipelineStatus = 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED';
export type QueueStatus = 'PENDING' | 'ACTIVE' | 'DONE';
export type WorkStatus = 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'PAUSE' | 'DONE';
export type WorkQueueViewStatus = 'READY' | 'WAITING_QUEUE';
export type LogStatus = 'STARTED' | 'PAUSED' | 'FINISHED';
export type OrderHistoryEventType = 'STAGE' | 'DEPT';

export const STAGE_LABELS: Record<OrderStageType, string> = {
    TALABGOR: 'Талабгор',
    SCALING: 'Ўлчов',
    DRAWING: 'Чизма',
    PRICING: 'Нархлаш',
    DOGOVOR: 'Шартнома',
    TEXNOLOG: 'Технолог',
    CUTTING: 'Раскрой',
    IN_PRODUCTION: 'Ишлаб чиқариш',
    STORE: 'Омбор',
    DELIVERY: 'Етказиб бериш',
    COMPLETED: 'Тугатилди',
};

/** Фон бейджа / шапки по текущему этапу заявки (журнал, карточка) */
export const STAGE_BG: Record<OrderStageType, string> = {
    TALABGOR: '#d32f2f',
    SCALING: '#f5b342',
    DRAWING: '#7b1fa2',
    PRICING: '#f9a825',
    DOGOVOR: '#f56042',
    TEXNOLOG: '#757575',
    CUTTING: '#ecf542',
    IN_PRODUCTION: '#5e35b1',
    STORE: '#00796b',
    DELIVERY: '#1565c0',
    COMPLETED: '#4caf50',
};

export const STAGE_COLORS: Record<PipelineStatus, string> = {
    PENDING: '#9e9e9e',
    ACTIVE: '#1976d2',
    DONE: '#4caf50',
    SKIPPED: '#bdbdbd',
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
    OPEN: 'Очиқ',
    PENDING: 'Кутилмоқда',
    IN_PROGRESS: 'Жараёнда',
    PAUSE: 'Пауза',
    DONE: 'Тугатилди',
};

export interface FurnitureOrderClient {
    id: number;
    name: string;
}

export interface OrderPipelineStage {
    id: number;
    orderId: number;
    stageName: OrderStageType;
    sequence: number;
    status: PipelineStatus;
    startedAt?: number;
    completedAt?: number;
    completedByUserId?: number;
}

export interface OrderProductionQueue {
    id: number;
    orderId: number;
    deptId: number;
    sequence: number;
    status: QueueStatus;
    startedAt?: number;
    completedAt?: number;
    dept?: { id: number; name: string };
}

export interface WorkMaterialWriteoffLine {
    materialId: number;
    materialName?: string;
    count: number;
    total?: number;
    unit?: string;
}

export interface OrderWork {
    id: number;
    orderId: number;
    /** Порядок строки в списке работ заявки */
    lineIndex?: number;
    workName: string;
    workArticle?: string;
    workRefId?: number;
    workRef?: { id: number; name: string; article?: string; refValues?: { norma?: number; unit?: string } };
    assignedDeptId?: number;
    productionQueueId?: number;
    unit?: string;
    hourRate?: number;
    countInUnit?: number;
    finishedProductQty?: number;
    countInOrder?: number;
    timeInUnit?: number;
    timeInOrder?: number;
    salaryRate?: number;
    salaryInUnit?: number;
    salaryInOrder?: number;
    countTotalFact?: number;
    hourTotalFact?: number;
    workStatus: WorkStatus;
    canStartByQueue?: boolean;
    queueViewStatus?: WorkQueueViewStatus;
    hasMaterialWriteoff?: boolean;
    writeoffDocStatus?: 'OPEN' | 'PENDING' | 'PROVEDEN' | 'DELETED' | 'REJECTED' | null;
    /** Проведённые списания материалов по этой работе (агрегат по номенклатуре) */
    materialWriteoffs?: WorkMaterialWriteoffLine[];
    assignedDept?: { id: number; name: string };
    logs?: OrderWorkLog[];
    activeDeptIdsForOrder?: number[];
}

export interface ProductionBoardOrder {
    id: number;
    orderNumber: string;
    orderDate?: number;
    createdDate?: number;
    deadlineDate?: number;
    clientName: string;
    productName: string;
    activeDeptIds: number[];
    works: OrderWork[];
}

export interface ProductionBoardResponse {
    orders: ProductionBoardOrder[];
}

export interface OrderCuttingLine {
    id: number;
    orderId: number;
    enterpriseId?: number | null;
    materialId: number;
    length: number;
    width: number;
    quantity: number;
    comment?: string;
    material?: { id: number; name: string; article?: string };
}

export interface CuttingBalanceRow {
    materialId: number;
    length: number;
    width: number;
    remainQty: number;
    material?: { id: number; name: string; article?: string };
}

export interface OrderMaterial {
    id: number;
    orderId: number;
    materialId: number;
    price?: number;
    countPlanned?: number;
    finishedProductQty?: number;
    countInOrder?: number;
    countFact?: number;
    total?: number;
    material?: { id: number; name: string; article?: string; refValues?: { unit?: string; typeTMZ?: string } };
}

export interface OrderHalfstuff {
    id: number;
    orderId: number;
    halfstuffId: number;
    price?: number;
    countPlanned?: number;
    finishedProductQty?: number;
    countInOrder?: number;
    countFact?: number;
    total?: number;
    halfstuff?: { id: number; name: string; article?: string; refValues?: { unit?: string; typeTMZ?: string } };
}

export interface OrderStageHistory {
    id: number;
    orderId: number;
    eventType?: OrderHistoryEventType;
    fromStage?: OrderStageType;
    toStage?: OrderStageType;
    fromDeptId?: number | null;
    toDeptId?: number | null;
    changedByUserId: number;
    changedAt: number | string;
    comment?: string;
    changedByUser?: { id: number; name: string };
    fromDept?: { id: number; name: string };
    toDept?: { id: number; name: string };
}

export interface OrderStageFileMeta {
    url: string;
    originalName?: string;
    visibleToClient: boolean;
}

export interface OrderWorkLog {
    id: number;
    orderId: number;
    workId: number;
    workerId: number;
    date: number;
    startedAt?: number;
    finishedAt?: number;
    status: LogStatus;
    countFact?: number;
    calculatedSalary?: number;
    notes?: string;
    withoutMaterials?: boolean;
    hoursSpent?: number;
    worker?: { id: number; name: string };
    participants?: OrderWorkLogParticipant[];
    orderWorkLogWorkers?: OrderWorkLogParticipant[];
    materials?: OrderWorkLogMaterial[];
}

export interface WorkLeaveMaterialJournal {
    workId: number;
    orderId: number;
    hasWriteOff: boolean;
    documents: Array<{
        id: number;
        documentType?: string;
        docStatus: 'OPEN' | 'PENDING' | 'PROVEDEN' | 'DELETED' | 'REJECTED';
        date: number;
        userId: number;
        total?: number;
        docValues?: {
            productForChargeId?: number;
            count?: number;
        };
        createdBy?: string | null;
    }>;
}

export interface OrderWorkLogParticipant {
    id: number;
    logId: number;
    workerId: number;
    sharePercent: number;
    countFactShare?: number;
    calculatedSalaryShare?: number;
    worker?: { id: number; name: string };
}

export interface OrderWorkLogMaterial {
    id: number;
    logId: number;
    materialId: number;
    consumedQty: number;
    consumedTotal?: number;
    leaveMaterialDocId?: number;
    writeOffStatus?: 'NOT_CREATED' | 'CREATED' | 'FAILED';
    material?: { id: number; name: string };
}

export interface StoreWorkDocumentInfo {
    documentId: number;
    documentType: string;
    docStatus: string;
    count?: number;
    total?: number;
    costTotal?: number;
    date?: number;
}

export interface ReceiptProgress {
    plannedQty: number;
    postedQty: number;
    remainingQty: number;
    plannedCost: number;
    postedCost: number;
    remainingCost: number;
}

export interface SaleProgress {
    plannedQty: number;
    postedQty: number;
    remainingQty: number;
    plannedTotal: number;
    postedTotal: number;
    remainingTotal: number;
}

export interface SaleAvailability {
    warehouseBalance: number;
    orderRemainingQty: number;
    openSaleQty: number;
    availableQty: number;
    stockAsOfDate: number;
}

export interface MaterialWriteoffLine {
    documentId: number;
    date: number;
    documentType?: string;
    workId?: number;
    materialId?: number;
    halfstuffId?: number;
    materialName?: string;
    count: number;
    price?: number;
    balance?: number;
    total: number;
    docStatus: string;
}

export interface OrderCostBreakdown {
    materialsPosted: number;
    materialsOpen: number;
    salaryCalculated: number;
    salaryPosted: number;
    otherPosted: number;
    costTotal: number;
    hasUnprovedWriteoffs: boolean;
}

export interface WriteoffProgressLine {
    materialId?: number;
    halfstuffId?: number;
    name?: string;
    unit?: string;
    planned: number;
    writtenOff: number;
    remaining: number;
    writtenOffTotal?: number;
    writtenOffPrice?: number;
}

export interface OrphanWorkSummary {
    id: number;
    workName: string;
    workStatus: WorkStatus;
    assignedDeptId?: number | null;
    assignedDeptName?: string | null;
}

export interface StoreWorkResponse {
    orderId: number;
    requiresReceipt: boolean;
    requiresClientSale: boolean;
    needsMaterialWriteoff: boolean;
    needsHalfstuffWriteoff: boolean;
    receiptType: string | null;
    saleType: string | null;
    materialWriteoffs: MaterialWriteoffLine[];
    halfstuffWriteoffs: MaterialWriteoffLine[];
    materialWriteoff: StoreWorkDocumentInfo | null;
    halfstuffWriteoff: StoreWorkDocumentInfo | null;
    materialWriteoffComplete: boolean;
    halfstuffWriteoffComplete: boolean;
    materialWriteoffProgress: WriteoffProgressLine[];
    halfstuffWriteoffProgress: WriteoffProgressLine[];
    materialWriteoffDocuments: StoreWorkDocumentInfo[];
    halfstuffWriteoffDocuments: StoreWorkDocumentInfo[];
    costBreakdown: OrderCostBreakdown;
    receipt: StoreWorkDocumentInfo | null;
    sale: StoreWorkDocumentInfo | null;
    receiptDocuments: StoreWorkDocumentInfo[];
    saleDocuments: StoreWorkDocumentInfo[];
    receiptProgress: ReceiptProgress | null;
    saleProgress: SaleProgress | null;
    receiptComplete: boolean;
    saleComplete: boolean;
    saleAvailability: SaleAvailability | null;
    saleCostSource?: 'receipt' | 'stock' | 'none' | null;
    stockBalance?: number | null;
    stockCostPrice?: number | null;
    stockCostTotal?: number | null;
    stockAsOfDate?: number | null;
    canAdvanceFromStore: boolean;
    advanceBlockers: string[];
    advanceWarnings: string[];
    orphanWorks: OrphanWorkSummary[];
    allowReceiptWithoutFullWriteoff: boolean;
    canCreateReceipt: boolean;
    receiptBlockers: string[];
    receiptWarnings: string[];
}

export interface WriteoffStockEntry {
    balance: number;
    price: number;
}

export interface WriteoffStocksResponse {
    stockAsOfDate: number;
    materialWarehouseId: number | null;
    materials: Record<string, WriteoffStockEntry>;
    halfstuffs: Record<string, WriteoffStockEntry>;
}

export interface FurnitureOrder {
    id: number;
    enterpriseId: number;
    clientId: number;
    analiticId?: number;
    receiptDocId?: number;
    saleDocId?: number;
    materialWriteoffDocId?: number;
    halfstuffWriteoffDocId?: number;
    requiresClientSale?: boolean;
    allowReceiptWithoutFullWriteoff?: boolean;
    orderNumber: string;
    orderType?: FurnitureOrderType;
    currentStage: OrderStageType;
    createdDate: number | string;
    orderDate?: number | string;
    deadlineDate?: number | string;
    count?: number;
    price?: number;
    profitRate?: number;
    profitValue?: number;
    discount?: number;
    total?: number;
    comment?: string;
    filesFromScaling?: string;
    filesFromDrawing?: string;
    filesFromPricing?: string;
    filesFromStore?: string;
    filesFromDelivery?: string;
    client?: FurnitureOrderClient;
    analitic?: { id: number; name: string; article?: string };
    pipelineStages?: OrderPipelineStage[];
    productionQueue?: OrderProductionQueue[];
    works?: OrderWork[];
    commonWorks?: OrderCommonWork[];
    materials?: OrderMaterial[];
    halfstuffs?: OrderHalfstuff[];
    cuttingIssues?: OrderCuttingLine[];
    cuttingOutputs?: OrderCuttingLine[];
    stageHistory?: OrderStageHistory[];
    disabledBeforeCostMarkupCodes?: string[] | null;
    disabledBeforeCostMarkupCodesWorks?: string[] | null;
}

export interface OrderCommonWork {
    id?: number;
    orderId?: number;
    lineIndex?: number;
    commonWorkRefId?: number;
    workName: string;
    unit?: string;
    quantity?: number;
    price?: number;
    amount?: number;
    quantityInOrder?: number;
    amountInOrder?: number;
    selected?: boolean;
    sourceNormId?: number;
}

export interface CreateFurnitureOrderPayload {
    enterpriseId: number;
    clientId: number;
    analiticId?: number;
    /** Не передаётся — номер задаёт сервер (001-YYYY). */
    orderNumber?: string;
    createdDate: number;
    orderDate?: number;
    deadlineDate?: number;
    count?: number;
    price?: number;
    total?: number;
    comment?: string;
    orderType: FurnitureOrderType;
    stages: OrderStageType[];
    productionDeptIds?: number[];
}

export interface UpdateFurnitureOrderPayload {
    clientId?: number;
    analiticId?: number;
    orderDate?: number;
    deadlineDate?: number;
    count?: number;
    price?: number;
    profitRate?: number;
    profitValue?: number;
    discount?: number;
    total?: number;
    comment?: string;
    orderType?: FurnitureOrderType;
    stages?: OrderStageType[];
    filesFromScaling?: string;
    filesFromDrawing?: string;
    filesFromPricing?: string;
    filesFromStore?: string;
    filesFromDelivery?: string;
    requiresClientSale?: boolean;
    allowReceiptWithoutFullWriteoff?: boolean;
    disabledBeforeCostMarkupCodes?: string[] | null;
    disabledBeforeCostMarkupCodesWorks?: string[] | null;
}

export interface WorkTimeReportSession {
    logId: number;
    startedAt?: number;
    finishedAt?: number;
    hoursSpent: number;
    status: LogStatus;
}

export interface WorkTimeReportWorker {
    workerId: number;
    workerName: string;
    totalHours: number;
    sessions: WorkTimeReportSession[];
}

export interface WorkTimeReportWork {
    workId: number;
    workName: string;
    workArticle?: string;
    assignedDeptName?: string;
    totalLaborHours: number;
    workers: WorkTimeReportWorker[];
}

export interface WorkTimeReportOrder {
    orderId: number;
    orderNumber: string;
    clientName?: string;
    productName?: string;
    totalLaborHours: number;
    works: WorkTimeReportWork[];
}

export interface WorkTimeReportResponse {
    dateFrom: number;
    dateTo: number;
    summary: { totalLaborHours: number };
    orders: WorkTimeReportOrder[];
}

export interface MyWorkerResponse {
    workerId: number;
    workerName?: string;
}
