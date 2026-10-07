export enum OrderStageType {
  TALABGOR = "TALABGOR",
  SCALING = "SCALING",
  DRAWING = "DRAWING",
  PRICING = "PRICING",
  DOGOVOR = "DOGOVOR",
  TEXNOLOG = "TEXNOLOG",
  CUTTING = "CUTTING",
  IN_PRODUCTION = "IN_PRODUCTION",
  STORE = "STORE",
  DELIVERY = "DELIVERY",
  COMPLETED = "COMPLETED",
}

/** Порядок этапов в маршруте заявки */
export const ORDER_STAGE_SEQUENCE: OrderStageType[] = [
  OrderStageType.TALABGOR,
  OrderStageType.SCALING,
  OrderStageType.DRAWING,
  OrderStageType.PRICING,
  OrderStageType.DOGOVOR,
  OrderStageType.TEXNOLOG,
  OrderStageType.CUTTING,
  OrderStageType.IN_PRODUCTION,
  OrderStageType.STORE,
  OrderStageType.DELIVERY,
  OrderStageType.COMPLETED,
];

export enum FurnitureOrderType {
  READY_PRICE = "readyPrice",
  INDIVIDUAL_PRICE = "individualPrice",
}

export const ORDER_TYPE_LABELS: Record<FurnitureOrderType, string> = {
  [FurnitureOrderType.READY_PRICE]: "Нархи тайёр",
  [FurnitureOrderType.INDIVIDUAL_PRICE]: "Индивидуал нарх",
};

const READY_PRICE_EXCLUDED_STAGES: OrderStageType[] = [
  OrderStageType.SCALING,
  OrderStageType.DRAWING,
  OrderStageType.PRICING,
  OrderStageType.IN_PRODUCTION,
  OrderStageType.CUTTING,
  OrderStageType.TEXNOLOG,
];

/** Временно скрытые этапы (не предлагаются в маршруте новых заявок) */
export const TEMPORARILY_DISABLED_STAGES: OrderStageType[] = [
  OrderStageType.PRICING,
  OrderStageType.TEXNOLOG,
];

export function getStagesForOrderType(
  type: FurnitureOrderType,
): OrderStageType[] {
  const all = ORDER_STAGE_SEQUENCE.filter(
    (s) =>
      s !== OrderStageType.COMPLETED &&
      !TEMPORARILY_DISABLED_STAGES.includes(s),
  );
  if (type === FurnitureOrderType.INDIVIDUAL_PRICE) return [...all];
  return all.filter((s) => !READY_PRICE_EXCLUDED_STAGES.includes(s));
}

export const LEGACY_MEETING_STAGE = "MEETING";
export const LEGACY_SAVDO_STAGE = "SAVDO";
export const LEGACY_APPROVED_STAGE = "APPROVED";

export const LEGACY_ORDER_STAGE_VALUES = [
  LEGACY_MEETING_STAGE,
  LEGACY_APPROVED_STAGE,
] as const;

export const normalizeOrderStage = (
  stage?: string | null,
): OrderStageType | undefined => {
  if (!stage) return undefined;
  if (stage === LEGACY_MEETING_STAGE || stage === LEGACY_SAVDO_STAGE) {
    return OrderStageType.TALABGOR;
  }
  if (stage === LEGACY_APPROVED_STAGE) return OrderStageType.TEXNOLOG;
  return Object.values(OrderStageType).includes(stage as OrderStageType)
    ? (stage as OrderStageType)
    : undefined;
};

export enum PipelineStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  DONE = "DONE",
  SKIPPED = "SKIPPED",
}

export enum QueueStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  DONE = "DONE",
}

export enum WorkStatus {
  OPEN = "OPEN",
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  PAUSE = "PAUSE",
  DONE = "DONE",
}

export enum LogStatus {
  STARTED = "STARTED",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
}

export enum OrderHistoryEventType {
  STAGE = "STAGE",
  DEPT = "DEPT",
}
