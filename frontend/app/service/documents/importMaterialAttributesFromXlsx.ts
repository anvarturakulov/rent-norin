import { read, utils, type WorkBook } from 'xlsx';
import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import {
    ReferenceModel,
    TypeReference,
    TypeTMZ,
} from '@/app/interfaces/reference.interface';
import { buildTmzDisplayName } from '@/app/utils/buildTmzDisplayName';

export interface ParsedMaterialAttrRow {
    name: string;
    article: string;
    size: string;
    color: string;
    manufacture: string;
}

export interface ImportMaterialAttrsResult {
    updated: number;
    unchanged: number;
    skipped: number;
    errors: string[];
    /** ID справочников, успешно обновлённых через PATCH */
    updatedIds: number[];
}

export interface ImportMaterialAttrsOptions {
    file: File;
    token: string;
    allReferences: ReferenceModel[];
    enterpriseId?: number | null;
    onProgress?: (processed: number, total: number) => void;
    requestDelayMs?: number;
    maxRetriesOn429?: number;
}

/** Текст итога импорта для showMessage (с перечнем пропущенных позиций). */
export function formatMaterialAttrsImportMessage(
    result: ImportMaterialAttrsResult,
    maxSkippedLines = 50,
): string {
    const lines: string[] = [
        `Импорт характеристик: обновлено ${result.updated}; без изменений ${result.unchanged}${result.skipped ? `; пропущено ${result.skipped}` : ''}`,
    ];

    const warnings = result.errors.filter(
        (e) =>
            !e.startsWith('Подгрузка справочников:') &&
            e.includes('несколько материалов'),
    );
    if (warnings.length > 0) {
        lines.push('', 'Дубликаты артикула (обновлена одна запись):');
        const shown = warnings.slice(0, 10);
        for (const w of shown) {
            lines.push(`• ${w}`);
        }
        if (warnings.length > 10) {
            lines.push(`… и ещё ${warnings.length - 10}`);
        }
    }

    const rowErrors = result.errors.filter(
        (e) =>
            !e.startsWith('Подгрузка справочников:') &&
            !e.includes('несколько материалов'),
    );
    if (rowErrors.length > 0) {
        lines.push('', 'Пропущенные позиции:');
        const shown = rowErrors.slice(0, maxSkippedLines);
        for (const err of shown) {
            lines.push(`• ${err}`);
        }
        if (rowErrors.length > maxSkippedLines) {
            lines.push(`… и ещё ${rowErrors.length - maxSkippedLines}`);
        }
    }

    const prefetchWarning = result.errors.find((e) => e.startsWith('Подгрузка справочников:'));
    if (prefetchWarning) {
        lines.push('', prefetchWarning);
    }

    return lines.join('\n');
}

const MATERIALS_SHEET_NAME = 'Материаллар';
const SHEET_MATERIALS_SHEET_NAME = 'Листовые материалы';

const HEADER_KEYS = {
    name: 'Наименование',
    nameAlt: 'Номи',
    size: 'Размер',
    color: 'Ранг',
    manufacture: 'Ишлаб чикарувчи',
    article: 'Артикул',
} as const;

type AttrHeaderKey = 'name' | 'size' | 'color' | 'manufacture' | 'article';
type AttrCols = Record<AttrHeaderKey, number>;

function normalizeHeader(h: string): string {
    return h.trim().toLowerCase();
}

function normalizeSheetName(name: string): string {
    return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function cellStr(v: unknown): string {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
    return String(v).trim();
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as ArrayBuffer);
        fr.onerror = () => reject(new Error('Не удалось прочитать файл'));
        fr.readAsArrayBuffer(file);
    });
}

function findAttrHeaderColumns(matrix: unknown[][]): {
    headerIdx: number;
    cols: AttrCols;
} | null {
    for (let i = 0; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        const normalized = row.map(cellStr).map(normalizeHeader);

        const findIncludes = (needle: string): number =>
            normalized.findIndex((h) => h.includes(needle.toLowerCase()));

        let nameCol = findIncludes(HEADER_KEYS.name);
        if (nameCol < 0) {
            nameCol = findIncludes(HEADER_KEYS.nameAlt);
        }

        const cols: AttrCols = {
            name: nameCol,
            size: findIncludes(HEADER_KEYS.size),
            color: findIncludes(HEADER_KEYS.color),
            manufacture: findIncludes(HEADER_KEYS.manufacture),
            article: findIncludes(HEADER_KEYS.article),
        };

        if (
            cols.article >= 0 &&
            cols.size >= 0 &&
            cols.color >= 0 &&
            cols.manufacture >= 0
        ) {
            return { headerIdx: i, cols };
        }
    }
    return null;
}

function parseMatrixToRows(matrix: unknown[][]): ParsedMaterialAttrRow[] {
    const found = findAttrHeaderColumns(matrix);
    if (!found) {
        return [];
    }
    const { headerIdx, cols } = found;

    const out: ParsedMaterialAttrRow[] = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const article = cellStr(row[cols.article]);
        if (!article) continue;

        out.push({
            name: cols.name >= 0 ? cellStr(row[cols.name]) : '',
            article,
            size: cellStr(row[cols.size]),
            color: cellStr(row[cols.color]),
            manufacture: cellStr(row[cols.manufacture]),
        });
    }

    return out;
}

function parseWorkbookToRows(wb: WorkBook): ParsedMaterialAttrRow[] {
    const byArticle = new Map<string, ParsedMaterialAttrRow>();

    const sheetNamesToImport = [MATERIALS_SHEET_NAME, SHEET_MATERIALS_SHEET_NAME];
    for (const targetName of sheetNamesToImport) {
        const targetNorm = normalizeSheetName(targetName);
        const sheet = wb.SheetNames.find((n) => normalizeSheetName(n) === targetNorm);
        if (!sheet) continue;
        const ws = wb.Sheets[sheet];
        const matrix = utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
        for (const row of parseMatrixToRows(matrix)) {
            byArticle.set(row.article, row);
        }
    }

    if (byArticle.size > 0) {
        return [...byArticle.values()];
    }

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const matrix = utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
        const part = parseMatrixToRows(matrix);
        if (part.length > 0) {
            for (const row of part) {
                byArticle.set(row.article, row);
            }
            return [...byArticle.values()];
        }
    }

    throw new Error(
        `Не найден лист «${MATERIALS_SHEET_NAME}» или таблица с колонками: Артикул, Размер, Ранг, Ишлаб чикарувчи`,
    );
}

export async function parseMaterialAttrsXlsx(file: File): Promise<ParsedMaterialAttrRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array' });
    if (!wb.SheetNames.length) {
        throw new Error('В файле нет листов');
    }
    return parseWorkbookToRows(wb);
}

const authHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RequestPacingState {
    delayMs: number;
    maxRetriesOn429: number;
    lastCallAt: number;
}

async function pace(state: RequestPacingState): Promise<void> {
    const now = Date.now();
    const wait = state.delayMs - (now - state.lastCallAt);
    if (wait > 0) await sleep(wait);
    state.lastCallAt = Date.now();
}

function getRetryAfterMs(err: any): number {
    const headerVal =
        err?.response?.headers?.['retry-after'] ??
        err?.response?.headers?.['Retry-After'];
    if (headerVal != null) {
        const n = Number(headerVal);
        if (Number.isFinite(n) && n > 0) return n * 1000;
        const t = Date.parse(String(headerVal));
        if (!Number.isNaN(t)) {
            const diff = t - Date.now();
            if (diff > 0) return diff;
        }
    }
    return 0;
}

async function withRetryOn429<T>(
    fn: () => Promise<T>,
    state: RequestPacingState,
): Promise<T> {
    let attempt = 0;
    while (true) {
        await pace(state);
        try {
            return await fn();
        } catch (err: any) {
            const status = err?.response?.status;
            if (status !== 429 || attempt >= state.maxRetriesOn429) {
                throw err;
            }
            const retryAfter = getRetryAfterMs(err);
            const backoff = retryAfter > 0
                ? retryAfter
                : Math.min(15000, 1000 * Math.pow(2, attempt));
            attempt += 1;
            await sleep(backoff);
        }
    }
}

async function patchReference(
    id: number,
    payload: Record<string, unknown>,
    token: string,
    state: RequestPacingState,
): Promise<ReferenceModel> {
    return withRetryOn429(async () => {
        const res = await axios.patch(withApiDomain(`/api/references/${id}`), payload, {
            headers: authHeaders(token),
        });
        return res.data as ReferenceModel;
    }, state);
}

async function fetchAllReferences(
    token: string,
    state: RequestPacingState,
): Promise<ReferenceModel[]> {
    return withRetryOn429(async () => {
        const res = await axios.get(withApiDomain('/api/references/all'), {
            headers: authHeaders(token),
        });
        return res.data as ReferenceModel[];
    }, state);
}

function findMaterialsByArticle(
    refs: ReferenceModel[],
    article: string,
): ReferenceModel[] {
    const target = article.trim();
    if (!target) return [];
    return refs.filter(
        (r) =>
            r.typeReference === TypeReference.TMZ &&
            !r.isFolder &&
            !r.refValues?.markToDeleted &&
            (r.article || '').trim() === target &&
            r.refValues?.typeTMZ === TypeTMZ.MATERIAL,
    );
}

function findMaterialByArticle(
    refs: ReferenceModel[],
    article: string,
    enterpriseId?: number | null,
): { material: ReferenceModel | undefined; duplicateWarning?: string } {
    const matches = findMaterialsByArticle(refs, article);
    if (matches.length === 0) return { material: undefined };
    if (matches.length === 1) return { material: matches[0] };

    const warn = (picked: ReferenceModel) =>
        `${article}: несколько материалов (${matches.length}) с артикулом, обновлён id=${picked.id}`;

    if (enterpriseId != null) {
        const sameEnterprise = matches.filter((r) => r.enterpriseId === enterpriseId);
        if (sameEnterprise.length === 1) {
            return { material: sameEnterprise[0], duplicateWarning: warn(sameEnterprise[0]) };
        }
        const preferred =
            sameEnterprise[0] ??
            matches.find((r) => r.enterpriseId == null) ??
            matches[0];
        return { material: preferred, duplicateWarning: warn(preferred) };
    }

    const shared = matches.filter((r) => r.enterpriseId == null);
    const picked = shared[0] ?? matches[0];
    return { material: picked, duplicateWarning: warn(picked) };
}

interface MergeAttrResult {
    refValues: Pick<
        ReferenceModel['refValues'],
        'typeTMZ' | 'shortName' | 'size' | 'color' | 'manufacture'
    >;
    displayName: string;
    changed: boolean;
}

/** Значение для PATCH: пустая строка из Excel → null (очистить поле в БД). */
function attrFieldForPatch(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function mergeAttrRefValues(
    existing: ReferenceModel,
    row: ParsedMaterialAttrRow,
): MergeAttrResult {
    const rv = existing.refValues || {};
    const prevShortName = (rv.shortName ?? '').trim();
    const prevSize = (rv.size ?? '').trim();
    const prevColor = (rv.color ?? '').trim();
    const prevManufacture = (rv.manufacture ?? '').trim();
    const prevName = (existing.name || '').trim();

    const nextShortName = row.name.trim();
    const nextSize = row.size.trim();
    const nextColor = row.color.trim();
    const nextManufacture = row.manufacture.trim();

    const displayName =
        buildTmzDisplayName({
            shortName: nextShortName,
            size: nextSize,
            color: nextColor,
            manufacture: nextManufacture,
            typeTMZ: TypeTMZ.MATERIAL,
        }) || prevName;

    const changed =
        nextShortName !== prevShortName ||
        nextSize !== prevSize ||
        nextColor !== prevColor ||
        nextManufacture !== prevManufacture ||
        displayName !== prevName;

    return {
        refValues: {
            typeTMZ: TypeTMZ.MATERIAL,
            shortName: attrFieldForPatch(nextShortName),
            size: attrFieldForPatch(nextSize),
            color: attrFieldForPatch(nextColor),
            manufacture: attrFieldForPatch(nextManufacture),
        },
        displayName,
        changed,
    };
}

export async function importMaterialAttributesFromXlsx({
    file,
    token,
    allReferences,
    enterpriseId,
    onProgress,
    requestDelayMs,
    maxRetriesOn429,
}: ImportMaterialAttrsOptions): Promise<ImportMaterialAttrsResult> {
    const rows = await parseMaterialAttrsXlsx(file);

    const result: ImportMaterialAttrsResult = {
        updated: 0,
        unchanged: 0,
        skipped: 0,
        errors: [],
        updatedIds: [],
    };

    const pacing: RequestPacingState = {
        delayMs: typeof requestDelayMs === 'number' && requestDelayMs >= 0 ? requestDelayMs : 220,
        maxRetriesOn429: typeof maxRetriesOn429 === 'number' && maxRetriesOn429 >= 0 ? maxRetriesOn429 : 5,
        lastCallAt: 0,
    };

    let refsLocal: ReferenceModel[] = Array.isArray(allReferences) ? [...allReferences] : [];
    try {
        const fresh = await fetchAllReferences(token, pacing);
        if (Array.isArray(fresh) && fresh.length) refsLocal = fresh;
    } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Не удалось обновить справочники';
        result.errors.push(`Подгрузка справочников: ${msg}`);
    }

    let processed = 0;
    const total = rows.length;

    for (const row of rows) {
        try {
            const { material: existing, duplicateWarning } = findMaterialByArticle(
                refsLocal,
                row.article,
                enterpriseId,
            );
            if (duplicateWarning) {
                result.errors.push(duplicateWarning);
            }
            if (!existing?.id) {
                result.skipped += 1;
                result.errors.push(`Материал не найден: ${row.article}`);
                continue;
            }

            const { refValues, displayName, changed } = mergeAttrRefValues(existing, row);
            if (!changed) {
                result.unchanged += 1;
                continue;
            }

            const updated = await patchReference(
                existing.id,
                {
                    name: displayName,
                    article: row.article,
                    typeReference: TypeReference.TMZ,
                    isFolder: false,
                    refValues,
                },
                token,
                pacing,
            );

            if (updated?.id) {
                result.updated += 1;
                result.updatedIds.push(updated.id);
                const idx = refsLocal.findIndex((r) => r.id === updated.id);
                if (idx >= 0) refsLocal[idx] = updated;
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Ошибка обновления';
            result.errors.push(`${row.article}: ${msg}`);
            result.skipped += 1;
        } finally {
            processed += 1;
            if (onProgress) onProgress(processed, total);
        }
    }

    return result;
}
