import { read, utils } from 'xlsx';
import type { DraftWorkRow } from './orderWorksDraft';
import { emptyDraftRow } from './orderWorksDraft';

export interface ParsedWorkShortRow {
    workArticle: string;
    countInUnit: string;
}

const HEADER_FIRST_COL = 'Наименование операции';

const SHORT_HEADER_KEYS = {
    article: ['артикул операции', 'артикул'],
    /** Только для поиска шапки таблицы операций — значение из файла не используется */
    norma: ['норма выработки'],
    countInUnit: ['объем в изделии', 'объём в изделии'],
} as const;

type ShortWorksCols = {
    article: number;
    countInUnit: number;
};

function normalizeHeader(h: string): string {
    return h.trim().toLowerCase();
}

function findIncludesColumn(normalized: string[], needles: readonly string[]): number {
    return normalized.findIndex((h) => needles.some((needle) => h.includes(needle)));
}

/** Шапка таблицы операций: «Артикул» + «Норма выработки» (как в works.xlsx). */
function findShortWorksHeaderColumns(matrix: unknown[][]): {
    headerIdx: number;
    cols: ShortWorksCols;
} | null {
    let best: { headerIdx: number; cols: ShortWorksCols; score: number } | null = null;

    for (let i = 0; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        const normalized = row.map((cell) => normalizeHeader(cellStr(cell)));

        const articleCol = findIncludesColumn(normalized, SHORT_HEADER_KEYS.article);
        const normaCol = findIncludesColumn(normalized, SHORT_HEADER_KEYS.norma);
        const countInUnitCol = findIncludesColumn(normalized, SHORT_HEADER_KEYS.countInUnit);

        if (articleCol < 0 || normaCol < 0) continue;

        let score = 1;
        if (countInUnitCol >= 0) score += 2;
        if (normalized[0]?.includes('наименование операции')) score += 5;

        if (!best || score > best.score) {
            best = {
                headerIdx: i,
                cols: { article: articleCol, countInUnit: countInUnitCol },
                score,
            };
        }
    }

    if (!best) return null;
    return { headerIdx: best.headerIdx, cols: best.cols };
}

function parseFullWorksFormatRows(matrix: unknown[][]): ParsedWorkShortRow[] {
    let headerIdx = -1;
    for (let i = 0; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        if (cellStr(row[0]) === HEADER_FIRST_COL) {
            headerIdx = i;
            break;
        }
    }
    if (headerIdx < 0) return [];

    const out: ParsedWorkShortRow[] = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const workArticle = cellStr(row[1]);
        if (!workArticle) continue;
        const workName = cellStr(row[0]);
        if (!workName) continue;

        out.push({
            workArticle,
            countInUnit: cellNumStr(row[5]),
        });
    }
    return out;
}

function cellStr(v: unknown): string {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
    return String(v).trim();
}

function cellNumStr(v: unknown): string {
    const s = cellStr(v);
    if (s === '') return '';
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? String(n) : '';
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as ArrayBuffer);
        fr.onerror = () => reject(new Error('Файлни ўқиб бўлмади'));
        fr.readAsArrayBuffer(file);
    });
}

/**
 * Парсит Excel как в works.xlsx: строка с «Наименование операции» в колонке A — заголовок.
 * Строки-разделители (пустой артикул в B) пропускаются.
 */
export async function parseWorksXlsx(file: File): Promise<DraftWorkRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) {
        throw new Error('Файлда варақ йўқ');
    }
    const ws = wb.Sheets[firstSheet];
    const matrix = utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

    let headerIdx = -1;
    for (let i = 0; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        if (cellStr(row[0]) === HEADER_FIRST_COL) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx < 0) {
        throw new Error('Жадвал сарлавҳаси топилмади (A ўстунида «Наименование операции» кутилмоқда)');
    }

    const out: DraftWorkRow[] = [];
    let seq = 0;

    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const workName = cellStr(row[0]);
        const workArticle = cellStr(row[1]);

        if (!workArticle) continue;
        if (!workName) continue;

        const draftId = `xlsx-${Date.now()}-${seq++}`;
        const r = emptyDraftRow(draftId);

        r.workName = workName;
        r.workArticle = workArticle;
        r.unit = cellStr(row[3]);
        r.hourRate = cellNumStr(row[4]);
        r.countInUnit = cellNumStr(row[5]);
        r.countInOrder = cellNumStr(row[6]);
        r.timeInUnit = cellNumStr(row[7]);
        r.timeInOrder = cellNumStr(row[8]);
        r.salaryRate = cellNumStr(row[9]);
        r.salaryInUnit = cellNumStr(row[10]);
        r.salaryInOrder = cellNumStr(row[11]);

        r.overrides = {
            timeInUnit: true,
            timeInOrder: true,
            salaryInUnit: true,
            salaryInOrder: true,
        };

        out.push(r);
    }

    return out;
}

/**
 * Парсит Excel для импорта работ в карточку ТМЗ: Артикул и Объем в изделии.
 * Норма выработки из файла не читается — берётся из справочника WORKS.
 * Поддерживает шапку по колонкам «Артикул» + «Норма выработки» и формат works.xlsx
 * (колонка A — «Наименование операции»).
 */
export async function parseWorksShortXlsx(file: File): Promise<ParsedWorkShortRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) {
        throw new Error('Файлда варақ йўқ');
    }
    const ws = wb.Sheets[firstSheet];
    const matrix = utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

    const found = findShortWorksHeaderColumns(matrix);
    if (found) {
        const { headerIdx, cols } = found;
        const out: ParsedWorkShortRow[] = [];

        for (let i = headerIdx + 1; i < matrix.length; i++) {
            const row = matrix[i];
            if (!row) continue;

            const workArticle = cellStr(row[cols.article]);
            if (!workArticle) continue;

            out.push({
                workArticle,
                countInUnit: cols.countInUnit >= 0 ? cellNumStr(row[cols.countInUnit]) : '',
            });
        }

        if (out.length > 0) return out;
    }

    const fullFormatRows = parseFullWorksFormatRows(matrix);
    if (fullFormatRows.length > 0) return fullFormatRows;

    throw new Error(
        'Жадвал сарлавҳаси топилмади (кутилмоқда: «Артикул» + «Норма выработки» ёки A ўстунида «Наименование операции»)',
    );
}

