'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cn from 'classnames';
import { FwGeometry, FwPoint, FwSegment } from '@/app/service/formwork/formwork.types';
import { computeBounds, isHorizontal, segmentLength } from '@/app/service/formwork/geometry';
import styles from './formworkPlannerModal.module.css';

const SNAP = 50;
const SNAP_PX = 12;

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Mode = 'draw' | 'select';

interface FoundationSketchEditorProps {
  segments: FwSegment[];
  onChange: (segments: FwSegment[]) => void;
  geometry: FwGeometry | null;
  stripWidth: number;
  readOnly?: boolean;
}

const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

const samePoint = (p: FwPoint, q: FwPoint) => Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5;

export const makeRectangle = (a: number, b: number): FwSegment[] => [
  { id: newId(), a: { x: 0, y: 0 }, b: { x: a, y: 0 } },
  { id: newId(), a: { x: a, y: 0 }, b: { x: a, y: b } },
  { id: newId(), a: { x: a, y: b }, b: { x: 0, y: b } },
  { id: newId(), a: { x: 0, y: b }, b: { x: 0, y: 0 } },
];

export const makeRectangleWithPartition = (a: number, b: number): FwSegment[] => [
  ...makeRectangle(a, b),
  { id: newId(), a: { x: roundTo(a / 2, SNAP), y: 0 }, b: { x: roundTo(a / 2, SNAP), y: b } },
];

export const makeLShape = (a: number, b: number): FwSegment[] => {
  const ax = roundTo(a / 2, SNAP);
  const by = roundTo(b / 2, SNAP);
  return [
    { id: newId(), a: { x: 0, y: 0 }, b: { x: a, y: 0 } },
    { id: newId(), a: { x: a, y: 0 }, b: { x: a, y: by } },
    { id: newId(), a: { x: a, y: by }, b: { x: ax, y: by } },
    { id: newId(), a: { x: ax, y: by }, b: { x: ax, y: b } },
    { id: newId(), a: { x: ax, y: b }, b: { x: 0, y: b } },
    { id: newId(), a: { x: 0, y: b }, b: { x: 0, y: 0 } },
  ];
};

/** Изменение длины отрезка сдвигом всех точек «за» его концом (растяжение чертежа). */
export const stretchSegment = (
  segments: FwSegment[],
  segId: string,
  newLength: number,
): FwSegment[] => {
  const seg = segments.find((s) => s.id === segId);
  if (!seg || newLength <= 0) return segments;
  const horizontal = isHorizontal(seg);
  const axis: 'x' | 'y' = horizontal ? 'x' : 'y';
  const sign = Math.sign(seg.b[axis] - seg.a[axis]) || 1;
  const delta = newLength - segmentLength(seg);
  if (Math.abs(delta) < 0.5) return segments;
  const threshold = seg.b[axis];
  const shift = (p: FwPoint): FwPoint =>
    sign * (p[axis] - threshold) >= -0.5 ? { ...p, [axis]: p[axis] + sign * delta } : p;
  return segments.map((s) => ({ ...s, a: shift(s.a), b: shift(s.b) }));
};

const fitViewBox = (segments: FwSegment[], aspect: number): ViewBox => {
  if (!segments.length) {
    const w = 12000;
    return { x: -1000, y: -1000, w, h: w / aspect };
  }
  const b = computeBounds(segments);
  const pad = Math.max(1000, (b.maxX - b.minX) * 0.15, (b.maxY - b.minY) * 0.15);
  let w = b.maxX - b.minX + pad * 2;
  let h = b.maxY - b.minY + pad * 2;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
};

const gridStep = (vb: ViewBox): number => {
  const raw = vb.w / 12;
  const steps = [100, 250, 500, 1000, 2000, 5000, 10000];
  return steps.find((s) => s >= raw) ?? 10000;
};

const contourPath = (geometry: FwGeometry | null): string => {
  if (!geometry) return '';
  return geometry.contours
    .map((c) => `M ${c.points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`)
    .join(' ');
};

export default function FoundationSketchEditor({
  segments,
  onChange,
  geometry,
  stripWidth,
  readOnly,
}: FoundationSketchEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(() => fitViewBox(segments, 1.5));
  const [mode, setMode] = useState<Mode>(segments.length ? 'select' : 'draw');
  const [drawStart, setDrawStart] = useState<FwPoint | null>(null);
  const [hover, setHover] = useState<FwPoint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lengthDraft, setLengthDraft] = useState('');
  const [presetA, setPresetA] = useState('6000');
  const [presetB, setPresetB] = useState('4000');
  const panRef = useRef<{ startPx: { x: number; y: number }; startVb: ViewBox } | null>(null);
  const historyRef = useRef<FwSegment[][]>([]);
  const fittedOnce = useRef(false);

  const aspect = useMemo(() => {
    const el = svgRef.current;
    if (!el) return 1.5;
    const r = el.getBoundingClientRect();
    return r.height > 0 ? r.width / r.height : 1.5;
  }, []);

  useEffect(() => {
    if (fittedOnce.current) return;
    if (segments.length) {
      setViewBox(fitViewBox(segments, aspect));
      fittedOnce.current = true;
    }
  }, [segments, aspect]);

  const commit = useCallback(
    (next: FwSegment[]) => {
      historyRef.current.push(segments);
      if (historyRef.current.length > 50) historyRef.current.shift();
      onChange(next);
    },
    [segments, onChange],
  );

  const undo = () => {
    const prev = historyRef.current.pop();
    if (prev) onChange(prev);
  };

  const pxToMm = useCallback(
    (clientX: number, clientY: number): FwPoint => {
      const el = svgRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: viewBox.x + ((clientX - r.left) / r.width) * viewBox.w,
        y: viewBox.y + ((clientY - r.top) / r.height) * viewBox.h,
      };
    },
    [viewBox],
  );

  const mmPerPx = useMemo(() => {
    const el = svgRef.current;
    if (!el) return viewBox.w / 800;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? viewBox.w / r.width : viewBox.w / 800;
  }, [viewBox]);

  const vertices = useMemo(() => {
    const map = new Map<string, FwPoint>();
    for (const s of segments) {
      map.set(`${s.a.x},${s.a.y}`, s.a);
      map.set(`${s.b.x},${s.b.y}`, s.b);
    }
    return Array.from(map.values());
  }, [segments]);

  /** Привязка: вершина → точка на отрезке → сетка. */
  const snap = useCallback(
    (p: FwPoint): FwPoint => {
      const tol = SNAP_PX * mmPerPx;
      let best: FwPoint | null = null;
      let bestD = tol;
      for (const v of vertices) {
        const d = Math.hypot(v.x - p.x, v.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      if (best) return best;

      for (const s of segments) {
        if (isHorizontal(s)) {
          const minX = Math.min(s.a.x, s.b.x);
          const maxX = Math.max(s.a.x, s.b.x);
          if (Math.abs(p.y - s.a.y) < tol && p.x >= minX && p.x <= maxX) {
            return { x: roundTo(p.x, SNAP), y: s.a.y };
          }
        } else {
          const minY = Math.min(s.a.y, s.b.y);
          const maxY = Math.max(s.a.y, s.b.y);
          if (Math.abs(p.x - s.a.x) < tol && p.y >= minY && p.y <= maxY) {
            return { x: s.a.x, y: roundTo(p.y, SNAP) };
          }
        }
      }
      return { x: roundTo(p.x, SNAP), y: roundTo(p.y, SNAP) };
    },
    [vertices, segments, mmPerPx],
  );

  const orthogonalize = (from: FwPoint, to: FwPoint): FwPoint =>
    Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
      ? { x: to.x, y: from.y }
      : { x: from.x, y: to.y };

  const previewEnd = useMemo(() => {
    if (!drawStart || !hover) return null;
    return snap(orthogonalize(drawStart, hover));
  }, [drawStart, hover, snap]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && (e.shiftKey || mode === 'select'))) {
      panRef.current = { startPx: { x: e.clientX, y: e.clientY }, startVb: viewBox };
      if (e.button === 1) e.preventDefault();
      if (mode === 'select' && e.button === 0 && e.target === svgRef.current) {
        setSelectedId(null);
      }
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (panRef.current) {
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - panRef.current.startPx.x) / r.width) * panRef.current.startVb.w;
      const dy = ((e.clientY - panRef.current.startPx.y) / r.height) * panRef.current.startVb.h;
      setViewBox({ ...panRef.current.startVb, x: panRef.current.startVb.x - dx, y: panRef.current.startVb.y - dy });
      return;
    }
    setHover(pxToMm(e.clientX, e.clientY));
  };

  const handleMouseUp = () => {
    panRef.current = null;
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || mode !== 'draw' || e.shiftKey) return;
    const raw = pxToMm(e.clientX, e.clientY);
    if (!drawStart) {
      setDrawStart(snap(raw));
      return;
    }
    const end = snap(orthogonalize(drawStart, raw));
    if (samePoint(end, drawStart)) return;
    const seg: FwSegment = { id: newId(), a: drawStart, b: end };
    commit([...segments, seg]);
    setDrawStart(end);
  };

  const finishDrawing = () => setDrawStart(null);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const p = pxToMm(e.clientX, e.clientY);
    setViewBox((vb) => {
      const w = Math.min(200000, Math.max(1000, vb.w * factor));
      const h = w * (vb.h / vb.w);
      return {
        x: p.x - (p.x - vb.x) * (w / vb.w),
        y: p.y - (p.y - vb.y) * (h / vb.h),
        w,
        h,
      };
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishDrawing();
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !readOnly) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        commit(segments.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, segments, commit, readOnly]);

  const selected = segments.find((s) => s.id === selectedId) ?? null;
  useEffect(() => {
    setLengthDraft(selected ? String(Math.round(segmentLength(selected))) : '');
  }, [selectedId, selected]);

  const applyLength = () => {
    if (!selected || readOnly) return;
    const v = Number(lengthDraft.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    commit(stretchSegment(segments, selected.id, roundTo(v, 1)));
  };

  const applyPreset = (kind: 'rect' | 'l' | 'part') => {
    if (readOnly) return;
    const a = Number(presetA) || 0;
    const b = Number(presetB) || 0;
    if (a <= 0 || b <= 0) return;
    const next =
      kind === 'rect' ? makeRectangle(a, b) : kind === 'l' ? makeLShape(a, b) : makeRectangleWithPartition(a, b);
    commit(next);
    setSelectedId(null);
    setDrawStart(null);
    setViewBox(fitViewBox(next, aspect));
    setMode('select');
  };

  const clearAll = () => {
    if (readOnly) return;
    commit([]);
    setSelectedId(null);
    setDrawStart(null);
  };

  const fit = () => setViewBox(fitViewBox(segments, aspect));

  const step = gridStep(viewBox);
  const gridLines = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const x0 = Math.floor(viewBox.x / step) * step;
    const y0 = Math.floor(viewBox.y / step) * step;
    for (let x = x0; x <= viewBox.x + viewBox.w; x += step) xs.push(x);
    for (let y = y0; y <= viewBox.y + viewBox.h; y += step) ys.push(y);
    return { xs, ys };
  }, [viewBox, step]);

  const strokePx = (px: number) => px * mmPerPx;
  const fontMm = strokePx(12);

  const dimensionLabel = (s: FwSegment, selectedSeg: boolean) => {
    const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
    const horizontal = isHorizontal(s);
    const off = strokePx(14);
    const x = horizontal ? mid.x : mid.x + off;
    const y = horizontal ? mid.y - off : mid.y;
    return (
      <text
        key={`dim-${s.id}`}
        x={x}
        y={y}
        fontSize={fontMm}
        textAnchor={horizontal ? 'middle' : 'start'}
        dominantBaseline="middle"
        className={cn(styles.dimLabel, { [styles.dimLabelSelected]: selectedSeg })}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(s.id);
          setMode('select');
        }}
      >
        {Math.round(segmentLength(s))}
      </text>
    );
  };

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            type="button"
            className={cn(styles.toolBtn, { [styles.toolBtnActive]: mode === 'draw' })}
            onClick={() => setMode('draw')}
            disabled={readOnly}
          >
            ✎ Чизиш
          </button>
          <button
            type="button"
            className={cn(styles.toolBtn, { [styles.toolBtnActive]: mode === 'select' })}
            onClick={() => {
              setMode('select');
              finishDrawing();
            }}
          >
            ⬚ Танлаш
          </button>
          <button type="button" className={styles.toolBtn} onClick={undo} disabled={readOnly || !historyRef.current.length}>
            ↶ Бекор
          </button>
          <button type="button" className={styles.toolBtn} onClick={fit}>
            ⤢ Сиғдириш
          </button>
          <button type="button" className={styles.toolBtn} onClick={clearAll} disabled={readOnly || !segments.length}>
            ✕ Тозалаш
          </button>
        </div>
        <div className={styles.toolGroup}>
          <span className={styles.toolLabel}>A</span>
          <input className={styles.smallInput} value={presetA} onChange={(e) => setPresetA(e.target.value)} disabled={readOnly} />
          <span className={styles.toolLabel}>B</span>
          <input className={styles.smallInput} value={presetB} onChange={(e) => setPresetB(e.target.value)} disabled={readOnly} />
          <button type="button" className={styles.toolBtn} onClick={() => applyPreset('rect')} disabled={readOnly}>
            ▭ Тўртбурчак
          </button>
          <button type="button" className={styles.toolBtn} onClick={() => applyPreset('part')} disabled={readOnly}>
            ▯▯ Тўсиқли
          </button>
          <button type="button" className={styles.toolBtn} onClick={() => applyPreset('l')} disabled={readOnly}>
            ┗ Г-шакл
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        className={cn(styles.canvas, { [styles.canvasDraw]: mode === 'draw' && !readOnly })}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setHover(null);
        }}
        onClick={handleClick}
        onDoubleClick={finishDrawing}
        onContextMenu={(e) => {
          e.preventDefault();
          finishDrawing();
        }}
        onWheel={handleWheel}
      >
        <g className={styles.grid}>
          {gridLines.xs.map((x) => (
            <line key={`gx${x}`} x1={x} y1={viewBox.y} x2={x} y2={viewBox.y + viewBox.h} strokeWidth={strokePx(x === 0 ? 1.5 : 0.6)} />
          ))}
          {gridLines.ys.map((y) => (
            <line key={`gy${y}`} x1={viewBox.x} y1={y} x2={viewBox.x + viewBox.w} y2={y} strokeWidth={strokePx(y === 0 ? 1.5 : 0.6)} />
          ))}
        </g>

        {geometry && geometry.contours.length > 0 && (
          <path d={contourPath(geometry)} fillRule="evenodd" className={styles.concrete} strokeWidth={strokePx(1)} />
        )}

        {segments.map((s) => (
          <g key={s.id}>
            <line
              x1={s.a.x}
              y1={s.a.y}
              x2={s.b.x}
              y2={s.b.y}
              strokeWidth={strokePx(14)}
              className={styles.segmentHit}
              onClick={(e) => {
                if (mode !== 'select') return;
                e.stopPropagation();
                setSelectedId(s.id);
              }}
            />
            <line
              x1={s.a.x}
              y1={s.a.y}
              x2={s.b.x}
              y2={s.b.y}
              strokeWidth={strokePx(s.id === selectedId ? 3 : 2)}
              className={cn(styles.axis, { [styles.axisSelected]: s.id === selectedId })}
            />
          </g>
        ))}

        {segments.map((s) => dimensionLabel(s, s.id === selectedId))}

        {vertices.map((v) => (
          <circle key={`v${v.x},${v.y}`} cx={v.x} cy={v.y} r={strokePx(3.5)} className={styles.vertex} />
        ))}

        {drawStart && previewEnd && (
          <>
            <line
              x1={drawStart.x}
              y1={drawStart.y}
              x2={previewEnd.x}
              y2={previewEnd.y}
              strokeWidth={strokePx(2)}
              className={styles.previewLine}
            />
            <text
              x={(drawStart.x + previewEnd.x) / 2}
              y={(drawStart.y + previewEnd.y) / 2 - strokePx(14)}
              fontSize={fontMm}
              textAnchor="middle"
              className={styles.previewLabel}
            >
              {Math.round(Math.abs(previewEnd.x - drawStart.x) + Math.abs(previewEnd.y - drawStart.y))}
            </text>
          </>
        )}
        {drawStart && <circle cx={drawStart.x} cy={drawStart.y} r={strokePx(5)} className={styles.drawStart} />}
        {mode === 'draw' && !drawStart && hover && (
          <circle cx={snap(hover).x} cy={snap(hover).y} r={strokePx(4)} className={styles.cursorDot} />
        )}
      </svg>

      <div className={styles.editorFooter}>
        <div className={styles.hint}>
          {mode === 'draw'
            ? drawStart
              ? 'Иккинчи нуқтани босинг. Esc / ўнг тугма — тугатиш.'
              : 'Бошланғич нуқтани босинг. Ғилдирак — масштаб, Shift+сичқонча — суриш.'
            : 'Отрезкани ёки ўлчамни босиб танланг. Delete — ўчириш. Сичқонча — суриш.'}
        </div>
        {selected && (
          <div className={styles.lengthEditor}>
            <span className={styles.toolLabel}>Узунлик, мм</span>
            <input
              className={styles.smallInput}
              value={lengthDraft}
              onChange={(e) => setLengthDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLength();
              }}
              disabled={readOnly}
            />
            <button type="button" className={styles.toolBtn} onClick={applyLength} disabled={readOnly}>
              Қўллаш
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => {
                commit(segments.filter((s) => s.id !== selected.id));
                setSelectedId(null);
              }}
              disabled={readOnly}
            >
              Ўчириш
            </button>
          </div>
        )}
        <div className={styles.hint}>
          Лента: {stripWidth} мм · Отрезклар: {segments.length}
        </div>
      </div>
    </div>
  );
}
