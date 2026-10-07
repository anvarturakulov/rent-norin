import { FormworkKind } from '@/app/interfaces/reference.interface';

/** Точка на чертеже, мм. Ось Y направлена вниз (как в SVG). */
export interface FwPoint {
  x: number;
  y: number;
}

/** Осевая линия ленты фундамента (строго горизонтальная или вертикальная). */
export interface FwSegment {
  id: string;
  a: FwPoint;
  b: FwPoint;
}

export type FwPieceStatus = 'ok' | 'shortage' | 'gap';

export interface FwPiece {
  /** null для вставки/зазора */
  analiticId: number | null;
  width: number;
  /** смещение от начала грани, мм */
  offset: number;
  status: FwPieceStatus;
}

export interface FwFaceLayout {
  faceId: string;
  tier: number;
  /** полезная длина грани после вычета полок угловых элементов */
  length: number;
  /** отступ от начальной вершины грани (полка углового элемента) */
  startInset: number;
  pieces: FwPiece[];
}

export type FwCornerStatus = 'ok' | 'shortage' | 'none';

export interface FwCornerLayout {
  cornerId: string;
  tier: number;
  analiticId: number | null;
  status: FwCornerStatus;
}

export interface FwSpecRow {
  analiticId: number;
  name: string;
  kind: FormworkKind;
  /** «600×1200» для щитов и углов */
  size?: string;
  /** сколько требуется по плану (с учётом остатков + нехватка) */
  need: number;
  /** сколько требовалось бы без ограничений по остаткам */
  idealNeed: number;
  stock: number;
  /** сколько выдаём из остатков */
  issue: number;
  shortage: number;
}

export interface FwTotals {
  outerLength: number;
  holeLength: number;
  cornersOuter: number;
  cornersInner: number;
  joints: number;
  panels: number;
  tiersCount: number;
}

export interface FormworkSolveResult {
  /** высоты ярусов снизу вверх, мм */
  tiers: number[];
  faceLayouts: FwFaceLayout[];
  cornerLayouts: FwCornerLayout[];
  spec: FwSpecRow[];
  warnings: string[];
  totals: FwTotals;
  /** остатки были известны на момент расчёта */
  stockKnown: boolean;
  solvedAt: number;
}

export interface FormworkLayout {
  segments: FwSegment[];
  /** ширина ленты фундамента, мм */
  stripWidth: number;
  /** высота фундамента (опалубки), мм */
  foundationHeight: number;
  /** допустимый зазор на грани, закрываемый вставкой, мм */
  maxGap: number;
  result?: FormworkSolveResult | null;
  savedAt?: number;
}

/** Элемент опалубки из справочника с остатком на складе. */
export interface FormworkElement {
  analiticId: number;
  name: string;
  kind: FormworkKind;
  width?: number;
  height?: number;
  norm?: number;
  stock: number;
}

// ---- геометрия ----

export interface FwContour {
  kind: 'outer' | 'hole';
  points: FwPoint[];
  /** знак площади по формуле шнурков, определяет ориентацию обхода */
  areaSign: 1 | -1;
}

export interface FwFace {
  id: string;
  contourIndex: number;
  from: FwPoint;
  to: FwPoint;
  length: number;
  /** единичный вектор направления from → to */
  dir: FwPoint;
  /** единичная нормаль, направленная от бетона */
  outward: FwPoint;
  startCornerId: string;
  endCornerId: string;
}

export interface FwCorner {
  id: string;
  contourIndex: number;
  point: FwPoint;
  type: 'outer' | 'inner';
  /** грань, заканчивающаяся в этом углу, и грань, начинающаяся в нём */
  inFaceId: string;
  outFaceId: string;
}

export interface FwBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FwGeometry {
  contours: FwContour[];
  faces: FwFace[];
  corners: FwCorner[];
  bounds: FwBounds;
  warnings: string[];
}

export const DEFAULT_FORMWORK_LAYOUT: FormworkLayout = {
  segments: [],
  stripWidth: 400,
  foundationHeight: 600,
  maxGap: 50,
  result: null,
};
