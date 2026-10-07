/** Блокирует открытие inline-модалки по кнопке «+» (защита от «пробития» клика после Саклаш). */

let blockedUntilMs = 0;

export const setInlineQuickAddBlocked = (durationMs: number): void => {
  blockedUntilMs = Math.max(blockedUntilMs, Date.now() + durationMs);
};

export const isInlineQuickAddBlocked = (): boolean => {
  return Date.now() < blockedUntilMs;
};
