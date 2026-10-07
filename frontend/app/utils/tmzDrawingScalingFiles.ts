import type { TmzDrawingScalingFile } from '@/app/interfaces/reference.interface';

function str(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    return String(v).trim();
}

/** Приводит элемент JSONB к виду для UI; мусор и пустые записи → null. */
export function coerceTmzDrawingFile(raw: unknown): TmzDrawingScalingFile | null {
    if (raw == null) return null;
    if (typeof raw === 'string') {
        const t = raw.trim();
        return t ? t : null;
    }
    if (typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    let url = str(o.url) || str(o.URL) || str(o.href);
    const filename = str(o.filename);
    if (!url && filename) {
        url = `/api/upload/tmz-product-file/${encodeURIComponent(filename)}`;
    }
    if (!url) return null;

    const originalName = str(o.originalName) || str(o.originalname);
    const visibleToClient = o.visibleToClient === true;

    if (originalName) {
        return { url, originalName, ...(visibleToClient ? { visibleToClient: true } : {}) };
    }
    return visibleToClient ? { url, visibleToClient: true } : { url };
}

export function normalizeTmzDrawingFilesList(raw: unknown): TmzDrawingScalingFile[] {
    let arr: unknown[] = [];
    if (!raw) return [];
    if (Array.isArray(raw)) {
        arr = raw;
    } else if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw);
            arr = Array.isArray(p) ? p : [];
        } catch {
            return [];
        }
    } else {
        return [];
    }
    return arr.map(coerceTmzDrawingFile).filter((x): x is TmzDrawingScalingFile => x != null);
}
