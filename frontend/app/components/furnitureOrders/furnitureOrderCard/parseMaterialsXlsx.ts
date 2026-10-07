import { read, utils } from 'xlsx';

export interface ParsedMaterialXlsxRow {
    article: string;
    countInOrder: string;
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

export async function parseMaterialsXlsx(file: File): Promise<ParsedMaterialXlsxRow[]> {
    const buf = await readFileAsArrayBuffer(file);
    const wb = read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) {
        throw new Error('Файлда варақ йўқ');
    }

    const ws = wb.Sheets[firstSheet];
    const matrix = utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

    let headerIdx = -1;
    let articleColIdx = -1;
    let countColIdx = -1;

    for (let i = 0; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row || row.length === 0) continue;
        const headers = row.map(cellStr);
        const articleIdx = headers.findIndex(v => v === 'Артикул');
        const qtyIdx = headers.findIndex(v => v === 'Количество в заказе');
        if (articleIdx >= 0 && qtyIdx >= 0) {
            headerIdx = i;
            articleColIdx = articleIdx;
            countColIdx = qtyIdx;
            break;
        }
    }

    if (headerIdx < 0 || articleColIdx < 0 || countColIdx < 0) {
        throw new Error('«Артикул» ва «Количество в заказе» ўстунлари топилмади');
    }

    const out: ParsedMaterialXlsxRow[] = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row) continue;

        const article = cellStr(row[articleColIdx]);
        const countInOrder = cellNumStr(row[countColIdx]);
        out.push({ article, countInOrder });
    }

    return out;
}
