import { read, utils } from 'xlsx';
import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import { DocTableItem } from '@/app/interfaces/document.interface';
import { ReferenceModel, TypeReference, TypeTMZ } from '@/app/interfaces/reference.interface';

export interface ParsedRemainRow {
    name: string;
    article: string;
    groupArticle: string;
    groupName: string;
    unit: string;
    count: number;
    price: number;
    firstPriceUsd: number;
}

export interface ImportRemainsResult {
    newItems: DocTableItem[];
    createdGroups: number;
    createdMaterials: number;
    updatedMaterials: number;
    createdPereodics: number;
    skipped: number;
    errors: string[];
}

export interface ImportRemainsOptions {
    file: File;
    token: string;
    allReferences: ReferenceModel[];
    onProgress?: (processed: number, total: number) => void;
    /** Минимальная пауза между запросами, мс. По умолчанию 220 (≈ 270 req/min — под лимит 300/мин). */
    requestDelayMs?: number;
    /** Максимум повторов при 429. По умолчанию 5. */
    maxRetriesOn429?: number;
}

const HEADER_KEYS = {
    name: 'Наименование',
    article: 'Артикул',
    groupArticle: 'Группа',
    groupName: 'Гурух',
    unit: 'изм.',
    count: 'Сальдо',
    price: 'Нархи',
    firstPriceUsd: 'Цена в $',
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
            groupName: find(HEADER_KEYS.groupName),
            unit: find(HEADER_KEYS.unit),
            count: find(HEADER_KEYS.count),
            price: find(HEADER_KEYS.price),
            firstPriceUsd: find(HEADER_KEYS.firstPriceUsd),
        };

        if (
            cols.name >= 0 &&
            cols.article >= 0 &&
            cols.groupArticle >= 0 &&
            cols.unit >= 0 &&
            cols.count >= 0 &&
            cols.price >= 0
        ) {
            return { headerIdx: i, cols };
        }
    }
    return null;
}

export async function parseRemainsXlsx(file: File): Promise<ParsedRemainRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) {
        throw new Error('В файле нет листов');
    }
    const ws = wb.Sheets[firstSheet];
    const matrix = utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

    const found = findHeaderColumns(matrix);
    if (!found) {
        throw new Error(
            'Не найдена строка заголовка с колонками: Наименование, Артикул, Группа, Ед. изм., Сальдо на конец периода, Нархи',
        );
    }
    const { headerIdx, cols } = found;

    const out: ParsedRemainRow[] = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const name = cellStr(row[cols.name]);
        const article = cellStr(row[cols.article]);
        if (!name || !article) continue;

        out.push({
            name,
            article,
            groupArticle: cellStr(row[cols.groupArticle]),
            groupName: cols.groupName >= 0 ? cellStr(row[cols.groupName]) : '',
            unit: cellStr(row[cols.unit]),
            count: cellNum(row[cols.count]),
            price: cellNum(row[cols.price]),
            firstPriceUsd: cols.firstPriceUsd >= 0 ? cellNum(row[cols.firstPriceUsd]) : 0,
        });
    }

    return out;
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

async function createPereodic(
    payload: { referenceId: number; date: number; name: string; value: number },
    token: string,
    state: RequestPacingState,
): Promise<void> {
    await withRetryOn429(async () => {
        await axios.post(withApiDomain('/api/pereodic/create'), payload, {
            headers: authHeaders(token),
        });
    }, state);
}

/**
 * Ищем TMZ по артикулу без фильтра по `enterpriseId`: бэкенд автоматически проставляет
 * `enterpriseId = user.enterpriseId` при создании TMZ для не-ADMINGLOBAL ролей,
 * поэтому общие материалы могут лежать как с `enterpriseId = null`, так и с конкретным id.
 * Артикул в TMZ уникален в рамках организации — этого достаточно для корректного матчинга.
 */
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

export async function importInitialMaterialsRemain({
    file,
    token,
    allReferences,
    onProgress,
    requestDelayMs,
    maxRetriesOn429,
}: ImportRemainsOptions): Promise<ImportRemainsResult> {
    const rows = await parseRemainsXlsx(file);

    const result: ImportRemainsResult = {
        newItems: [],
        createdGroups: 0,
        createdMaterials: 0,
        updatedMaterials: 0,
        createdPereodics: 0,
        skipped: 0,
        errors: [],
    };

    const pacing: RequestPacingState = {
        delayMs: typeof requestDelayMs === 'number' && requestDelayMs >= 0 ? requestDelayMs : 220,
        maxRetriesOn429: typeof maxRetriesOn429 === 'number' && maxRetriesOn429 >= 0 ? maxRetriesOn429 : 5,
        lastCallAt: 0,
    };

    // Берём свежий снимок справочников: при повторных запусках в кэше SWR могут отсутствовать
    // только что созданные материалы, и мы попытаемся создать дубль (получим 409).
    let refsLocal: ReferenceModel[] = Array.isArray(allReferences) ? [...allReferences] : [];
    try {
        const fresh = await fetchAllReferences(token, pacing);
        if (Array.isArray(fresh) && fresh.length) refsLocal = fresh;
    } catch (err: any) {
        // Не критично: используем переданные `allReferences` как fallback
        const msg = err?.response?.data?.message || err?.message || 'Не удалось обновить справочники';
        result.errors.push(`Подгрузка справочников: ${msg}`);
    }

    /** При 409 Conflict перезагружаем справочники один раз и пытаемся найти существующий по артикулу. */
    let refsRefetchedOnConflict = false;
    const tryResolveByArticleOn409 = async (
        article: string,
    ): Promise<ReferenceModel | undefined> => {
        if (!refsRefetchedOnConflict) {
            try {
                const fresh = await fetchAllReferences(token, pacing);
                if (Array.isArray(fresh) && fresh.length) refsLocal = fresh;
            } catch {
                // ignore — попробуем по тому, что есть
            } finally {
                refsRefetchedOnConflict = true;
            }
        }
        return findTmzByArticle(refsLocal, article);
    };

    const groupNameByArticle = new Map<string, string>();
    for (const row of rows) {
        if (row.groupArticle && !groupNameByArticle.has(row.groupArticle)) {
            groupNameByArticle.set(row.groupArticle, row.groupName || row.groupArticle);
        }
    }

    const groupIdByArticle = new Map<string, number>();
    for (const [groupArticle, groupName] of groupNameByArticle.entries()) {
        try {
            const existing = findTmzByArticle(refsLocal, groupArticle);
            if (existing && existing.id) {
                groupIdByArticle.set(groupArticle, existing.id);
                continue;
            }
            try {
                const created = await createReference(
                    {
                        name: groupName,
                        article: groupArticle,
                        typeReference: TypeReference.TMZ,
                        isFolder: true,
                        enterpriseId: null,
                        refValues: { typeTMZ: TypeTMZ.MATERIAL },
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

            if (existing && existing.id && !existing.isFolder) {
                analiticId = existing.id;
                const currentName = (existing.name || '').trim();
                const currentUnit = (existing.refValues?.unit || '').trim();
                const currentParentId = existing.parentId == null ? null : existing.parentId;
                const wantName = row.name.trim();
                const wantUnit = row.unit.trim();

                const parentNeedsFix = !!groupId && currentParentId !== groupId;
                const needUpdate =
                    (wantName && wantName !== currentName) ||
                    (wantUnit && wantUnit !== currentUnit) ||
                    parentNeedsFix;

                if (needUpdate) {
                    try {
                        const updated = await patchReference(
                            existing.id,
                            {
                                name: wantName || currentName,
                                article: row.article,
                                typeReference: TypeReference.TMZ,
                                ...(groupId ? { parentId: groupId } : {}),
                                isFolder: false,
                                refValues: {
                                    ...(existing.refValues || {}),
                                    typeTMZ: TypeTMZ.MATERIAL,
                                    unit: wantUnit || currentUnit,
                                },
                            },
                            token,
                            pacing,
                        );
                        if (updated) {
                            result.updatedMaterials += 1;
                            const idx = refsLocal.findIndex((r) => r.id === updated.id);
                            if (idx >= 0) refsLocal[idx] = updated;
                        }
                    } catch (err: any) {
                        const msg =
                            err?.response?.data?.message || err?.message || 'Ошибка обновления материала';
                        result.errors.push(`Материал ${row.article}: ${msg}`);
                    }
                }
            } else {
                try {
                    const created = await createReference(
                        {
                            name: row.name,
                            article: row.article,
                            typeReference: TypeReference.TMZ,
                            ...(groupId ? { parentId: groupId } : {}),
                            isFolder: false,
                            enterpriseId: null,
                            refValues: {
                                typeTMZ: TypeTMZ.MATERIAL,
                                unit: row.unit || undefined,
                            },
                        },
                        token,
                        pacing,
                    );
                    if (created?.id) {
                        analiticId = created.id;
                        refsLocal.push(created);
                        result.createdMaterials += 1;
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
                result.skipped += 1;
                continue;
            }

            if (row.firstPriceUsd > 0) {
                try {
                    await createPereodic(
                        {
                            referenceId: analiticId,
                            date: new Date(2024, 11, 31).getTime(),
                            name: 'firstPrice',
                            value: Math.round(row.firstPriceUsd * 1000) / 1000,
                        },
                        token,
                        pacing,
                    );
                    result.createdPereodics += 1;
                } catch (err: any) {
                    const msg = err?.response?.data?.message || err?.message || 'Ошибка создания периодики';
                    result.errors.push(`Периодика firstPrice ${row.article}: ${msg}`);
                }
            }

            // Справочник создан/найден/обновлён, но если в файле нет количества или цены —
            // строку в документ не добавляем (по требованию пользователя).
            const count = row.count;
            const price = row.price;
            if (!count || !price) {
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
            result.errors.push(`Строка ${row.article || row.name}: ${msg}`);
            result.skipped += 1;
        } finally {
            processed += 1;
            if (onProgress) onProgress(processed, total);
        }
    }

    return result;
}
