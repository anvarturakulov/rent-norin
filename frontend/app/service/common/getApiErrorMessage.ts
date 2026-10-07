/** Текст ошибки из ответа axios (Nest: message — строка или массив). */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const err = error as {
    message?: string;
    response?: { data?: unknown };
  };
  const data = err.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    const payload = data as { message?: unknown; error?: unknown };
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    if (Array.isArray(payload.message)) {
      const lines = payload.message.filter((x): x is string => typeof x === 'string');
      if (lines.length) return lines.join('\n');
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  }
  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  return fallback;
}
