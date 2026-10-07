'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  DATE_INPUT_MAX,
  DATE_INPUT_MIN,
  combineDateAndTime,
  formatTimeForInput,
  formatTimeParts,
  isCompleteTimeInputValue,
  parseTimeInputValue,
} from '@/app/utils/datetimeInput';
import { formatDateForInput, parseDateInputValue } from '@/app/utils/dateInput';
import { getZonedParts } from '@/app/utils/appTime';
import { nowMs } from '@/app/utils/serverNow';

export interface UseControlledDateTimeInputOptions {
  emptyIfZero?: boolean;
  fallbackMs?: number;
}

function resolveCommittedMs(
  committedMs: number,
  options?: UseControlledDateTimeInputOptions,
): number {
  if (options?.emptyIfZero && committedMs <= 0) return 0;
  return committedMs > 0 ? committedMs : (options?.fallbackMs ?? nowMs());
}

function resolveDateString(
  committedMs: number,
  options?: UseControlledDateTimeInputOptions,
): string {
  const ms = resolveCommittedMs(committedMs, options);
  if (ms <= 0) return '';
  return formatDateForInput(ms);
}

function resolveTimeString(
  committedMs: number,
  options?: UseControlledDateTimeInputOptions,
): string {
  const ms = resolveCommittedMs(committedMs, options);
  if (ms <= 0) return '';
  return formatTimeForInput(ms);
}

function getTimeParts(
  timeEl: HTMLInputElement | null,
  fallbackMs: number,
): { hours: number; minutes: number } {
  const parsed = timeEl ? parseTimeInputValue(timeEl.value) : null;
  if (parsed) return parsed;
  const parts = getZonedParts(fallbackMs);
  return { hours: parts?.hours ?? 0, minutes: parts?.minutes ?? 0 };
}

function getDateMs(
  dateEl: HTMLInputElement | null,
  fallbackMs: number,
): number | null {
  if (dateEl) {
    const parsed = parseDateInputValue(dateEl.value);
    if (parsed !== null) return parsed;
  }
  return parseDateInputValue(formatDateForInput(fallbackMs));
}

/**
 * Datetime input: date + 24h time text; uncontrolled while editing; syncs from committedMs when not focused.
 */
export function useControlledDateTimeInput(
  committedMs: number,
  onCommit: (ms: number) => void,
  options?: UseControlledDateTimeInputOptions,
) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const dateDefaultValue = resolveDateString(committedMs, options);
  const timeDefaultValue = resolveTimeString(committedMs, options);

  useEffect(() => {
    const dateEl = dateInputRef.current;
    const timeEl = timeInputRef.current;
    const nextDate = resolveDateString(committedMs, options);
    const nextTime = resolveTimeString(committedMs, options);

    if (dateEl && document.activeElement !== dateEl && dateEl.value !== nextDate) {
      dateEl.value = nextDate;
    }
    if (timeEl && document.activeElement !== timeEl && timeEl.value !== nextTime) {
      timeEl.value = nextTime;
    }
  }, [committedMs, options?.emptyIfZero, options?.fallbackMs]);

  const resetToCommitted = useCallback(() => {
    const dateEl = dateInputRef.current;
    const timeEl = timeInputRef.current;
    if (dateEl) {
      dateEl.value = resolveDateString(committedMs, options);
    }
    if (timeEl) {
      timeEl.value = resolveTimeString(committedMs, options);
    }
  }, [committedMs, options?.emptyIfZero, options?.fallbackMs]);

  const commitFromInputs = useCallback(() => {
    const fallbackMs = resolveCommittedMs(committedMs, options);
    const dateMs = getDateMs(dateInputRef.current, fallbackMs);
    if (dateMs === null) return false;

    const { hours, minutes } = getTimeParts(timeInputRef.current, fallbackMs);
    const combined = combineDateAndTime(dateMs, hours, minutes);
    if (!Number.isFinite(combined)) return false;

    onCommit(combined);
    return true;
  }, [committedMs, onCommit, options?.emptyIfZero, options?.fallbackMs]);

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateMs = parseDateInputValue(e.target.value);
      if (dateMs === null) return;

      const fallbackMs = resolveCommittedMs(committedMs, options);
      const { hours, minutes } = getTimeParts(timeInputRef.current, fallbackMs);
      const combined = combineDateAndTime(dateMs, hours, minutes);
      if (Number.isFinite(combined)) {
        onCommit(combined);
      }
    },
    [committedMs, onCommit, options?.emptyIfZero, options?.fallbackMs],
  );

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!isCompleteTimeInputValue(raw)) return;

      const time = parseTimeInputValue(raw);
      if (time === null) return;

      const fallbackMs = resolveCommittedMs(committedMs, options);
      const dateMs = getDateMs(dateInputRef.current, fallbackMs);
      if (dateMs === null) return;

      const combined = combineDateAndTime(dateMs, time.hours, time.minutes);
      if (Number.isFinite(combined)) {
        onCommit(combined);
      }
    },
    [committedMs, onCommit, options?.emptyIfZero, options?.fallbackMs],
  );

  const handleDateBlur = useCallback(() => {
    const dateEl = dateInputRef.current;
    if (!dateEl) return;
    const dateMs = parseDateInputValue(dateEl.value);
    if (dateMs === null) {
      resetToCommitted();
      return;
    }
    if (!commitFromInputs()) {
      resetToCommitted();
    }
  }, [commitFromInputs, resetToCommitted]);

  const handleTimeBlur = useCallback(() => {
    const timeEl = timeInputRef.current;
    if (!timeEl) return;
    const time = parseTimeInputValue(timeEl.value);
    if (time === null) {
      resetToCommitted();
      return;
    }
    timeEl.value = formatTimeParts(time.hours, time.minutes);
    if (!commitFromInputs()) {
      resetToCommitted();
    }
  }, [commitFromInputs, resetToCommitted]);

  return {
    dateInputRef,
    timeInputRef,
    dateDefaultValue,
    timeDefaultValue,
    handleDateChange,
    handleTimeChange,
    handleDateBlur,
    handleTimeBlur,
    dateMin: DATE_INPUT_MIN,
    dateMax: DATE_INPUT_MAX,
  };
}
