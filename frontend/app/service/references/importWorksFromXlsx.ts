import { read, utils } from 'xlsx';
import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import {
    ReferenceModel,
    TypeReference,
    TypeSECTION,
} from '@/app/interfaces/reference.interface';
import { normaMatchesAt3Decimals, roundNorma } from '@/app/utils/norma';

export interface ParsedWorksListRow {
    article: string;
    name: string;
    norma: number;
    unit: string;
}

export interface ImportWorksResult {
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
    errors: string[];
}

export interface ImportWorksOptions {
    file: File;
    token: string;
    allReferences: ReferenceModel[];
    enterpriseId: number | null;
    onProgress?: (processed: number, total: number) => void;
    requestDelayMs?: number;
    maxRetriesOn429?: number;
}

const HEADER_KEYS = {
    article: 'Артикул операции',
    name: 'Наименование операции',
    norma: 'Норма выработки',
    unit: 'Единица измерения',
} as const;

type WorksHeaderKey = keyof typeof HEADER_KEYS;
type WorksCols = Record<WorksHeaderKey, number>;

function normalizeHeader(h: string): string {
    return h.trim().toLowerCase();
}

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

function findWorksHeaderColumns(matrix: unknown[][]): {
    headerIdx: number;
    cols: WorksCols;
} | null {
    for (let i = 0; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        const headers = row.map(cellStr);
        const normalized = headers.map(normalizeHeader);

        const findIncludes = (needle: string): number =>
            normalized.findIndex((h) => h.includes(needle.toLowerCase()));

        const cols: WorksCols = {
            article: findIncludes(HEADER_KEYS.article),
            name: findIncludes(HEADER_KEYS.name),
            norma: findIncludes(HEADER_KEYS.norma),
            unit: findIncludes(HEADER_KEYS.unit),
        };

        if (cols.article >= 0 && cols.name >= 0 && cols.norma >= 0) {
            return { headerIdx: i, cols };
        }
    }
    return null;
}

export async function parseWorksListXlsx(file: File): Promise<ParsedWorksListRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) {
        throw new Error('В файле нет листов');
    }
    const ws = wb.Sheets[firstSheet];
    const matrix = utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

    const found = findWorksHeaderColumns(matrix);
    if (!found) {
        throw new Error(
            'Не найдена строка заголовка с колонками: Артикул операции, Наименование операции, Норма выработки',
        );
    }
    const { headerIdx, cols } = found;

    const out: ParsedWorksListRow[] = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const article = cellStr(row[cols.article]);
        const name = cellStr(row[cols.name]);
        if (!article || !name) continue;

        out.push({
            article,
            name,
            norma: roundNorma(cellNum(row[cols.norma])),
            unit: cols.unit >= 0 ? cellStr(row[cols.unit]) : '',
        });
    }

    return out;
}

/** G006-032 → первые 4 символа G006 → код цеха 006 */
export function extractDeptCodeFromWorkArticle(article: string): string | null {
    const prefix = article.trim().slice(0, 4);
    const m = prefix.match(/^G(\d{3})$/i);
    return m ? m[1] : null;
}

function isProductionDept(ref: ReferenceModel): boolean {
    return (
        ref.typeReference === TypeReference.STORAGES &&
        !ref.isFolder &&
        ref.refValues?.typeSection === TypeSECTION.PRODUCTION &&
        !ref.refValues?.markToDeleted
    );
}

function findProductionDeptByArticle(
    refs: ReferenceModel[],
    code: string,
    workEnterpriseId: number | null | undefined,
): ReferenceModel | undefined {
    const target = code.trim();
    if (!target) return undefined;

    const matches = refs.filter(
        (r) => isProductionDept(r) && (r.article || '').trim() === target,
    );

    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];

    if (workEnterpriseId != null) {
        const sameEnterprise = matches.filter((r) => r.enterpriseId === workEnterpriseId);
        if (sameEnterprise.length === 1) return sameEnterprise[0];
    }

    return undefined;
}

interface DeptResolveResult {
    workDeptId?: number;
    /** Предупреждение — импорт работы продолжается без цеха */
    warning?: string;
}

function resolveWorkDeptId(
    refs: ReferenceModel[],
    row: ParsedWorksListRow,
    enterpriseId: number | null,
): DeptResolveResult {
    const deptCode = extractDeptCodeFromWorkArticle(row.article);
    if (!deptCode) {
        return {
            warning: `${row.article}: не удалось извлечь код цеха из артикула (ожидается G###-...), цех не назначен`,
        };
    }

    const dept = findProductionDeptByArticle(refs, deptCode, enterpriseId);
    if (!dept?.id) {
        const ambiguous = refs.filter(
            (r) => isProductionDept(r) && (r.article || '').trim() === deptCode,
        );
        if (ambiguous.length > 1) {
            return {
                warning: `${row.article}: неоднозначный артикул цеха "${deptCode}" (${ambiguous.length} совпадений), цех не назначен`,
            };
        }
        return {
            warning: `${row.article}: цех не найден по коду "${deptCode}", цех не назначен`,
        };
    }

    return { workDeptId: dept.id };
}

function normalizeArticleKey(article: string): string {
    return article.trim();
}

function findWorksByArticle(
    refs: ReferenceModel[],
    article: string,
    enterpriseId: number | null,
): ReferenceModel | undefined {
    const target = normalizeArticleKey(article);
    if (!target) return undefined;

    const matches = refs.filter(
        (r) =>
            r.typeReference === TypeReference.WORKS &&
            !r.isFolder &&
            !r.refValues?.markToDeleted &&
            normalizeArticleKey(r.article || '') === target &&
            (enterpriseId == null || r.enterpriseId === enterpriseId || r.enterpriseId == null),
    );

    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];

    if (enterpriseId != null) {
        const sameEnterprise = matches.filter((r) => r.enterpriseId === enterpriseId);
        if (sameEnterprise.length === 1) return sameEnterprise[0];
    }

    return matches[0];
}

function worksNeedsUpdate(
    existing: ReferenceModel,
    row: ParsedWorksListRow,
    workDeptId: number | undefined,
): boolean {
    const rv = existing.refValues || {};
    const prevName = (existing.name || '').trim();
    const prevNorma = Number(rv.norma ?? 0);
    const prevUnit = (rv.unit ?? '').trim();
    const prevDept = rv.workDeptId ?? null;

    const nextName = row.name.trim();
    const nextNorma = row.norma;
    const nextUnit = row.unit.trim();

    if (nextName && nextName !== prevName) return true;
    if (!normaMatchesAt3Decimals(prevNorma, nextNorma)) return true;
    if (nextUnit && nextUnit !== prevUnit) return true;
    if (workDeptId != null && prevDept !== workDeptId) return true;

    return false;
}

function buildWorksRefValuesPayload(
    row: ParsedWorksListRow,
    workDeptId: number | undefined,
): ReferenceModel['refValues'] {
    return {
        norma: row.norma,
        unit: row.unit || undefined,
        ...(workDeptId != null ? { workDeptId } : {}),
    };
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

function getRetryAfterMs(err: unknown): number {
    const anyErr = err as { response?: { headers?: Record<string, string> } };
    const headerVal =
        anyErr?.response?.headers?.['retry-after'] ??
        anyErr?.response?.headers?.['Retry-After'];
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
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status !== 429 || attempt >= state.maxRetriesOn429) {
                throw err;
            }
            const retryAfter = getRetryAfterMs(err);
            const backoff =
                retryAfter > 0 ? retryAfter : Math.min(15000, 1000 * Math.pow(2, attempt));
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

export function formatWorksImportMessage(
    result: ImportWorksResult,
    maxErrorLines = 50,
): string {
    const lines: string[] = [
        `Импорт работ: создано ${result.created}; обновлено ${result.updated}; без изменений ${result.unchanged}${result.skipped ? `; пропущено ${result.skipped}` : ''}`,
    ];

    if (result.errors.length > 0) {
        lines.push('', 'Предупреждения и ошибки:');
        const shown = result.errors.slice(0, maxErrorLines);
        for (const err of shown) {
            lines.push(`• ${err}`);
        }
        if (result.errors.length > maxErrorLines) {
            lines.push(`… и ещё ${result.errors.length - maxErrorLines}`);
        }
    }

    return lines.join('\n');
}

export async function importWorksFromXlsx({
    file,
    token,
    allReferences,
    enterpriseId,
    onProgress,
    requestDelayMs,
    maxRetriesOn429,
}: ImportWorksOptions): Promise<ImportWorksResult> {
    const rows = await parseWorksListXlsx(file);

    const result: ImportWorksResult = {
        created: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        errors: [],
    };

    if (rows.length === 0) {
        throw new Error('В файле нет строк для импорта');
    }

    const pacing: RequestPacingState = {
        delayMs: requestDelayMs ?? 220,
        maxRetriesOn429: maxRetriesOn429 ?? 5,
        lastCallAt: 0,
    };

    let refsLocal = [...allReferences];
    let processed = 0;
    const total = rows.length;

    for (const row of rows) {
        try {
            const deptResolved = resolveWorkDeptId(refsLocal, row, enterpriseId);
            if (deptResolved.warning) {
                result.errors.push(deptResolved.warning);
            }
            const workDeptId = deptResolved.workDeptId;

            let existing = findWorksByArticle(refsLocal, row.article, enterpriseId);

            const refValuesPayload = buildWorksRefValuesPayload(row, workDeptId);

            if (existing?.id) {
                if (!worksNeedsUpdate(existing, row, workDeptId)) {
                    result.unchanged += 1;
                    continue;
                }

                const updated = await patchReference(
                    existing.id,
                    {
                        name: row.name.trim(),
                        article: row.article.trim(),
                        typeReference: TypeReference.WORKS,
                        isFolder: false,
                        refValues: {
                            ...(existing.refValues || {}),
                            ...refValuesPayload,
                        },
                    },
                    token,
                    pacing,
                );
                const idx = refsLocal.findIndex((r) => r.id === updated.id);
                if (idx >= 0) refsLocal[idx] = updated;
                else refsLocal.push(updated);
                result.updated += 1;
            } else {
                try {
                    const created = await createReference(
                        {
                            name: row.name.trim(),
                            article: row.article.trim(),
                            typeReference: TypeReference.WORKS,
                            parentId: null,
                            isFolder: false,
                            enterpriseId,
                            refValues: refValuesPayload,
                        },
                        token,
                        pacing,
                    );
                    if (created?.id) {
                        refsLocal.push(created);
                        result.created += 1;
                    }
                } catch (err: unknown) {
                    const status = (err as { response?: { status?: number } })?.response?.status;
                    if (status === 409) {
                        existing = findWorksByArticle(refsLocal, row.article, enterpriseId);
                        if (existing?.id && worksNeedsUpdate(existing, row, workDeptId)) {
                            const updated = await patchReference(
                                existing.id,
                                {
                                    name: row.name.trim(),
                                    article: row.article.trim(),
                                    typeReference: TypeReference.WORKS,
                                    isFolder: false,
                                    refValues: {
                                        ...(existing.refValues || {}),
                                        ...refValuesPayload,
                                    },
                                },
                                token,
                                pacing,
                            );
                            const idx = refsLocal.findIndex((r) => r.id === updated.id);
                            if (idx >= 0) refsLocal[idx] = updated;
                            else refsLocal.push(updated);
                            result.updated += 1;
                        } else if (existing?.id) {
                            result.unchanged += 1;
                        } else {
                            throw err;
                        }
                    } else {
                        throw err;
                    }
                }
            }
        } catch (err: unknown) {
            const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
            const msg =
                anyErr?.response?.data?.message || anyErr?.message || 'Ошибка строки';
            result.errors.push(`${row.article}: ${msg}`);
            result.skipped += 1;
        } finally {
            processed += 1;
            if (onProgress) onProgress(processed, total);
        }
    }

    return result;
}
