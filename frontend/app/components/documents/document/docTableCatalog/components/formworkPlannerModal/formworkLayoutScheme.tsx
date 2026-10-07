'use client';

import React, { useMemo } from 'react';
import { FormworkKind } from '@/app/interfaces/reference.interface';
import {
  FormworkElement,
  FormworkSolveResult,
  FwGeometry,
  FwPoint,
} from '@/app/service/formwork/formwork.types';

const PALETTE = [
  '#4f86c6',
  '#5fb26a',
  '#e0a03a',
  '#9b6bd1',
  '#3fb8b0',
  '#d1745f',
  '#7b8fa6',
  '#b5a642',
  '#c85c9b',
  '#5c8ac8',
];

export const colorForElement = (analiticId: number, ordered: number[]): string => {
  const idx = ordered.indexOf(analiticId);
  return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
};

interface FormworkLayoutSchemeProps {
  geometry: FwGeometry;
  result: FormworkSolveResult;
  tier: number;
  stripWidth: number;
  elements: FormworkElement[];
  /** высота SVG в px (ширина 100%) */
  height?: number;
  showLegend?: boolean;
  showDimensions?: boolean;
  className?: string;
}

const rectFrom = (p0: FwPoint, along: FwPoint, len: number, normal: FwPoint, thick: number) => {
  const p1 = { x: p0.x + along.x * len + normal.x * thick, y: p0.y + along.y * len + normal.y * thick };
  return {
    x: Math.min(p0.x, p1.x),
    y: Math.min(p0.y, p1.y),
    w: Math.abs(p1.x - p0.x),
    h: Math.abs(p1.y - p0.y),
  };
};

export default function FormworkLayoutScheme({
  geometry,
  result,
  tier,
  stripWidth,
  elements,
  height = 420,
  showLegend = true,
  showDimensions = true,
  className,
}: FormworkLayoutSchemeProps) {
  const thick = Math.min(160, Math.max(60, stripWidth * 0.3));
  const gap = Math.max(15, thick * 0.25);

  const orderedPanelIds = useMemo(
    () =>
      elements
        .filter(
          (e) =>
            e.kind === FormworkKind.PANEL ||
            e.kind === FormworkKind.CORNER_OUTER ||
            e.kind === FormworkKind.CORNER_INNER,
        )
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
        .map((e) => e.analiticId),
    [elements],
  );
  const elementById = useMemo(() => new Map(elements.map((e) => [e.analiticId, e])), [elements]);
  const faceById = useMemo(() => new Map(geometry.faces.map((f) => [f.id, f])), [geometry]);
  const cornerById = useMemo(() => new Map(geometry.corners.map((c) => [c.id, c])), [geometry]);

  const pad = thick + gap + (showDimensions ? thick * 2.2 : thick * 0.5);
  const b = geometry.bounds;
  const vbW = Math.max(1, b.maxX - b.minX + pad * 2);
  const vbH = Math.max(1, b.maxY - b.minY + pad * 2);
  const viewBox = `${b.minX - pad} ${b.minY - pad} ${vbW} ${vbH}`;
  const fontMm = Math.max(40, Math.min(vbW, vbH) / 45);
  const strokeMm = Math.max(4, vbW / 900);

  const faceLayouts = result.faceLayouts.filter((f) => f.tier === tier);
  const cornerLayouts = result.cornerLayouts.filter((c) => c.tier === tier);

  const usedIds = new Set<number>();
  faceLayouts.forEach((f) => f.pieces.forEach((p) => p.analiticId != null && usedIds.add(p.analiticId)));
  cornerLayouts.forEach((c) => c.analiticId != null && usedIds.add(c.analiticId));
  const hasShortage =
    faceLayouts.some((f) => f.pieces.some((p) => p.status === 'shortage')) ||
    cornerLayouts.some((c) => c.status === 'shortage');
  const hasGap = faceLayouts.some((f) => f.pieces.some((p) => p.status === 'gap'));

  const contourPath = geometry.contours
    .map((c) => `M ${c.points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`)
    .join(' ');

  const patternId = `fw-hatch-${tier}`;
  const gapPatternId = `fw-gap-${tier}`;

  return (
    <div className={className}>
      <svg viewBox={viewBox} style={{ width: '100%', height, display: 'block', background: '#fff' }}>
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width={thick / 2} height={thick / 2} patternTransform="rotate(45)">
            <rect width={thick / 2} height={thick / 2} fill="#fde2e2" />
            <line x1="0" y1="0" x2="0" y2={thick / 2} stroke="#d32f2f" strokeWidth={thick / 8} />
          </pattern>
          <pattern id={gapPatternId} patternUnits="userSpaceOnUse" width={thick / 3} height={thick / 3} patternTransform="rotate(-45)">
            <rect width={thick / 3} height={thick / 3} fill="#f3f4f6" />
            <line x1="0" y1="0" x2="0" y2={thick / 3} stroke="#9ca3af" strokeWidth={thick / 14} />
          </pattern>
        </defs>

        <path d={contourPath} fillRule="evenodd" fill="#e5e7eb" stroke="#6b7280" strokeWidth={strokeMm} />

        {faceLayouts.map((fl) => {
          const face = faceById.get(fl.faceId);
          if (!face) return null;
          const start = {
            x: face.from.x + face.dir.x * fl.startInset + face.outward.x * gap,
            y: face.from.y + face.dir.y * fl.startInset + face.outward.y * gap,
          };
          return (
            <g key={`${fl.faceId}-${fl.tier}`}>
              {fl.pieces.map((piece, idx) => {
                const p0 = {
                  x: start.x + face.dir.x * piece.offset,
                  y: start.y + face.dir.y * piece.offset,
                };
                const r = rectFrom(p0, face.dir, piece.width, face.outward, thick);
                const fill =
                  piece.status === 'shortage'
                    ? `url(#${patternId})`
                    : piece.status === 'gap'
                      ? `url(#${gapPatternId})`
                      : colorForElement(piece.analiticId as number, orderedPanelIds);
                const stroke = piece.status === 'shortage' ? '#d32f2f' : '#1f2937';
                const horizontal = face.dir.x !== 0;
                const showText = piece.width >= fontMm * 2.2;
                return (
                  <g key={idx}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} stroke={stroke} strokeWidth={strokeMm} />
                    {showText && (
                      <text
                        x={r.x + r.w / 2}
                        y={r.y + r.h / 2}
                        fontSize={fontMm * 0.85}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={piece.status === 'ok' ? '#fff' : '#374151'}
                        fontWeight={600}
                        transform={horizontal ? undefined : `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})`}
                        style={{ paintOrder: 'stroke', stroke: piece.status === 'ok' ? 'rgba(0,0,0,0.35)' : 'none', strokeWidth: fontMm * 0.12 }}
                      >
                        {Math.round(piece.width)}
                      </text>
                    )}
                  </g>
                );
              })}
              {showDimensions && (
                <text
                  x={(face.from.x + face.to.x) / 2 + face.outward.x * (gap + thick + fontMm * 1.1)}
                  y={(face.from.y + face.to.y) / 2 + face.outward.y * (gap + thick + fontMm * 1.1)}
                  fontSize={fontMm}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#111827"
                  transform={
                    face.dir.x !== 0
                      ? undefined
                      : `rotate(-90 ${(face.from.x + face.to.x) / 2 + face.outward.x * (gap + thick + fontMm * 1.1)} ${(face.from.y + face.to.y) / 2 + face.outward.y * (gap + thick + fontMm * 1.1)})`
                  }
                >
                  {Math.round(face.length)}
                </text>
              )}
            </g>
          );
        })}

        {cornerLayouts.map((cl) => {
          const corner = cornerById.get(cl.cornerId);
          if (!corner || cl.status === 'none') return null;
          const f1 = faceById.get(corner.inFaceId);
          const f2 = faceById.get(corner.outFaceId);
          if (!f1 || !f2) return null;
          const n = { x: f1.outward.x + f2.outward.x, y: f1.outward.y + f2.outward.y };
          const size = thick;
          const cx = corner.point.x + n.x * (gap + size / 2);
          const cy = corner.point.y + n.y * (gap + size / 2);
          const fill =
            cl.status === 'shortage'
              ? `url(#${patternId})`
              : colorForElement(cl.analiticId as number, orderedPanelIds);
          return (
            <rect
              key={`${cl.cornerId}-${cl.tier}`}
              x={cx - size / 2}
              y={cy - size / 2}
              width={size}
              height={size}
              fill={fill}
              stroke={cl.status === 'shortage' ? '#d32f2f' : '#1f2937'}
              strokeWidth={strokeMm}
              rx={size * 0.15}
            />
          );
        })}
      </svg>

      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12, marginTop: 6 }}>
          {Array.from(usedIds).map((id) => {
            const el = elementById.get(id);
            return (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    background: colorForElement(id, orderedPanelIds),
                    border: '1px solid #1f2937',
                    borderRadius: 2,
                    display: 'inline-block',
                  }}
                />
                {el?.name ?? `ID ${id}`}
              </span>
            );
          })}
          {hasShortage && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#b91c1c' }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  background: 'repeating-linear-gradient(45deg,#fde2e2 0 3px,#d32f2f 3px 4px)',
                  border: '1px solid #d32f2f',
                  borderRadius: 2,
                  display: 'inline-block',
                }}
              />
              Складда етишмайди
            </span>
          )}
          {hasGap && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4b5563' }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  background: 'repeating-linear-gradient(-45deg,#f3f4f6 0 3px,#9ca3af 3px 4px)',
                  border: '1px solid #6b7280',
                  borderRadius: 2,
                  display: 'inline-block',
                }}
              />
              Қўшимча вставка (зазор)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
