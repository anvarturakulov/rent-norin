import { read, utils, type WorkBook } from 'xlsx';
import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import { DocTableItem } from '@/app/interfaces/document.interface';
import { ReferenceModel, TypeReference, TypeTMZ } from '@/app/interfaces/reference.interface';
import { buildTmzDisplayName } from '@/app/utils/buildTmzDisplayName';

export const OS_AMORTIZATION_START_DATE = '2026-05-01';

export interface ParsedOsRemainRow {
    /** Значение колонки «Наименование» → refValues.shortName */
    shortName: string;
    article: string;
    groupArticle: string;
    unit: string;
    amortizationCoefficient: number;
    price: number;
}

export interface ImportOsSkipEntry {
    article: string;
    name: string;
    reason: string;
}

export interface ImportOsRemainsResult {
    newItems: DocTableItem[];
    createdGroups: number;
    createdOs: number;
    updatedOs: number;
    skipped: number;
    /** Позиции, не попавшие в документ или не обработанные из-за ошибки */
    skippedItems: ImportOsSkipEntry[];
    errors: string[];
}

/** Текст итога импорта для showMessage (с перечнем пропущенных позиций). */
export function formatOsRemainsImportMessage(
    result: ImportOsRemainsResult,
    maxSkippedLines = 50,
): string {
    const lines: string[] = [
        `Импорт остатков ОС: создано ${result.createdOs}, групп ${result.createdGroups}, обновлено ${result.updatedOs}; добавлено в документ ${result.newItems.length} строк${result.skipped ? `; пропущено ${result.skipped}` : ''}`,
    ];

    if (result.skippedItems.length > 0) {
        lines.push('', 'Пропущенные позиции:');
        const shown = result.skippedItems.slice(0, maxSkippedLines);
        for (const item of shown) {
            const label = item.article
                ? `${item.article}${item.name ? ` — ${item.name}` : ''}`
                : item.name || '—';
            lines.push(`• ${label}: ${item.reason}`);
        }
        if (result.skippedItems.length > maxSkippedLines) {
            lines.push(`… и ещё ${result.skippedItems.length - maxSkippedLines}`);
        }
    }

    const otherErrors = result.errors.filter(
        (e) => !e.startsWith('Подгрузка справочников:') && !e.startsWith('Группа '),
    );
    if (otherErrors.length > 0 && result.skippedItems.length === 0) {
        lines.push('', 'Ошибки:');
        for (const err of otherErrors.slice(0, maxSkippedLines)) {
            lines.push(`• ${err}`);
        }
    }

    const prefetchWarning = result.errors.find((e) => e.startsWith('Подгрузка справочников:'));
    if (prefetchWarning) {
        lines.push('', prefetchWarning);
    }

    const groupErrors = result.errors.filter((e) => e.startsWith('Группа '));
    if (groupErrors.length > 0) {
        lines.push('', 'Ошибки групп:');
        for (const err of groupErrors.slice(0, 20)) {
            lines.push(`• ${err}`);
        }
    }

    return lines.join('\n');
}

function recordOsSkip(
    result: ImportOsRemainsResult,
    row: ParsedOsRemainRow,
    reason: string,
): void {
    result.skipped += 1;
    result.skippedItems.push({
        article: row.article,
        name: row.shortName,
        reason,
    });
}

function osDisplayName(shortName: string): string {
    const s = shortName.trim();
    return buildTmzDisplayName({ shortName: s, typeTMZ: TypeTMZ.OS }) || s;
}

export interface ImportOsRemainsOptions {
    file: File;
    token: string;
    allReferences: ReferenceModel[];
    onProgress?: (processed: number, total: number) => void;
    requestDelayMs?: number;
    maxRetriesOn429?: number;
}

const OS_SHEET_NAME = 'Асосий воситалар';

const HEADER_KEYS = {
    name: 'Наименование',
    article: 'Артикул',
    groupArticle: 'Группа',
    unit: 'изм.',
    amortization: 'амортизации',
    price: 'Нархи',
} as const;

function cellStr(v: unknown): string {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
    return String(v).trim();
}

function cellNum(v: unknown): number {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = String(v).trim().replace(/\s+/g, '').replace(',', '.');
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as ArrayBuffer);
        fr.onerror = () => reject(new Error('Не удалось прочитать файл'));
        fr.readAsArrayBuffer(file);
    });
}

function normalizeSheetName(name: string): string {
    return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findHeaderColumns(matrix: unknown[][]): {
    headerIdx: number;
    cols: Record<keyof typeof HEADER_KEYS, number>;
} | null {
    for (let i = 0; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        const headers = row.map(cellStr);

        const find = (needle: string): number =>
            headers.findIndex((h) => h.toLowerCase().includes(needle.toLowerCase()));

        const cols = {
            name: find(HEADER_KEYS.name),
            article: find(HEADER_KEYS.article),
            groupArticle: find(HEADER_KEYS.groupArticle),
            unit: find(HEADER_KEYS.unit),
            amortization: find(HEADER_KEYS.amortization),
            price: find(HEADER_KEYS.price),
        };

        if (
            cols.name >= 0 &&
            cols.article >= 0 &&
            cols.groupArticle >= 0 &&
            cols.unit >= 0 &&
            cols.amortization >= 0 &&
            cols.price >= 0
        ) {
            return { headerIdx: i, cols };
        }
    }
    return null;
}

function parseMatrixToRows(matrix: unknown[][]): ParsedOsRemainRow[] {
    const found = findHeaderColumns(matrix);
    if (!found) {
        throw new Error(
            'Не найдена строка заголовка с колонками: Наименование, Артикул, Группа, Ед. изм., % амортизации, Нархи',
        );
    }
    const { headerIdx, cols } = found;

    const out: ParsedOsRemainRow[] = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const shortName = cellStr(row[cols.name]);
        const article = cellStr(row[cols.article]);
        if (!shortName || !article) continue;

        out.push({
            shortName,
            article,
            groupArticle: cellStr(row[cols.groupArticle]),
            unit: cellStr(row[cols.unit]),
            amortizationCoefficient: cellNum(row[cols.amortization]),
            price: cellNum(row[cols.price]),
        });
    }

    return out;
}

function resolveOsSheetMatrix(wb: WorkBook): unknown[][] {
    const targetNorm = normalizeSheetName(OS_SHEET_NAME);
    const namedSheet = wb.SheetNames.find((n) => normalizeSheetName(n) === targetNorm);
    if (namedSheet) {
        const ws = wb.Sheets[namedSheet];
        return utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    }

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const matrix = utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
        if (findHeaderColumns(matrix)) {
            return matrix;
        }
    }

    throw new Error(
        `Не найден лист «${OS_SHEET_NAME}» или таблица с колонками ОС (Наименование, Артикул, Группа, % амортизации, Нархи)`,
    );
}

export async function parseOsRemainsXlsx(file: File): Promise<ParsedOsRemainRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array' });
    if (!wb.SheetNames.length) {
        throw new Error('В файле нет листов');
    }
    const matrix = resolveOsSheetMatrix(wb);
    return parseMatrixToRows(matrix);
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

async function createReference(
    payload: Record<string, unknown>,
    token: string,
    state: RequestPacingState,
): Promise<ReferenceModel> {
    return withRetryOn429(async () => {
        const res = await axios.post(withApiDomain('/api/references/create'), payload, {
            headers: authHeaders(token),
        });
        return res.data as ReferenceModel;
    }, state);
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

function findTmzByArticle(
    refs: ReferenceModel[],
    article: string,
): ReferenceModel | undefined {
    const target = article.trim();
    if (!target) return undefined;
    return refs.find(
        (r) =>
            r.typeReference === TypeReference.TMZ &&
            (r.article || '').trim() === target,
    );
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

function buildOsRefValues(
    base: RefValuesPartial | undefined,
    shortName: string,
    unit: string,
    amortizationCoefficient: number,
): Record<string, unknown> {
    const trimmedShort = shortName.trim();
    return {
        ...(base || {}),
        typeTMZ: TypeTMZ.OS,
        shortName: trimmedShort || base?.shortName,
        unit: unit || base?.unit,
        amortizationCoefficient: amortizationCoefficient > 0
            ? amortizationCoefficient
            : base?.amortizationCoefficient,
        amortizationStartDate: OS_AMORTIZATION_START_DATE,
    };
}

type RefValuesPartial = ReferenceModel['refValues'];

export async function importInitialOsRemain({
    file,
    token,
    allReferences,
    onProgress,
    requestDelayMs,
    maxRetriesOn429,
}: ImportOsRemainsOptions): Promise<ImportOsRemainsResult> {
    const rows = await parseOsRemainsXlsx(file);

    const result: ImportOsRemainsResult = {
        newItems: [],
        createdGroups: 0,
        createdOs: 0,
        updatedOs: 0,
        skipped: 0,
        skippedItems: [],
        errors: [],
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

    let refsRefetchedOnConflict = false;
    const tryResolveByArticleOn409 = async (
        article: string,
    ): Promise<ReferenceModel | undefined> => {
        if (!refsRefetchedOnConflict) {
            try {
                const fresh = await fetchAllReferences(token, pacing);
                if (Array.isArray(fresh) && fresh.length) refsLocal = fresh;
            } catch {
                // ignore
            } finally {
                refsRefetchedOnConflict = true;
            }
        }
        return findTmzByArticle(refsLocal, article);
    };

    const groupArticles = new Set<string>();
    for (const row of rows) {
        if (row.groupArticle) groupArticles.add(row.groupArticle);
    }

    const groupIdByArticle = new Map<string, number>();
    for (const groupArticle of groupArticles) {
        try {
            const existing = findTmzByArticle(refsLocal, groupArticle);
            if (existing?.id) {
                groupIdByArticle.set(groupArticle, existing.id);
                continue;
            }
            try {
                const created = await createReference(
                    {
                        name: groupArticle,
                        article: groupArticle,
                        typeReference: TypeReference.TMZ,
                        isFolder: true,
                        enterpriseId: null,
                        refValues: { typeTMZ: TypeTMZ.OS },
                    },
                    token,
                    pacing,
                );
                if (created?.id) {
                    groupIdByArticle.set(groupArticle, created.id);
                    refsLocal.push(created);
                    result.createdGroups += 1;
                }
            } catch (err: any) {
                if (err?.response?.status === 409) {
                    const found = await tryResolveByArticleOn409(groupArticle);
                    if (found?.id) {
                        groupIdByArticle.set(groupArticle, found.id);
                        continue;
                    }
                }
                throw err;
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Ошибка создания группы';
            result.errors.push(`Группа ${groupArticle}: ${msg}`);
        }
    }

    let processed = 0;
    const total = rows.length;
    for (const row of rows) {
        try {
            const groupId = groupIdByArticle.get(row.groupArticle);
            let existing = findTmzByArticle(refsLocal, row.article);

            let analiticId: number | undefined;
            const wantUnit = row.unit.trim();
            const wantCoef = row.amortizationCoefficient;

            if (existing?.id && !existing.isFolder) {
                analiticId = existing.id;
                const currentName = (existing.name || '').trim();
                const currentShortName = (existing.refValues?.shortName || '').trim();
                const currentUnit = (existing.refValues?.unit || '').trim();
                const currentParentId = existing.parentId == null ? null : existing.parentId;
                const currentCoef = Number(existing.refValues?.amortizationCoefficient ?? 0);
                const currentStart = String(existing.refValues?.amortizationStartDate ?? '').slice(0, 10);
                const wantShortName = row.shortName.trim();
                const wantDisplayName = osDisplayName(wantShortName) || currentName;

                const parentNeedsFix = !!groupId && currentParentId !== groupId;
                const coefNeedsFix = wantCoef > 0 && wantCoef !== currentCoef;
                const startNeedsFix = currentStart !== OS_AMORTIZATION_START_DATE;
                const shortNameNeedsFix = wantShortName && wantShortName !== currentShortName;
                const nameNeedsFix = wantDisplayName !== currentName;
                const needUpdate =
                    shortNameNeedsFix ||
                    nameNeedsFix ||
                    (wantUnit && wantUnit !== currentUnit) ||
                    parentNeedsFix ||
                    coefNeedsFix ||
                    startNeedsFix;

                if (needUpdate) {
                    try {
                        const updated = await patchReference(
                            existing.id,
                            {
                                name: wantDisplayName || currentName,
                                article: row.article,
                                typeReference: TypeReference.TMZ,
                                ...(groupId ? { parentId: groupId } : {}),
                                isFolder: false,
                                refValues: buildOsRefValues(
                                    existing.refValues,
                                    wantShortName || currentShortName,
                                    wantUnit || currentUnit,
                                    wantCoef,
                                ),
                            },
                            token,
                            pacing,
                        );
                        if (updated) {
                            result.updatedOs += 1;
                            const idx = refsLocal.findIndex((r) => r.id === updated.id);
                            if (idx >= 0) refsLocal[idx] = updated;
                        }
                    } catch (err: any) {
                        const msg =
                            err?.response?.data?.message || err?.message || 'Ошибка обновления ОС';
                        result.errors.push(`ОС ${row.article}: ${msg}`);
                    }
                }
            } else {
                try {
                    const created = await createReference(
                        {
                            name: osDisplayName(row.shortName),
                            article: row.article,
                            typeReference: TypeReference.TMZ,
                            ...(groupId ? { parentId: groupId } : {}),
                            isFolder: false,
                            enterpriseId: null,
                            refValues: buildOsRefValues(undefined, row.shortName, wantUnit, wantCoef),
                        },
                        token,
                        pacing,
                    );
                    if (created?.id) {
                        analiticId = created.id;
                        refsLocal.push(created);
                        result.createdOs += 1;
                    }
                } catch (err: any) {
                    if (err?.response?.status === 409) {
                        const found = await tryResolveByArticleOn409(row.article);
                        if (found?.id && !found.isFolder) {
                            analiticId = found.id;
                            existing = found;
                        } else {
                            throw err;
                        }
                    } else {
                        throw err;
                    }
                }
            }

            if (!analiticId) {
                recordOsSkip(
                    result,
                    row,
                    existing?.isFolder
                        ? 'В справочнике уже есть папка с этим артикулом'
                        : 'Не удалось создать или найти позицию ОС в справочнике',
                );
                continue;
            }

            const count = 1;
            const price = row.price;
            if (!price) {
                recordOsSkip(result, row, 'Нархи = 0 — строка в документ не добавлена');
                continue;
            }

            const lineTotal = Math.round(count * price * 100) / 100;
            result.newItems.push({
                analiticId,
                count,
                price,
                total: lineTotal,
                balance: 0,
                costPrice: 0,
                costTotal: 0,
            });
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Ошибка строки';
            const line = `Строка ${row.article || row.shortName}: ${msg}`;
            result.errors.push(line);
            recordOsSkip(result, row, msg);
        } finally {
            processed += 1;
            if (onProgress) onProgress(processed, total);
        }
    }

    return result;
}
