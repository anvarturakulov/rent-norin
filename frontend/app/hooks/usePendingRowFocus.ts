'use client';

import { useCallback, useState } from 'react';

export function usePendingRowFocus() {
    const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);

    const requestFocus = useCallback((draftId: string) => {
        setPendingDraftId(draftId);
    }, []);

    const clearFocus = useCallback(() => {
        setPendingDraftId(null);
    }, []);

    const shouldFocus = useCallback(
        (draftId: string) => pendingDraftId === draftId,
        [pendingDraftId],
    );

    return { pendingDraftId, requestFocus, clearFocus, shouldFocus };
}

export function applyNativeFocus(
    el: HTMLElement | null,
    draftId: string,
    focusDraftId: string | null,
    onApplied: () => void,
): void {
    if (!el || focusDraftId !== draftId) return;
    requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'nearest' });
        el.focus();
        onApplied();
    });
}
