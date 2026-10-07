import { resolveApiBaseUrl } from '@/app/service/common/getApiDomain';

const API_IMAGE_PREFIX = '/api/upload/image/';

/** URL миниатюры ТМЗ по значению imagePath из refValues (имя файла или полный URL). */
export function resolveTmzProductImageUrl(
  imagePath: string | undefined | null,
): string | null {
  if (imagePath == null || typeof imagePath !== 'string') return null;
  const trimmed = imagePath.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const base = resolveApiBaseUrl().replace(/\/+$/, '');
  if (!base) return null;

  let filename = trimmed;
  const prefixIdx = trimmed.indexOf(API_IMAGE_PREFIX);
  if (prefixIdx >= 0) {
    filename = trimmed.slice(prefixIdx + API_IMAGE_PREFIX.length);
  } else if (trimmed.includes('/')) {
    filename = trimmed.split('/').pop() || trimmed;
  }

  filename = filename.trim();
  if (!filename) return null;

  return `${base}${API_IMAGE_PREFIX}${encodeURIComponent(filename)}`;
}

export type TmzGalleryRefValues = {
  imagePath?: string;
  imagePath2?: string;
  imagePath3?: string;
};

/** Первое непустое поле галереи ТМЗ. */
export function pickTmzGalleryImagePath(refValues?: TmzGalleryRefValues | null): string | null {
  if (!refValues) return null;
  for (const key of ['imagePath', 'imagePath2', 'imagePath3'] as const) {
    const v = refValues[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** URL всех слотов галереи ТМЗ (1–3) для просмотра в модалке. */
export function getTmzGalleryImageUrls(refValues?: TmzGalleryRefValues | null): string[] {
  if (!refValues) return [];
  const urls: string[] = [];
  for (const key of ['imagePath', 'imagePath2', 'imagePath3'] as const) {
    const resolved = resolveTmzProductImageUrl(refValues[key]);
    if (resolved) urls.push(resolved);
  }
  return urls;
}
