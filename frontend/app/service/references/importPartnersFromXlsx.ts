import { read, utils } from 'xlsx';
import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import {
    ReferenceModel,
    TypePartners,
    TypeReference,
} from '@/app/interfaces/reference.interface';
import { formatDateForInput } from '@/app/utils/dateInput';

export interface ParsedPartnerRow {
    name: string;
    inn: string;
    phone: string;
    passportSeries: string;
    passportNumber: string;
    passportIssuedBy: string;
    passportIssueDate: string;
    address: string;
    isLegalEntity: boolean;
    isIndividualPerson: boolean;
}

export interface ImportPartnersResult {
    created: number;
    skipped: number;
    errors: string[];
}

export interface ImportPartnersOptions {
    file: File;
    token: string;
    allReferences: ReferenceModel[];
    parentId: number;
    onProgress?: (processed: number, total: number) => void;
    requestDelayMs?: number;
    maxRetriesOn429?: number;
}

const HEADER_KEYS = {
    name: 'наименование',
    fullName: 'полное наименование',
    inn: 'инн',
    phone: 'телефоны',
    passportSeries: 'серия паспорта',
    passportNumber: 'номер паспорта',
    passportIssuedBy: 'кем выдан',
    passportIssueDate: 'дата выдачи',
    address: 'адрес',
} as const;

type PartnerHeaderKey = keyof typeof HEADER_KEYS;
type PartnerCols = Partial<Record<PartnerHeaderKey, number>>;

const LEGAL_NAME_RE = /\b(mchj|xk|ooo|ооо|чп|llc|яатт|ok)\b/i;

function normalizeHeader(h: string): string {
    return h.trim().toLowerCase().replace(/\s+/g, ' ');
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

function findPartnerHeaderColumns(matrix: unknown[][]): {
    headerIdx: number;
    cols: PartnerCols;
} | null {
    for (let i = 0; i < Math.min(20, matrix.length); i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        const headers = row.map(cellStr);
        const normalized = headers.map(normalizeHeader);

        const cols: PartnerCols = {};
        for (const key of Object.keys(HEADER_KEYS) as PartnerHeaderKey[]) {
            const needle = HEADER_KEYS[key];
            let idx = normalized.findIndex((h) => h === needle);
            if (idx < 0 && key !== 'name') {
                idx = normalized.findIndex((h) => h.includes(needle));
            }
            if (idx < 0 && key === 'name') {
                // exact «наименование», not «полное наименование»
                idx = normalized.findIndex((h) => h === 'наименование');
            }
            if (idx >= 0) cols[key] = idx;
        }

        if (cols.name != null && (cols.phone != null || cols.passportSeries != null || cols.address != null)) {
            return { headerIdx: i, cols };
        }
    }
    return null;
}

/** DD.MM.YYYY or Excel serial → YYYY-MM-DD */
function parseIssueDate(raw: string): string | undefined {
    const s = raw.trim();
    if (!s) return undefined;

    const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
    if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        return `${yyyy}-${mm}-${dd}`;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    const asNum = Number(s.replace(',', '.'));
    if (Number.isFinite(asNum) && asNum > 20000 && asNum < 80000) {
        // Excel serial date
        const utc = Math.round((asNum - 25569) * 86400 * 1000);
        const d = new Date(utc);
        if (!Number.isNaN(d.getTime())) {
            return formatDateForInput(d.getTime());
        }
    }

    return undefined;
}

function looksLikeLegalName(name: string): boolean {
    return LEGAL_NAME_RE.test(name) || /["«].*MCHJ/i.test(name);
}

function decidePersonType(row: {
    name: string;
    inn: string;
    passportSeries: string;
    passportNumber: string;
}): { isLegalEntity: boolean; isIndividualPerson: boolean } {
    const hasPassport = Boolean(row.passportSeries || row.passportNumber);
    if (looksLikeLegalName(row.name) || (row.inn && !hasPassport)) {
        return { isLegalEntity: true, isIndividualPerson: false };
    }
    return { isLegalEntity: false, isIndividualPerson: true };
}

function isFolderLikeRow(row: ParsedPartnerRow, name: string): boolean {
    if (name === 'Жисмоний шахслар') return true;
    const emptyContact =
        !row.inn &&
        !row.phone &&
        !row.passportSeries &&
        !row.passportNumber &&
        !row.address;
    return emptyContact && name.length > 0 && name.length < 40 && !/\d{2}\s*\d{3}/.test(name);
}

function buildValidPassportFields(row: ParsedPartnerRow): {
    passportSeries?: string;
    passportNumber?: string;
    passportIssueDate?: string;
    passportIssuedBy?: string;
    warning?: string;
} {
    if (!row.isIndividualPerson) return {};

    const series = row.passportSeries.toUpperCase().replace(/[^A-Z]/g, '');
    const number = row.passportNumber.replace(/\D/g, '');
    const issuedBy = row.passportIssuedBy.trim();
    const issueDate = parseIssueDate(row.passportIssueDate);

    const hasAny =
        Boolean(row.passportSeries) ||
        Boolean(row.passportNumber) ||
        Boolean(row.passportIssuedBy) ||
        Boolean(row.passportIssueDate);

    if (!hasAny) return {};

    const seriesOk = /^[A-Z]{2}$/.test(series);
    const numberOk = /^\d{7}$/.test(number);
    const issuedByOk = issuedBy.length >= 3 && issuedBy.length <= 500;
    const dateOk = Boolean(issueDate);

    if (seriesOk && numberOk && issuedByOk && dateOk) {
        return {
            passportSeries: series,
            passportNumber: number,
            passportIssueDate: issueDate,
            passportIssuedBy: issuedBy,
        };
    }

    return {
        warning: `${row.name}: паспорт неполный/невалидный — пропущен`,
    };
}

export async function parsePartnersListXlsx(file: File): Promise<ParsedPartnerRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error('В файле нет листов');
    const sheet = wb.Sheets[sheetName];
    const matrix = utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        raw: false,
    }) as unknown[][];

    const found = findPartnerHeaderColumns(matrix);
    if (!found) {
        throw new Error(
            'Не найдена строка заголовков (ожидаются: Наименование, Телефоны/Паспорт/Адрес)',
        );
    }

    const { headerIdx, cols } = found;
    const rows: ParsedPartnerRow[] = [];

    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const nameRaw = cols.name != null ? cellStr(row[cols.name]) : '';
        const fullName = cols.fullName != null ? cellStr(row[cols.fullName]) : '';
        const name = (nameRaw || fullName).trim();
        if (!name) continue;

        const inn = cols.inn != null ? cellStr(row[cols.inn]).replace(/\s+/g, '') : '';
        const phone = cols.phone != null ? cellStr(row[cols.phone]) : '';
        const passportSeries = cols.passportSeries != null ? cellStr(row[cols.passportSeries]) : '';
        const passportNumber = cols.passportNumber != null ? cellStr(row[cols.passportNumber]) : '';
        const passportIssuedBy =
            cols.passportIssuedBy != null ? cellStr(row[cols.passportIssuedBy]) : '';
        const passportIssueDate =
            cols.passportIssueDate != null ? cellStr(row[cols.passportIssueDate]) : '';
        const address = cols.address != null ? cellStr(row[cols.address]) : '';

        const personType = decidePersonType({
            name,
            inn,
            passportSeries,
            passportNumber,
        });

        const parsed: ParsedPartnerRow = {
            name,
            inn,
            phone,
            passportSeries,
            passportNumber,
            passportIssuedBy,
            passportIssueDate,
            address,
            ...personType,
        };

        if (isFolderLikeRow(parsed, name)) continue;
        rows.push(parsed);
    }

    return rows;
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

const BULK_CHUNK_SIZE = 100;

export function formatPartnersImportMessage(
    result: ImportPartnersResult,
    maxErrorLines = 50,
): string {
    const lines: string[] = [
        `Импорт мижозлар: яратилди ${result.created}${result.skipped ? `; ўтказиб юборилди ${result.skipped}` : ''}`,
    ];

    if (result.errors.length > 0) {
        lines.push('', 'Огоҳлантиришлар / хатолар:');
        const shown = result.errors.slice(0, maxErrorLines);
        for (const err of shown) {
            lines.push(`• ${err}`);
        }
        if (result.errors.length > maxErrorLines) {
            lines.push(`… ва яна ${result.errors.length - maxErrorLines}`);
        }
    }

    return lines.join('\n');
}

function buildPartnerCreatePayload(row: ParsedPartnerRow, parentId: number) {
    const passport = buildValidPassportFields(row);
    const hasFullPassport = Boolean(
        passport.passportSeries &&
            passport.passportNumber &&
            passport.passportIssueDate &&
            passport.passportIssuedBy,
    );

    const refValues: Record<string, unknown> = {
        typePartners: TypePartners.CLIENTS,
        importedFromXlsx: true,
    };

    if (hasFullPassport && !row.isLegalEntity) {
        refValues.isIndividualPerson = true;
        refValues.isLegalEntity = false;
        refValues.passportSeries = passport.passportSeries;
        refValues.passportNumber = passport.passportNumber;
        refValues.passportIssueDate = passport.passportIssueDate;
        refValues.passportIssuedBy = passport.passportIssuedBy;
    }

    if (row.inn) refValues.inn = row.inn;
    if (row.phone) refValues.phone = row.phone.slice(0, 255);
    if (row.address) refValues.address = row.address.slice(0, 1000);

    return {
        payload: {
            name: row.name.slice(0, 255),
            typeReference: TypeReference.PARTNERS,
            parentId,
            isFolder: false,
            enterpriseId: null,
            refValues,
        },
        warning: passport.warning,
    };
}

interface BulkCreateResponse {
    created: number;
    skipped: number;
    errors: string[];
    items: Array<{ name: string; id?: number; error?: string }>;
}

export async function importPartnersFromXlsx({
    file,
    token,
    allReferences,
    parentId,
    onProgress,
    requestDelayMs,
    maxRetriesOn429,
}: ImportPartnersOptions): Promise<ImportPartnersResult> {
    const rows = await parsePartnersListXlsx(file);
    const result: ImportPartnersResult = {
        created: 0,
        skipped: 0,
        errors: [],
    };

    if (rows.length === 0) {
        result.errors.push('Файлда импорт қилинадиган қаторлар топилмади');
        return result;
    }

    const state: RequestPacingState = {
        delayMs: requestDelayMs ?? 0,
        maxRetriesOn429: maxRetriesOn429 ?? 5,
        lastCallAt: 0,
    };

    const knownNames = new Set(
        allReferences
            .filter(
                (r) =>
                    r.typeReference === TypeReference.PARTNERS &&
                    !r.isFolder &&
                    (r.name || '').trim(),
            )
            .map((r) => (r.name || '').trim().toLowerCase()),
    );

    const payloads: Record<string, unknown>[] = [];

    for (const row of rows) {
        const key = row.name.trim().toLowerCase();
        if (knownNames.has(key)) {
            result.skipped += 1;
            result.errors.push(`${row.name}: уже существует — пропущен`);
            continue;
        }
        knownNames.add(key);

        const built = buildPartnerCreatePayload(row, parentId);
        if (built.warning) {
            result.errors.push(built.warning);
        }
        payloads.push(built.payload);
    }

    const totalToCreate = payloads.length;
    let processed = 0;
    onProgress?.(0, Math.max(totalToCreate, 1));

    for (let offset = 0; offset < payloads.length; offset += BULK_CHUNK_SIZE) {
        const chunk = payloads.slice(offset, offset + BULK_CHUNK_SIZE);
        try {
            const bulk = await withRetryOn429(async () => {
                const res = await axios.post(
                    withApiDomain('/api/references/create-bulk'),
                    { items: chunk },
                    { headers: authHeaders(token) },
                );
                return res.data as BulkCreateResponse;
            }, state);

            result.created += bulk.created || 0;
            result.skipped += bulk.skipped || 0;
            if (Array.isArray(bulk.errors) && bulk.errors.length) {
                result.errors.push(...bulk.errors);
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string | string[] } } })?.response
                    ?.data?.message ??
                (err as Error)?.message ??
                'unknown error';
            const text = Array.isArray(msg) ? msg.join('; ') : String(msg);
            result.skipped += chunk.length;
            result.errors.push(
                `Пакет ${offset + 1}–${offset + chunk.length}: ${text}`,
            );
        }

        processed += chunk.length;
        onProgress?.(processed, Math.max(totalToCreate, 1));
    }

    return result;
}
