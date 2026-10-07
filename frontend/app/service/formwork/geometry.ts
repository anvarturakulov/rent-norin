import {
  FwBounds,
  FwContour,
  FwCorner,
  FwFace,
  FwGeometry,
  FwPoint,
  FwSegment,
} from './formwork.types';

const EPS = 0.5;

const keyOf = (p: FwPoint) => `${Math.round(p.x)},${Math.round(p.y)}`;

export const segmentLength = (s: FwSegment): number =>
  Math.abs(s.b.x - s.a.x) + Math.abs(s.b.y - s.a.y);

export const isHorizontal = (s: FwSegment): boolean =>
  Math.abs(s.a.y - s.b.y) < EPS;

export const isVertical = (s: FwSegment): boolean =>
  Math.abs(s.a.x - s.b.x) < EPS;

export const isOrthogonal = (s: FwSegment): boolean =>
  (isHorizontal(s) || isVertical(s)) && segmentLength(s) > EPS;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Каждая осевая линия превращается в прямоугольник шириной stripWidth.
 * В узлах (вершины, где сходятся ≥ 2 отрезка) отрезок удлиняется на половину
 * ширины ленты, чтобы угловые области были заполнены бетоном.
 */
const buildRects = (segments: FwSegment[], stripWidth: number): Rect[] => {
  const half = stripWidth / 2;
  const degree = new Map<string, number>();
  for (const s of segments) {
    degree.set(keyOf(s.a), (degree.get(keyOf(s.a)) || 0) + 1);
    degree.set(keyOf(s.b), (degree.get(keyOf(s.b)) || 0) + 1);
  }

  return segments.map((s) => {
    const extA = (degree.get(keyOf(s.a)) || 0) >= 2 ? half : 0;
    const extB = (degree.get(keyOf(s.b)) || 0) >= 2 ? half : 0;
    if (isHorizontal(s)) {
      const left = Math.min(s.a.x, s.b.x);
      const right = Math.max(s.a.x, s.b.x);
      const extLeft = s.a.x < s.b.x ? extA : extB;
      const extRight = s.a.x < s.b.x ? extB : extA;
      return {
        x0: left - extLeft,
        x1: right + extRight,
        y0: s.a.y - half,
        y1: s.a.y + half,
      };
    }
    const top = Math.min(s.a.y, s.b.y);
    const bottom = Math.max(s.a.y, s.b.y);
    const extTop = s.a.y < s.b.y ? extA : extB;
    const extBottom = s.a.y < s.b.y ? extB : extA;
    return {
      x0: s.a.x - half,
      x1: s.a.x + half,
      y0: top - extTop,
      y1: bottom + extBottom,
    };
  });
};

const uniqSorted = (values: number[]): number[] => {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (!out.length || Math.abs(out[out.length - 1] - v) > EPS) out.push(v);
  }
  return out;
};

interface DirectedEdge {
  from: FwPoint;
  to: FwPoint;
  used: boolean;
}

const dirOf = (a: FwPoint, b: FwPoint): FwPoint => ({
  x: Math.sign(b.x - a.x),
  y: Math.sign(b.y - a.y),
});

const cross = (a: FwPoint, b: FwPoint) => a.x * b.y - a.y * b.x;

/**
 * Обходим границу заполненной области. Рёбра ячеек ориентированы так, что
 * бетон всегда слева (в алгебраическом смысле формулы шнурков).
 */
const traceLoops = (
  xs: number[],
  ys: number[],
  filled: boolean[][],
): FwPoint[][] => {
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  const isFilled = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < nx && j < ny && filled[i][j];

  const edges: DirectedEdge[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!filled[i][j]) continue;
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const y0 = ys[j];
      const y1 = ys[j + 1];
      if (!isFilled(i, j - 1)) edges.push({ from: { x: x0, y: y0 }, to: { x: x1, y: y0 }, used: false });
      if (!isFilled(i + 1, j)) edges.push({ from: { x: x1, y: y0 }, to: { x: x1, y: y1 }, used: false });
      if (!isFilled(i, j + 1)) edges.push({ from: { x: x1, y: y1 }, to: { x: x0, y: y1 }, used: false });
      if (!isFilled(i - 1, j)) edges.push({ from: { x: x0, y: y1 }, to: { x: x0, y: y0 }, used: false });
    }
  }

  const byStart = new Map<string, DirectedEdge[]>();
  for (const e of edges) {
    const k = keyOf(e.from);
    const list = byStart.get(k);
    if (list) list.push(e);
    else byStart.set(k, [e]);
  }

  const loops: FwPoint[][] = [];
  for (const start of edges) {
    if (start.used) continue;
    const loop: FwPoint[] = [start.from];
    let current = start;
    current.used = true;
    let guard = edges.length + 5;
    while (guard-- > 0) {
      const candidates = (byStart.get(keyOf(current.to)) || []).filter((e) => !e.used);
      if (!candidates.length) break;
      const d = dirOf(current.from, current.to);
      // при касании двух контуров в точке выбираем поворот направо,
      // чтобы контуры не склеивались в один
      candidates.sort((e1, e2) => {
        const score = (e: DirectedEdge) => {
          const nd = dirOf(e.from, e.to);
          const c = cross(d, nd);
          if (c < 0) return 0;
          if (c === 0) return 1;
          return 2;
        };
        return score(e1) - score(e2);
      });
      const next = candidates[0];
      next.used = true;
      if (keyOf(next.to) === keyOf(start.from)) {
        loop.push(next.from);
        break;
      }
      loop.push(next.from);
      current = next;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
};

const mergeCollinear = (points: FwPoint[]): FwPoint[] => {
  const n = points.length;
  if (n < 3) return points;
  const out: FwPoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const d1 = dirOf(prev, cur);
    const d2 = dirOf(cur, next);
    if (d1.x === d2.x && d1.y === d2.y) continue;
    out.push(cur);
  }
  return out;
};

const signedArea = (points: FwPoint[]): number => {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
};

const pointInPolygon = (p: FwPoint, poly: FwPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const emptyGeometry = (): FwGeometry => ({
  contours: [],
  faces: [],
  corners: [],
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  warnings: [],
});

export const computeBounds = (segments: FwSegment[]): FwBounds => {
  if (!segments.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of segments) {
    for (const p of [s.a, s.b]) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
};

/**
 * Строит контуры бетона, грани и углы по осевым линиям.
 * Работает для произвольной сетки: внешняя лента, перемычки, Т- и крестовые узлы.
 */
export const buildGeometry = (
  segmentsInput: FwSegment[],
  stripWidth: number,
): FwGeometry => {
  const warnings: string[] = [];
  const segments = segmentsInput.filter((s) => segmentLength(s) > EPS);
  const skewed = segments.filter((s) => !isOrthogonal(s));
  if (skewed.length) {
    warnings.push(`Пропущено ${skewed.length} неортогональных отрезков`);
  }
  const ortho = segments.filter(isOrthogonal);
  if (!ortho.length || stripWidth <= 0) {
    return { ...emptyGeometry(), warnings };
  }

  const rects = buildRects(ortho, stripWidth);
  const xs = uniqSorted(rects.flatMap((r) => [r.x0, r.x1]));
  const ys = uniqSorted(rects.flatMap((r) => [r.y0, r.y1]));

  const filled: boolean[][] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const col: boolean[] = [];
    const cx = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j < ys.length - 1; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2;
      col.push(rects.some((r) => cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1));
    }
    filled.push(col);
  }

  const loops = traceLoops(xs, ys, filled).map(mergeCollinear).filter((l) => l.length >= 4);

  const rawContours = loops.map((points) => ({ points, area: signedArea(points) }));
  // внешний контур — тот, который не лежит внутри другого контура
  const contours: FwContour[] = rawContours.map((c, idx) => {
    const probe = c.points[0];
    const insideOther = rawContours.some(
      (o, j) => j !== idx && Math.abs(o.area) > Math.abs(c.area) && pointInPolygon(probe, o.points),
    );
    return {
      kind: insideOther ? 'hole' : 'outer',
      points: c.points,
      areaSign: c.area >= 0 ? 1 : -1,
    };
  });

  const outerCount = contours.filter((c) => c.kind === 'outer').length;
  if (outerCount > 1) {
    warnings.push(`Чертёж состоит из ${outerCount} несвязанных частей`);
  }

  const faces: FwFace[] = [];
  const corners: FwCorner[] = [];

  contours.forEach((contour, ci) => {
    const pts = contour.points;
    const n = pts.length;
    // интерьер многоугольника слева при areaSign > 0
    const interiorLeft = contour.areaSign > 0;
    // для внешнего контура бетон = интерьер, для дырки бетон = снаружи
    const concreteLeft = contour.kind === 'outer' ? interiorLeft : !interiorLeft;

    for (let i = 0; i < n; i++) {
      const from = pts[i];
      const to = pts[(i + 1) % n];
      const d = dirOf(from, to);
      const left = { x: -d.y, y: d.x };
      const outward = concreteLeft ? { x: -left.x, y: -left.y } : left;
      faces.push({
        id: `c${ci}f${i}`,
        contourIndex: ci,
        from,
        to,
        length: Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
        dir: d,
        outward,
        startCornerId: `c${ci}v${i}`,
        endCornerId: `c${ci}v${(i + 1) % n}`,
      });
    }

    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const cur = pts[i];
      const next = pts[(i + 1) % n];
      const c = cross(dirOf(prev, cur), dirOf(cur, next));
      // поворот в сторону интерьера = выпуклая вершина многоугольника
      const convex = (c > 0) === interiorLeft;
      const type: FwCorner['type'] =
        contour.kind === 'outer' ? (convex ? 'outer' : 'inner') : convex ? 'inner' : 'outer';
      corners.push({
        id: `c${ci}v${i}`,
        contourIndex: ci,
        point: cur,
        type,
        inFaceId: `c${ci}f${(i - 1 + n) % n}`,
        outFaceId: `c${ci}f${i}`,
      });
    }
  });

  const allPts = contours.flatMap((c) => c.points);
  const bounds: FwBounds = allPts.length
    ? {
        minX: Math.min(...allPts.map((p) => p.x)),
        minY: Math.min(...allPts.map((p) => p.y)),
        maxX: Math.max(...allPts.map((p) => p.x)),
        maxY: Math.max(...allPts.map((p) => p.y)),
      }
    : computeBounds(ortho);

  return { contours, faces, corners, bounds, warnings };
};

export const contourLength = (geometry: FwGeometry, kind: FwContour['kind']): number =>
  geometry.faces
    .filter((f) => geometry.contours[f.contourIndex]?.kind === kind)
    .reduce((s, f) => s + f.length, 0);
