'use client';

import React, { forwardRef } from 'react';

export const MIN_PRINT_COPIES = 1;
export const MAX_PRINT_COPIES = 4;
export const DEFAULT_PRINT_COPIES = 2;

/** Спрашивает число копий для печати. null — отмена / невалидное значение. */
export function askPrintCopyCount(): number | null {
  const raw = window.prompt('Нусхалар сони:', String(DEFAULT_PRINT_COPIES));
  if (raw == null) return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < MIN_PRINT_COPIES || n > MAX_PRINT_COPIES) {
    return null;
  }
  return n;
}

export type PrintCopiesWithTearOffProps = {
  copyCount: number;
  renderCopy: () => React.ReactNode;
};

const spacer = (height: number) => (
  <div
    style={{
      height,
      minHeight: height,
      lineHeight: `${height}px`,
      fontSize: 1,
      overflow: 'hidden',
    }}
    aria-hidden
  >
    &nbsp;
  </div>
);

/**
 * Рендерит N одинаковых бланков: по 2 на страницу с пунктирной линией отрыва.
 */
export const PrintCopiesWithTearOff = forwardRef<HTMLDivElement, PrintCopiesWithTearOffProps>(
  ({ copyCount, renderCopy }, ref) => {
    const count = Math.max(MIN_PRINT_COPIES, Math.min(MAX_PRINT_COPIES, copyCount || 1));

    return (
      <div ref={ref}>
        {Array.from({ length: count }, (_, index) => {
          const showTearBefore = index % 2 === 1;
          const pageBreakAfter = index % 2 === 1 && index < count - 1;
          const isFirstOfPair = index % 2 === 0 && index + 1 < count;

          return (
            <div
              key={index}
              style={{
                pageBreakAfter: pageBreakAfter ? 'always' : undefined,
                breakAfter: pageBreakAfter ? 'page' : undefined,
                paddingBottom: isFirstOfPair ? 24 : undefined,
              }}
            >
              {showTearBefore && (
                <>
                  {spacer(36)}
                  <div style={{ borderTop: '1px dashed #000' }} />
                  {spacer(30)}
                </>
              )}
              {renderCopy()}
            </div>
          );
        })}
      </div>
    );
  },
);

PrintCopiesWithTearOff.displayName = 'PrintCopiesWithTearOff';
