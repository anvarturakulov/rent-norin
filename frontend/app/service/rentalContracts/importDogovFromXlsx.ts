import { read, utils } from 'xlsx';
import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import {
    ReferenceModel,
    TypePartners,
    TypeReference,
} from '@/app/interfaces/reference.interface';
import { RentalContractStatus } from '@/app/interfaces/rentalContract.interface';
import { formatDateForInput } from '@/app/utils/dateInput';

export interface ParsedDogovRow {
    name: string;
    inn: string;
    phone: string;
    passportSeries: string;
    passportNumber: string;
    passportIssuedBy: string;
    passportIssueDate: string;
    address: string;
    jshshir: string;
    contractDateRaw: string;
    contractNumber: string;
    /** ms, если дата договора распарсена */
    contractDateMs?: number;
    isLegalEntity: boolean;
    isIndividualPerson: boolean;
}

export interface ImportDogovResult {
    clientsCreated: number;
    clientsReused: number;
    clientsSkipped: number;
    contractsCreated: number;
    contractsSkipped: number;
    /** Есть номер, нет/не распарсилась дата */
    contractsSkippedNoDate: number;
    /** Есть дата, нет номера */
    contractsSkippedNoNumber: number;
    errors: string[];
}

export interface ImportDogovOptions {
    file: File;
    token: string;
    allReferences: ReferenceModel[];
    parentId: number;
    enterpriseId: number | null;
    onProgress?: (phase: 'clients' | 'contracts', done: number, total: number) => void;
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
    contractDate: 'дата дог',
    contractNumber: 'номер дог',
    jshshir: 'жшр',
} as const;

type HeaderKey = keyof typeof HEADER_KEYS;
type Cols = Partial<Record<HeaderKey, number>>;

const LEGAL_NAME_RE = /\b(mchj|xk|ooo|ооо|чп|llc|яатт|ok)\b/i;
const BULK_CHUNK = 100;

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

function findHeaderColumns(matrix: unknown[][]): { headerIdx: number; cols: Cols } | null {
    for (let i = 0; i < Math.min(20, matrix.length); i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        const normalized = row.map((c) => normalizeHeader(cellStr(c)));

        const cols: Cols = {};
        for (const key of Object.keys(HEADER_KEYS) as HeaderKey[]) {
            const needle = HEADER_KEYS[key];
            let idx = normalized.findIndex((h) => h === needle);
            if (idx < 0 && key === 'name') {
                idx = normalized.findIndex((h) => h === 'наименование');
            } else if (idx < 0 && key === 'jshshir') {
                // «ЖШР» / «ЖШШИР», не «ШИЖР»
                idx = normalized.findIndex(
                    (h) => (h === 'жшр' || h === 'жшшир' || h.includes('жшшир')) && !h.includes('шижр'),
                );
            } else if (idx < 0 && key !== 'name') {
                idx = normalized.findIndex((h) => h.includes(needle));
            }
            if (idx >= 0) cols[key] = idx;
        }

        if (
            cols.name != null &&
            (cols.contractDate != null || cols.phone != null || cols.address != null)
        ) {
            return { headerIdx: i, cols };
        }
    }
    return null;
}

/** DD.MM.YYYY / DD,MM,YYYY / Excel serial → YYYY-MM-DD */
function parseDateToIso(raw: string): string | undefined {
    const s = raw.trim().replace(/,/g, '.');
    if (!s) return undefined;

    const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
    if (m) {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    const asNum = Number(s.replace(',', '.'));
    if (Number.isFinite(asNum) && asNum > 20000 && asNum < 80000) {
        const utc = Math.round((asNum - 25569) * 86400 * 1000);
        const d = new Date(utc);
        if (!Number.isNaN(d.getTime())) return formatDateForInput(d.getTime());
    }
    return undefined;
}

function isoToLocalMs(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
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

function isFolderLikeRow(row: ParsedDogovRow): boolean {
    if (row.name === 'Жисмоний шахслар') return true;
    const empty =
        !row.inn &&
        !row.phone &&
        !row.passportSeries &&
        !row.passportNumber &&
        !row.address &&
        !row.jshshir &&
        !row.contractNumber;
    return empty && row.name.length > 0 && row.name.length < 40 && !/\d{2}\s*\d{3}/.test(row.name);
}

function buildValidPassport(row: ParsedDogovRow): {
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
    const issueDate = parseDateToIso(row.passportIssueDate);

    const hasAny =
        Boolean(row.passportSeries) ||
        Boolean(row.passportNumber) ||
        Boolean(row.passportIssuedBy) ||
        Boolean(row.passportIssueDate);
    if (!hasAny) return {};

    if (
        /^[A-Z]{2}$/.test(series) &&
        /^\d{7}$/.test(number) &&
        issuedBy.length >= 3 &&
        issuedBy.length <= 500 &&
        issueDate
    ) {
        return {
            passportSeries: series,
            passportNumber: number,
            passportIssueDate: issueDate,
            passportIssuedBy: issuedBy,
        };
    }
    return { warning: `${row.name}: паспорт неполный/невалидный — пропущен` };
}

function normalizeJshshir(raw: string): { value?: string; warning?: string } {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return {};
    if (/^\d{14}$/.test(digits)) return { value: digits };
    return { warning: `ЖШР «${raw}» — не 14 цифр, пропущен` };
}

export async function parseDogovXlsx(file: File): Promise<ParsedDogovRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error('В файле нет листов');
    const matrix = utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1,
        defval: null,
        raw: false,
    }) as unknown[][];

    const found = findHeaderColumns(matrix);
    if (!found) {
        throw new Error(
            'Не найдена строка заголовков (ожидаются: Наименование, Дата дог / Телефоны / Адрес)',
        );
    }

    const { headerIdx, cols } = found;
    const rows: ParsedDogovRow[] = [];

    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const nameRaw = cols.name != null ? cellStr(row[cols.name]) : '';
        const fullName = cols.fullName != null ? cellStr(row[cols.fullName]) : '';
        const name = (nameRaw || fullName).trim();
        if (!name) continue;

        const inn = cols.inn != null ? cellStr(row[cols.inn]).replace(/\s+/g, '') : '';
        const phone = cols.phone != null ? cellStr(row[cols.phone]) : '';
        const passportSeries =
            cols.passportSeries != null ? cellStr(row[cols.passportSeries]) : '';
        const passportNumber =
            cols.passportNumber != null ? cellStr(row[cols.passportNumber]) : '';
        const passportIssuedBy =
            cols.passportIssuedBy != null ? cellStr(row[cols.passportIssuedBy]) : '';
        const passportIssueDate =
            cols.passportIssueDate != null ? cellStr(row[cols.passportIssueDate]) : '';
        const address = cols.address != null ? cellStr(row[cols.address]) : '';
        const jshshir = cols.jshshir != null ? cellStr(row[cols.jshshir]) : '';
        const contractDateRaw =
            cols.contractDate != null ? cellStr(row[cols.contractDate]) : '';
        const contractNumber =
            cols.contractNumber != null ? cellStr(row[cols.contractNumber]) : '';

        const personType = decidePersonType({
            name,
            inn,
            passportSeries,
            passportNumber,
        });

        const contractIso = parseDateToIso(contractDateRaw);
        const parsed: ParsedDogovRow = {
            name,
            inn,
            phone,
            passportSeries,
            passportNumber,
            passportIssuedBy,
            passportIssueDate,
            address,
            jshshir,
            contractDateRaw,
            contractNumber,
            contractDateMs: contractIso ? isoToLocalMs(contractIso) : undefined,
            ...personType,
        };

        if (isFolderLikeRow(parsed)) continue;
        rows.push(parsed);
    }

    return rows;
}

const authHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
});

function buildClientPayload(row: ParsedDogovRow, parentId: number, errors: string[]) {
    const passport = buildValidPassport(row);
    if (passport.warning) errors.push(passport.warning);

    const jsh = normalizeJshshir(row.jshshir);
    if (jsh.warning) errors.push(`${row.name}: ${jsh.warning}`);

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

    // ЖШР из колонки «ЖШР» → refValues.jshshir; при наличии ЖШР/паспорта — физлицо
    // (иначе поле ЖШШИР в карточке скрыто за isIndividualPerson)
    if (!row.isLegalEntity && (hasFullPassport || Boolean(jsh.value))) {
        refValues.isIndividualPerson = true;
        refValues.isLegalEntity = false;
    }

    if (hasFullPassport && !row.isLegalEntity) {
        refValues.passportSeries = passport.passportSeries;
        refValues.passportNumber = passport.passportNumber;
        refValues.passportIssueDate = passport.passportIssueDate;
        refValues.passportIssuedBy = passport.passportIssuedBy;
    }

    if (jsh.value) {
        refValues.jshshir = jsh.value;
    }
    if (row.inn) refValues.inn = row.inn;
    if (row.phone) refValues.phone = row.phone.slice(0, 255);
    if (row.address) refValues.address = row.address.slice(0, 1000);

    return {
        name: row.name.slice(0, 255),
        typeReference: TypeReference.PARTNERS,
        parentId,
        isFolder: false,
        enterpriseId: null,
        refValues,
    };
}

interface BulkRefResponse {
    created: number;
    skipped: number;
    errors: string[];
    items: Array<{ name: string; id?: number; error?: string }>;
}

interface BulkContractResponse {
    created: number;
    skipped: number;
    errors: string[];
}

export function formatDogovImportMessage(
    result: ImportDogovResult,
    maxErrorLines = 40,
): string {
    const skipParts: string[] = [];
    if (result.contractsSkipped) skipParts.push(`ўтказиб юборилди ${result.contractsSkipped}`);
    if (result.contractsSkippedNoDate) {
        skipParts.push(`санасиз/нотус сана ${result.contractsSkippedNoDate}`);
    }
    if (result.contractsSkippedNoNumber) {
        skipParts.push(`рақамсиз ${result.contractsSkippedNoNumber}`);
    }

    const lines = [
        `Мижозлар: яратилди ${result.clientsCreated}, қайта ишлатилди ${result.clientsReused}${result.clientsSkipped ? `, ўтказиб юборилди ${result.clientsSkipped}` : ''}`,
        `Шартномалар: яратилди ${result.contractsCreated}${skipParts.length ? `; ${skipParts.join(', ')}` : ''}`,
    ];
    if (result.errors.length) {
        lines.push('', 'Огоҳлантиришлар / хатолар:');
        for (const err of result.errors.slice(0, maxErrorLines)) {
            lines.push(`• ${err}`);
        }
        if (result.errors.length > maxErrorLines) {
            lines.push(`… ва яна ${result.errors.length - maxErrorLines}`);
        }
    }
    return lines.join('\n');
}

export async function importDogovFromXlsx({
    file,
    token,
    allReferences,
    parentId,
    enterpriseId,
    onProgress,
}: ImportDogovOptions): Promise<ImportDogovResult> {
    const rows = await parseDogovXlsx(file);
    const result: ImportDogovResult = {
        clientsCreated: 0,
        clientsReused: 0,
        clientsSkipped: 0,
        contractsCreated: 0,
        contractsSkipped: 0,
        contractsSkippedNoDate: 0,
        contractsSkippedNoNumber: 0,
        errors: [],
    };

    if (!rows.length) {
        result.errors.push('Файлда импорт қилинадиган қаторлар топилмади');
        return result;
    }

    const nameToId = new Map<string, number>();
    for (const r of allReferences) {
        if (
            r.typeReference === TypeReference.PARTNERS &&
            !r.isFolder &&
            r.id != null &&
            (r.name || '').trim()
        ) {
            nameToId.set((r.name || '').trim().toLowerCase(), r.id);
        }
    }

    const toCreate: { row: ParsedDogovRow; payload: Record<string, unknown> }[] = [];
    const existingForJshshir: { id: number; row: ParsedDogovRow }[] = [];

    for (const row of rows) {
        const key = row.name.trim().toLowerCase();
        const existingId = nameToId.get(key);
        if (existingId != null) {
            result.clientsReused += 1;
            const existing = allReferences.find((r) => r.id === existingId);
            const jsh = normalizeJshshir(row.jshshir);
            if (jsh.warning) result.errors.push(`${row.name}: ${jsh.warning}`);
            const existingJsh = (existing?.refValues?.jshshir || '').replace(/\D/g, '');
            // дописать/обновить ЖШР из файла, если в карточке пусто или другое
            if (jsh.value && existingJsh !== jsh.value) {
                existingForJshshir.push({ id: existingId, row });
            }
            continue;
        }
        if ([...toCreate].some((x) => x.row.name.trim().toLowerCase() === key)) {
            result.clientsSkipped += 1;
            result.errors.push(`${row.name}: дубликат в файле — пропущен`);
            continue;
        }
        const payload = buildClientPayload(row, parentId, result.errors);
        toCreate.push({ row, payload });
        // placeholder so later duplicates in file are skipped
        nameToId.set(key, -1);
    }

    // patch jshshir on existing (колонка ЖШР → refValues.jshshir + физлицо)
    for (const item of existingForJshshir) {
        const jsh = normalizeJshshir(item.row.jshshir);
        if (!jsh.value) continue;
        const passport = buildValidPassport(item.row);
        const hasFullPassport = Boolean(
            passport.passportSeries &&
                passport.passportNumber &&
                passport.passportIssueDate &&
                passport.passportIssuedBy,
        );
        const refValues: Record<string, unknown> = {
            jshshir: jsh.value,
            isIndividualPerson: true,
            isLegalEntity: false,
            typePartners: TypePartners.CLIENTS,
        };
        if (hasFullPassport) {
            refValues.passportSeries = passport.passportSeries;
            refValues.passportNumber = passport.passportNumber;
            refValues.passportIssueDate = passport.passportIssueDate;
            refValues.passportIssuedBy = passport.passportIssuedBy;
        }
        try {
            await axios.patch(
                withApiDomain(`/api/references/${item.id}`),
                {
                    name: item.row.name.slice(0, 255),
                    typeReference: TypeReference.PARTNERS,
                    isFolder: false,
                    refValues,
                },
                { headers: authHeaders(token) },
            );
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string | string[] } } })?.response
                    ?.data?.message ?? (err as Error)?.message ?? 'patch error';
            result.errors.push(
                `${item.row.name}: ЖШР янгиланмади — ${Array.isArray(msg) ? msg.join('; ') : msg}`,
            );
        }
    }

    onProgress?.('clients', 0, Math.max(toCreate.length, 1));

    for (let offset = 0; offset < toCreate.length; offset += BULK_CHUNK) {
        const chunk = toCreate.slice(offset, offset + BULK_CHUNK);
        try {
            const res = await axios.post(
                withApiDomain('/api/references/create-bulk'),
                { items: chunk.map((c) => c.payload) },
                { headers: authHeaders(token) },
            );
            const bulk = res.data as BulkRefResponse;
            result.clientsCreated += bulk.created || 0;
            result.clientsSkipped += bulk.skipped || 0;
            if (bulk.errors?.length) result.errors.push(...bulk.errors);
            for (const item of bulk.items || []) {
                if (item.id != null && item.name) {
                    nameToId.set(item.name.trim().toLowerCase(), item.id);
                }
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string | string[] } } })?.response
                    ?.data?.message ?? (err as Error)?.message ?? 'unknown';
            const text = Array.isArray(msg) ? msg.join('; ') : String(msg);
            result.clientsSkipped += chunk.length;
            result.errors.push(
                `Клиенты пакет ${offset + 1}–${offset + chunk.length}: ${text}`,
            );
        }
        onProgress?.('clients', Math.min(offset + chunk.length, toCreate.length), Math.max(toCreate.length, 1));
    }

    // Resolve ids for reused (already in map) and newly created
    const contractItems: Record<string, unknown>[] = [];
    const usedNumbers = new Set<string>();

    for (const row of rows) {
        const hasNumber = Boolean(row.contractNumber);
        const hasDate = row.contractDateMs != null;

        if (!hasNumber && !hasDate) {
            // только клиент — ок
            continue;
        }

        if (hasNumber && !hasDate) {
            result.contractsSkipped += 1;
            result.contractsSkippedNoDate += 1;
            const reason = `${row.name}: шартнома «${row.contractNumber}» — сана йўқ ёки нотўғри («${row.contractDateRaw || 'бўш'}»)`;
            result.errors.push(reason);
            console.warn('[Dogov import]', reason);
            continue;
        }

        if (hasDate && !hasNumber) {
            result.contractsSkipped += 1;
            result.contractsSkippedNoNumber += 1;
            const reason = `${row.name}: шартнома санаси бор, лекин рақам йўқ`;
            result.errors.push(reason);
            console.warn('[Dogov import]', reason);
            continue;
        }

        const clientId = nameToId.get(row.name.trim().toLowerCase());
        if (clientId == null || clientId < 0) {
            result.contractsSkipped += 1;
            const reason = `${row.name}: договор ${row.contractNumber} — клиент не найден`;
            result.errors.push(reason);
            console.warn('[Dogov import]', reason);
            continue;
        }

        const numKey = `${enterpriseId ?? 'null'}:${row.contractNumber}`;
        if (usedNumbers.has(numKey)) {
            result.contractsSkipped += 1;
            const reason = `${row.name}: номер договора «${row.contractNumber}» дублируется в файле — пропущен`;
            result.errors.push(reason);
            console.warn('[Dogov import]', reason);
            continue;
        }
        usedNumbers.add(numKey);

        contractItems.push({
            clientId,
            contractDate: row.contractDateMs,
            contractNumber: row.contractNumber,
            status: RentalContractStatus.APPROVED,
            enterpriseId: enterpriseId ?? null,
        });
    }

    onProgress?.('contracts', 0, Math.max(contractItems.length, 1));

    for (let offset = 0; offset < contractItems.length; offset += BULK_CHUNK) {
        const chunk = contractItems.slice(offset, offset + BULK_CHUNK);
        try {
            const res = await axios.post(
                withApiDomain('/api/rental-contracts/create-bulk'),
                { items: chunk },
                { headers: authHeaders(token) },
            );
            const bulk = res.data as BulkContractResponse;
            result.contractsCreated += bulk.created || 0;
            result.contractsSkipped += bulk.skipped || 0;
            if (bulk.errors?.length) {
                result.errors.push(...bulk.errors);
                console.warn('[Dogov import] create-bulk errors', bulk.errors);
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string | string[] } } })?.response
                    ?.data?.message ?? (err as Error)?.message ?? 'unknown';
            const text = Array.isArray(msg) ? msg.join('; ') : String(msg);
            result.contractsSkipped += chunk.length;
            const reason = `Договоры пакет ${offset + 1}–${offset + chunk.length}: ${text}`;
            result.errors.push(reason);
            console.warn('[Dogov import]', reason, err);
        }
        onProgress?.(
            'contracts',
            Math.min(offset + chunk.length, contractItems.length),
            Math.max(contractItems.length, 1),
        );
    }

    console.warn('[Dogov import] summary', {
        clientsCreated: result.clientsCreated,
        clientsReused: result.clientsReused,
        contractsCreated: result.contractsCreated,
        contractsSkipped: result.contractsSkipped,
        contractsSkippedNoDate: result.contractsSkippedNoDate,
        contractsSkippedNoNumber: result.contractsSkippedNoNumber,
        errorsCount: result.errors.length,
    });

    return result;
}
