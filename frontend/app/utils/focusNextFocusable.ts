const EXCLUDED_INPUT_TYPES = new Set([
  'hidden',
  'file',
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'image',
]);

function isVisibleForFocusChain(el: HTMLElement): boolean {
  if (el.hasAttribute('hidden')) return false;
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  }
  return el.getClientRects().length > 0;
}

/** Focusable controls in document order inside `container` (for Enter-to-next navigation). */
export function getFocusableElementsInContainer(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>('input, select, textarea, button');
  const list: HTMLElement[] = [];

  nodes.forEach((el) => {
    if (!container.contains(el)) return;
    if (el.getAttribute('tabindex') === '-1') return;
    if (!isVisibleForFocusChain(el)) return;

    if (el.tagName === 'BUTTON') {
      const btn = el as HTMLButtonElement;
      if (btn.disabled) return;
      list.push(el);
      return;
    }

    const control = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (control.disabled) return;
    if (el.tagName === 'INPUT') {
      const t = ((el as HTMLInputElement).type || 'text').toLowerCase();
      if (EXCLUDED_INPUT_TYPES.has(t)) return;
    }
    list.push(el);
  });

  return list;
}

export type FocusNextFocusableOptions = {
  /**
   * If the next control lies inside `[data-doc-actions]`, focus `[data-document-save]` instead
   * when it exists (skips e.g. a recalculate button before Save).
   */
  preferDocumentSaveInActionBar?: boolean;
};

/** Moves focus to the next eligible control after `active`. Returns true if focus moved. */
export function focusNextFocusable(
  container: HTMLElement,
  active: Element | null,
  options?: FocusNextFocusableOptions
): boolean {
  if (!active || !(active instanceof HTMLElement)) return false;
  if (!container.contains(active)) return false;

  const candidates = getFocusableElementsInContainer(container);
  const idx = candidates.indexOf(active);
  if (idx === -1) return false;

  const next = candidates[idx + 1];
  if (!next) return false;

  let target = next;
  if (options?.preferDocumentSaveInActionBar) {
    const actions = container.querySelector('[data-doc-actions]');
    const save = container.querySelector('[data-document-save]') as HTMLButtonElement | null;
    if (
      actions &&
      save &&
      !save.disabled &&
      isVisibleForFocusChain(save) &&
      actions.contains(next) &&
      save !== next
    ) {
      target = save;
    }
  }

  target.focus();
  return true;
}

/** Moves focus to the previous eligible control before `active`. Returns true if focus moved. */
export function focusPreviousFocusable(
  container: HTMLElement,
  active: Element | null
): boolean {
  if (!active || !(active instanceof HTMLElement)) return false;
  if (!container.contains(active)) return false;

  const candidates = getFocusableElementsInContainer(container);
  const idx = candidates.indexOf(active);
  if (idx === -1) return false;

  const prev = candidates[idx - 1];
  if (!prev) return false;

  prev.focus();
  return true;
}
