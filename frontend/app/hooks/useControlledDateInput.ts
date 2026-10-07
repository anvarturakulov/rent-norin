'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  DATE_INPUT_MAX,
  DATE_INPUT_MIN,
  formatDateForInput,
  parseDateInputValue,
} from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';

export interface UseControlledDateInputOptions {
  /** When true and committedMs <= 0, show and reset to empty string */
  emptyIfZero?: boolean;
  /** Used for display/sync when committedMs <= 0 and emptyIfZero is false */
  fallbackMs?: number;
  /** When true, onCommit runs only on blur (not on each change) */
  commitOnBlurOnly?: boolean;
  /** Keep Tashkent time-of-day from committedMs when the calendar day changes */
  keepTime?: boolean;
}

function resolveCommittedString(
  committedMs: number,
  options?: UseControlledDateInputOptions,
): string {
  if (options?.emptyIfZero && committedMs <= 0) return '';
  const ms =
    committedMs > 0 ? committedMs : (options?.fallbackMs ?? nowMs());
  return formatDateForInput(ms);
}

/**
 * Date input: uncontrolled while the user edits (native year/month/day segments work).
 * Syncs from committedMs when not focused; validates range on change/blur.
 */
export function useControlledDateInput(
  committedMs: number,
  onCommit: (ms: number) => void,
  options?: UseControlledDateInputOptions,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedStr = resolveCommittedString(committedMs, options);

  const parseValue = useCallback(
    (value: string) => {
      const timeFromMs = options?.keepTime
        ? committedMs > 0
          ? committedMs
          : (options?.fallbackMs ?? nowMs())
        : undefined;
      return parseDateInputValue(value, timeFromMs != null ? { timeFromMs } : undefined);
    },
    [committedMs, options?.fallbackMs, options?.keepTime],
  );

  useEffect(() => {
    const el = inputRef.current;
    if (!el || document.activeElement === el) return;
    const next = resolveCommittedString(committedMs, options);
    if (el.value !== next) {
      el.value = next;
    }
  }, [committedMs, options?.emptyIfZero, options?.fallbackMs]);

  const resetToCommitted = useCallback(() => {
    const el = inputRef.current;
    if (el) {
      el.value = resolveCommittedString(committedMs, options);
    }
  }, [committedMs, options?.emptyIfZero, options?.fallbackMs]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (options?.commitOnBlurOnly) return;
      const parsed = parseValue(e.target.value);
      if (parsed !== null) {
        onCommit(parsed);
      }
    },
    [onCommit, options?.commitOnBlurOnly, parseValue],
  );

  const handleBlur = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const parsed = parseValue(el.value);
    if (parsed !== null) {
      onCommit(parsed);
      return;
    }
    resetToCommitted();
  }, [onCommit, parseValue, resetToCommitted]);

  return {
    inputRef,
    defaultValue: committedStr,
    handleChange,
    handleBlur,
    min: DATE_INPUT_MIN,
    max: DATE_INPUT_MAX,
  };
}
