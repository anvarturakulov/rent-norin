import { FormworkKind } from '@/app/interfaces/reference.interface';
import {
  FormworkElement,
  FormworkSolveResult,
  FwCorner,
  FwCornerLayout,
  FwFace,
  FwFaceLayout,
  FwGeometry,
  FwPiece,
  FwSpecRow,
} from './formwork.types';
import { contourLength } from './geometry';

const MAX_TIERS = 6;
const HEIGHT_TOLERANCE = 1;

const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
};

/**
 * Подбор высот ярусов: минимальный перебор по высоте, затем минимум ярусов.
 * Возвращает высоты снизу вверх (по убыванию).
 */
export const planTiers = (foundationHeight: number, panelHeights: number[]): number[] => {
  const heights = Array.from(new Set(panelHeights.filter((h) => h > 0).map((h) => Math.round(h))))
    .sort((a, b) => b - a);
  if (!heights.length || foundationHeight <= 0) return [foundationHeight];

  const state: { best: number[] | null; bestOver: number } = { best: null, bestOver: Infinity };

  const minH = heights[heights.length - 1];
  const maxTiers = Math.min(MAX_TIERS, Math.ceil(foundationHeight / minH) + 1);

  const dfs = (startIdx: number, chosen: number[], sum: number) => {
    if (sum >= foundationHeight - HEIGHT_TOLERANCE) {
      const over = sum - foundationHeight;
      if (
        over < state.bestOver - HEIGHT_TOLERANCE ||
        (Math.abs(over - state.bestOver) <= HEIGHT_TOLERANCE &&
          state.best &&
          chosen.length < state.best.length)
      ) {
        state.bestOver = over;
        state.best = [...chosen];
      }
      return;
    }
    if (chosen.length >= maxTiers) return;
    for (let i = startIdx; i < heights.length; i++) {
      chosen.push(heights[i]);
      dfs(i, chosen, sum + heights[i]);
      chosen.pop();
    }
  };
  dfs(0, [], 0);

  return state.best ?? [heights[0]];
};

const fitsTier = (el: FormworkElement, tierHeight: number): boolean =>
  !el.height || Math.abs(el.height - tierHeight) <= HEIGHT_TOLERANCE;

interface CoverResult {
  /** количество по индексам элементов */
  counts: number[];
  covered: number;
}

/** Неограниченный рюкзак: максимальное покрытие ≤ target, затем минимум щитов. */
const coverLengthUnbounded = (target: number, widths: number[], step: number): CoverResult => {
  const n = widths.length;
  const T = Math.floor(target / step);
  if (T <= 0 || !n) return { counts: new Array(n).fill(0), covered: 0 };

  const INF = 1e9;
  const dp = new Array<number>(T + 1).fill(INF);
  const parent = new Int32Array(T + 1).fill(-1);
  dp[0] = 0;
  const units = widths.map((w) => Math.round(w / step));
  for (let k = 1; k <= T; k++) {
    for (let i = 0; i < n; i++) {
      const w = units[i];
      if (w > 0 && w <= k && dp[k - w] + 1 < dp[k]) {
        dp[k] = dp[k - w] + 1;
        parent[k] = i;
      }
    }
  }
  let bestK = 0;
  for (let k = T; k >= 0; k--) {
    if (dp[k] < INF) {
      bestK = k;
      break;
    }
  }
  const counts = new Array(n).fill(0);
  for (let k = bestK; k > 0; ) {
    const i = parent[k];
    counts[i] += 1;
    k -= units[i];
  }
  return { counts, covered: bestK * step };
};

/**
 * Ограниченный рюкзак: покрыть длину ≤ target минимальным числом щитов,
 * не превышая bound[i] по каждому типу. Максимизируем покрытие, затем минимизируем число щитов.
 */
const coverLength = (
  target: number,
  widths: number[],
  bounds: number[],
  step: number,
): CoverResult => {
  const n = widths.length;
  if (bounds.every((b) => b >= Number.MAX_SAFE_INTEGER)) {
    return coverLengthUnbounded(target, widths, step);
  }
  const T = Math.floor(target / step);
  if (T <= 0 || !n) return { counts: new Array(n).fill(0), covered: 0 };

  const INF = 1e9;
  let dp = new Array<number>(T + 1).fill(INF);
  dp[0] = 0;
  // стадии для восстановления: на каждой стадии одна копия одного элемента
  const stageItem: number[] = [];
  const stageTaken: Uint8Array[] = [];

  for (let i = 0; i < n; i++) {
    const w = Math.round(widths[i] / step);
    if (w <= 0) continue;
    const copies = Math.min(bounds[i], Math.floor(T / w));
    for (let c = 0; c < copies; c++) {
      const taken = new Uint8Array(T + 1);
      const next = dp.slice();
      for (let k = T; k >= w; k--) {
        const cand = dp[k - w] + 1;
        if (cand < next[k]) {
          next[k] = cand;
          taken[k] = 1;
        }
      }
      dp = next;
      stageItem.push(i);
      stageTaken.push(taken);
    }
  }

  let bestK = 0;
  for (let k = T; k >= 0; k--) {
    if (dp[k] < INF) {
      bestK = k;
      break;
    }
  }

  const counts = new Array(n).fill(0);
  let k = bestK;
  for (let s = stageTaken.length - 1; s >= 0 && k > 0; s--) {
    if (stageTaken[s][k]) {
      counts[stageItem[s]] += 1;
      k -= Math.round(widths[stageItem[s]] / step);
    }
  }

  return { counts, covered: bestK * step };
};

interface Pool {
  remaining: Map<number, number>;
  known: boolean;
}

const takeFromPool = (pool: Pool, analiticId: number, qty: number) => {
  if (!pool.known) return;
  pool.remaining.set(analiticId, (pool.remaining.get(analiticId) ?? 0) - qty);
};

const availableIn = (pool: Pool, analiticId: number): number =>
  pool.known ? Math.max(0, pool.remaining.get(analiticId) ?? 0) : Number.POSITIVE_INFINITY;

const sizeLabel = (el: FormworkElement): string | undefined => {
  if (el.width && el.height) return `${el.width}×${el.height}`;
  if (el.width) return `${el.width}`;
  return undefined;
};

export interface SolveInput {
  geometry: FwGeometry;
  elements: FormworkElement[];
  foundationHeight: number;
  maxGap: number;
  stockKnown: boolean;
}

export const solveFormwork = (input: SolveInput): FormworkSolveResult => {
  const { geometry, elements, foundationHeight, maxGap, stockKnown } = input;
  const warnings: string[] = [...geometry.warnings];

  const panels = elements.filter((e) => e.kind === FormworkKind.PANEL && (e.width ?? 0) > 0);
  const cornersOuter = elements.filter((e) => e.kind === FormworkKind.CORNER_OUTER);
  const cornersInner = elements.filter((e) => e.kind === FormworkKind.CORNER_INNER);
  const locks = elements.filter((e) => e.kind === FormworkKind.LOCK);
  const braces = elements.filter((e) => e.kind === FormworkKind.BRACE);
  const ties = elements.filter((e) => e.kind === FormworkKind.TIE);

  if (!panels.length) warnings.push('В справочнике нет щитов с указанной шириной');

  const tiers = planTiers(foundationHeight, panels.map((p) => p.height ?? 0));
  const tierSum = tiers.reduce((s, h) => s + h, 0);
  if (panels.some((p) => p.height) && tierSum - foundationHeight > HEIGHT_TOLERANCE) {
    warnings.push(`Высота опалубки ${tierSum} мм превышает высоту фундамента на ${tierSum - foundationHeight} мм`);
  }

  const pool: Pool = {
    remaining: new Map(elements.map((e) => [e.analiticId, e.stock])),
    known: stockKnown,
  };

  const usage = new Map<number, { ok: number; short: number }>();
  const bump = (analiticId: number, field: 'ok' | 'short', qty = 1) => {
    const u = usage.get(analiticId) ?? { ok: 0, short: 0 };
    u[field] += qty;
    usage.set(analiticId, u);
  };

  const faceLayouts: FwFaceLayout[] = [];
  const cornerLayouts: FwCornerLayout[] = [];
  const idealUsage = new Map<number, number>();

  // Идеальный набор (без ограничений) считаем один раз на грань и ярус.
  const idealCover = (length: number, tierPanels: FormworkElement[]) => {
    const widths = tierPanels.map((p) => p.width as number);
    const step = widths.reduce((g, w) => gcd(g, w), Math.round(widths[0] ?? 1));
    return coverLengthUnbounded(length, widths, step);
  };

  let totalJoints = 0;

  tiers.forEach((tierHeight, tierIdx) => {
    const tierPanels = panels
      .filter((p) => fitsTier(p, tierHeight))
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    if (!tierPanels.length && panels.length) {
      warnings.push(`Ярус ${tierIdx + 1}: нет щитов высотой ${tierHeight} мм`);
    }

    // Угловые элементы яруса: по одному кандидату на тип угла
    const pickCorner = (candidates: FormworkElement[]): FormworkElement | null => {
      const fitting = candidates.filter((c) => fitsTier(c, tierHeight));
      if (!fitting.length) return null;
      return fitting.find((c) => availableIn(pool, c.analiticId) > 0) ?? fitting[0];
    };

    const cornerInsets = new Map<string, number>();
    for (const corner of geometry.corners) {
      const candidates = corner.type === 'outer' ? cornersOuter : cornersInner;
      const chosen = pickCorner(candidates);
      if (!chosen) {
        cornerLayouts.push({ cornerId: corner.id, tier: tierIdx, analiticId: null, status: 'none' });
        if (candidates.length) {
          warnings.push(`Ярус ${tierIdx + 1}: нет углового элемента (${corner.type === 'outer' ? 'внешний' : 'внутренний'}) высотой ${tierHeight} мм`);
        }
        continue;
      }
      const has = availableIn(pool, chosen.analiticId) > 0;
      takeFromPool(pool, chosen.analiticId, 1);
      bump(chosen.analiticId, has ? 'ok' : 'short');
      idealUsage.set(chosen.analiticId, (idealUsage.get(chosen.analiticId) ?? 0) + 1);
      cornerLayouts.push({
        cornerId: corner.id,
        tier: tierIdx,
        analiticId: chosen.analiticId,
        status: has ? 'ok' : 'shortage',
      });
      cornerInsets.set(corner.id, chosen.width ?? 0);
    }

    // Длинные грани первыми — широкие щиты уходят туда, где они нужнее
    const faces = [...geometry.faces].sort((a, b) => b.length - a.length);
    const bigGaps: number[] = [];

    for (const face of faces) {
      const startInset = cornerInsets.get(face.startCornerId) ?? 0;
      const endInset = cornerInsets.get(face.endCornerId) ?? 0;
      let length = face.length - startInset - endInset;
      if (length < 0) {
        warnings.push(`Грань ${face.length} мм короче полок угловых элементов`);
        length = 0;
      }

      const pieces: FwPiece[] = [];
      if (length > 0 && tierPanels.length) {
        const widths = tierPanels.map((p) => p.width as number);
        const step = widths.reduce((g, w) => gcd(g, w), Math.round(widths[0]));
        const bounds = tierPanels.map((p) => {
          const avail = availableIn(pool, p.analiticId);
          return Number.isFinite(avail) ? Math.floor(avail) : Number.MAX_SAFE_INTEGER;
        });

        const ideal = idealCover(length, tierPanels);
        ideal.counts.forEach((cnt, i) => {
          if (cnt > 0) {
            const id = tierPanels[i].analiticId;
            idealUsage.set(id, (idealUsage.get(id) ?? 0) + cnt);
          }
        });

        const constrained = coverLength(length, widths, bounds, step);
        let offset = 0;
        const pushPieces = (counts: number[], status: FwPiece['status']) => {
          counts.forEach((cnt, i) => {
            for (let c = 0; c < cnt; c++) {
              pieces.push({
                analiticId: tierPanels[i].analiticId,
                width: widths[i],
                offset,
                status,
              });
              offset += widths[i];
            }
          });
        };

        pushPieces(constrained.counts, 'ok');
        constrained.counts.forEach((cnt, i) => {
          if (cnt > 0) {
            takeFromPool(pool, tierPanels[i].analiticId, cnt);
            bump(tierPanels[i].analiticId, 'ok', cnt);
          }
        });

        let rest = length - constrained.covered;
        if (rest > maxGap) {
          // остатков не хватило — дозаполняем идеальным набором и помечаем как нехватку
          const fill = idealCover(rest, tierPanels);
          pushPieces(fill.counts, 'shortage');
          fill.counts.forEach((cnt, i) => {
            if (cnt > 0) bump(tierPanels[i].analiticId, 'short', cnt);
          });
          rest -= fill.covered;
        }
        if (rest > 0.5) {
          pieces.push({ analiticId: null, width: rest, offset, status: 'gap' });
          if (rest > maxGap) {
            bigGaps.push(rest);
          }
        }
      } else if (length > 0) {
        pieces.push({ analiticId: null, width: length, offset: 0, status: 'gap' });
      }

      // упорядочим по смещению (широкие в начале грани)
      pieces.sort((p, q) => p.offset - q.offset);

      faceLayouts.push({ faceId: face.id, tier: tierIdx, length, startInset, pieces });

      const panelPieces = pieces.filter((p) => p.analiticId != null).length;
      totalJoints += Math.max(0, panelPieces - 1);
    }

    // стыки в углах: с угловым элементом — 2 стыка, без — 1
    for (const corner of geometry.corners) {
      totalJoints += cornerInsets.has(corner.id) ? 2 : 1;
    }

    if (bigGaps.length) {
      const maxGapFound = Math.round(Math.max(...bigGaps));
      warnings.push(
        `Ярус ${tierIdx + 1}: на ${bigGaps.length} гранях зазор больше ${maxGap} мм (до ${maxGapFound} мм) — нужны доборные вставки`,
      );
    }
  });

  const panelCount = faceLayouts.reduce(
    (s, f) => s + f.pieces.filter((p) => p.analiticId != null).length,
    0,
  );
  const outerLength = contourLength(geometry, 'outer');
  const holeLength = contourLength(geometry, 'hole');

  // Комплектующие по нормам
  const applyConsumable = (list: FormworkElement[], qtyFor: (el: FormworkElement) => number) => {
    const el = list.find((e) => (e.norm ?? 0) > 0) ?? list[0];
    if (!el) return;
    const need = Math.ceil(qtyFor(el));
    if (need <= 0) return;
    const avail = availableIn(pool, el.analiticId);
    const ok = Math.min(need, Number.isFinite(avail) ? avail : need);
    takeFromPool(pool, el.analiticId, ok);
    if (ok > 0) bump(el.analiticId, 'ok', ok);
    if (need - ok > 0) bump(el.analiticId, 'short', need - ok);
    idealUsage.set(el.analiticId, (idealUsage.get(el.analiticId) ?? 0) + need);
  };

  applyConsumable(locks, (el) => totalJoints * (el.norm ?? 0));
  applyConsumable(braces, (el) => (outerLength / 1000) * tiers.length * (el.norm ?? 0));
  applyConsumable(ties, (el) => panelCount * (el.norm ?? 0));

  const byId = new Map(elements.map((e) => [e.analiticId, e]));
  const spec: FwSpecRow[] = [];
  const ids = new Set<number>([...usage.keys(), ...idealUsage.keys()]);
  for (const id of ids) {
    const el = byId.get(id);
    if (!el) continue;
    const u = usage.get(id) ?? { ok: 0, short: 0 };
    spec.push({
      analiticId: id,
      name: el.name,
      kind: el.kind,
      size: sizeLabel(el),
      need: u.ok + u.short,
      idealNeed: idealUsage.get(id) ?? 0,
      stock: el.stock,
      issue: u.ok,
      shortage: u.short,
    });
  }
  const kindOrder = [
    FormworkKind.PANEL,
    FormworkKind.CORNER_OUTER,
    FormworkKind.CORNER_INNER,
    FormworkKind.LOCK,
    FormworkKind.BRACE,
    FormworkKind.TIE,
  ];
  spec.sort((a, b) => {
    const k = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
    if (k !== 0) return k;
    const wa = byId.get(a.analiticId)?.width ?? 0;
    const wb = byId.get(b.analiticId)?.width ?? 0;
    return wb - wa;
  });

  return {
    tiers,
    faceLayouts,
    cornerLayouts,
    spec,
    warnings: Array.from(new Set(warnings)),
    totals: {
      outerLength,
      holeLength,
      cornersOuter: geometry.corners.filter((c) => c.type === 'outer').length,
      cornersInner: geometry.corners.filter((c) => c.type === 'inner').length,
      joints: totalJoints,
      panels: panelCount,
      tiersCount: tiers.length,
    },
    stockKnown,
    solvedAt: Date.now(),
  };
};

export const describeCorner = (corner: FwCorner): string =>
  corner.type === 'outer' ? 'Ташқи бурчак' : 'Ички бурчак';

export const faceById = (geometry: FwGeometry, id: string): FwFace | undefined =>
  geometry.faces.find((f) => f.id === id);
