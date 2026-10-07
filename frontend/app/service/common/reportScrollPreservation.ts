type SavedScroller = {
  kind: 'dashboard' | 'report';
  index: number;
  scrollTop: number;
};

type SavedScroll = {
  scrollers: SavedScroller[];
  windowX: number;
  windowY: number;
  docAnchorId: number | null;
};

let savedScroll: SavedScroll | null = null;

const DASHBOARD_SCROLL_SELECTOR = '[data-dashboard-scroll]';
const REPORT_SCROLL_SELECTOR = '[data-report-scroll]';
const DOC_ANCHOR_ATTR = 'data-report-doc-anchor';

function readScrollables(): SavedScroller[] {
  const scrollers: SavedScroller[] = [];

  document.querySelectorAll<HTMLElement>(DASHBOARD_SCROLL_SELECTOR).forEach((node, index) => {
    scrollers.push({ kind: 'dashboard', index, scrollTop: node.scrollTop });
  });

  document.querySelectorAll<HTMLElement>(REPORT_SCROLL_SELECTOR).forEach((node, index) => {
    scrollers.push({ kind: 'report', index, scrollTop: node.scrollTop });
  });

  return scrollers;
}

function applyScrollTops(saved: SavedScroll): void {
  window.scrollTo(saved.windowX, saved.windowY);
  document.documentElement.scrollTop = saved.windowY;
  document.body.scrollTop = saved.windowY;

  for (const item of saved.scrollers) {
    const selector =
      item.kind === 'dashboard' ? DASHBOARD_SCROLL_SELECTOR : REPORT_SCROLL_SELECTOR;
    const node = document.querySelectorAll<HTMLElement>(selector)[item.index];
    if (node) node.scrollTop = item.scrollTop;
  }
}

function scrollToDocAnchor(docId: number | null): void {
  if (!docId) return;
  const el = document.querySelector<HTMLElement>(`[${DOC_ANCHOR_ATTR}="${docId}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
}

/** Call synchronously before opening a document from a report row/sum. */
export function saveReportScrollBeforeDocument(docId?: number | null): void {
  if (typeof document === 'undefined') return;

  savedScroll = {
    scrollers: readScrollables(),
    windowX: window.scrollX || window.pageXOffset || 0,
    windowY: window.scrollY || window.pageYOffset || 0,
    docAnchorId: docId != null && Number.isFinite(Number(docId)) ? Number(docId) : null,
  };
}

/**
 * Restore report place after closing a document opened from a report.
 * Retries across frames so layout/focus after Doc unmount cannot win the race.
 */
export function restoreReportScrollAfterDocument(): void {
  if (typeof document === 'undefined' || !savedScroll) return;

  const snapshot = savedScroll;
  savedScroll = null;

  const run = () => {
    applyScrollTops(snapshot);
    scrollToDocAnchor(snapshot.docAnchorId);
  };

  run();
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
  window.setTimeout(run, 0);
  window.setTimeout(run, 50);
  window.setTimeout(run, 150);
}

export function clearSavedReportScroll(): void {
  savedScroll = null;
}

export const REPORT_DOC_ANCHOR_ATTR = DOC_ANCHOR_ATTR;
