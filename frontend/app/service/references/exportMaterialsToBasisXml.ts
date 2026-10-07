import {
    ReferenceModel,
    TypeTMZ,
} from '@/app/interfaces/reference.interface';
import { buildTmzDisplayName } from '@/app/utils/buildTmzDisplayName';
import { parseTmzSizeForBasis } from './parseTmzSizeForBasis';
import { formatDateForInput } from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';

export interface BasisMaterialExportRow {
    article: string;
    name: string;
    groupName: string;
    unitMeasure?: string;
    price?: number;
    length?: number;
    width?: number;
    thickness?: number;
    isTape?: 'Y' | 'N';
    typeGroupMaterial?: 1 | 2 | 3 | 4;
    comment?: string;
}

/** Порядок и состав полей как в Export_bazmat.xml (экспорт БАЗИС). */
const BASIS_MATERIAL_FIELDS = [
    'Article',
    'Name',
    'Group_Name',
    'Unit_Measure',
    'Price',
    'Coef',
    'Length',
    'Width',
    'Thickness',
    'Sign',
    'Overhang',
    'Color',
    'Texture',
    'Class',
    'IsTape',
    'Sync_External',
    'Weight',
    'Comment',
    'NoAvailable',
    'Stretch',
    'Retry',
    'Mirror',
    'Transparent',
    'Shiness',
    'Bright',
    'DX',
    'DY',
    'OffsetX',
    'OffsetY',
    'Angle',
    'Coef_Exc_Cutting',
    'Round_Mode',
    'Alt_Price',
    'Name_FNP',
    'Type_Group_Material',
    'Color_RGB',
    'Color_HEX',
] as const;

type BasisMaterialField = (typeof BASIS_MATERIAL_FIELDS)[number];

const EMPTY_SELF_CLOSING_FIELDS = new Set<BasisMaterialField>([
    'Sign',
    'Texture',
    'Sync_External',
    'Name_FNP',
    'Comment',
    'Class',
    'Article',
]);

function escapeXmlText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatBasisNumber(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return Number.isInteger(value) ? String(value) : String(value);
}

function buildBasisMaterialValues(row: BasisMaterialExportRow): Record<BasisMaterialField, string> {
    const thickness = row.thickness ?? 0;
    const sign =
        thickness > 0 && (row.isTape === 'N' || row.typeGroupMaterial === 2 || row.typeGroupMaterial === 3)
            ? formatBasisNumber(thickness)
            : '';

    return {
        Article: row.article.trim(),
        Name: row.name.trim(),
        Group_Name: row.groupName.trim() || 'Прочие',
        Unit_Measure: row.unitMeasure?.trim() || 'шт',
        Price: formatBasisNumber(row.price ?? 0),
        Coef: '1',
        Length: formatBasisNumber(row.length ?? 0),
        Width: formatBasisNumber(row.width ?? 0),
        Thickness: formatBasisNumber(thickness),
        Sign: sign,
        Overhang: '0',
        Color: '8369910',
        Texture: '',
        Class: '',
        IsTape: row.isTape ?? 'N',
        Sync_External: '',
        Weight: '0',
        Comment: row.comment?.trim() ?? '',
        NoAvailable: 'N',
        Stretch: '0',
        Retry: '0',
        Mirror: '0',
        Transparent: '0',
        Shiness: '0',
        Bright: '0',
        DX: '0',
        DY: '0',
        OffsetX: '1000',
        OffsetY: '1000',
        Angle: '0',
        Coef_Exc_Cutting: '1',
        Round_Mode: '0',
        Alt_Price: '0',
        Name_FNP: '',
        Type_Group_Material: String(row.typeGroupMaterial ?? 1),
        Color_RGB: '(246, 182, 127)',
        Color_HEX: 'F6B67F',
    };
}

function buildMaterialElement(row: BasisMaterialExportRow): string {
    const values = buildBasisMaterialValues(row);
    const parts = BASIS_MATERIAL_FIELDS.map((field) => {
        const value = values[field];
        if (!value && EMPTY_SELF_CLOSING_FIELDS.has(field)) {
            return `<${field}/>`;
        }
        return `<${field}>${escapeXmlText(value)}</${field}>`;
    });
    return `<Material>${parts.join('')}</Material>`;
}

export function buildBasisMaterialsXml(rows: BasisMaterialExportRow[]): string {
    const materials = rows.map(buildMaterialElement).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Database><Materials>${materials}</Materials></Database>\n`;
}

function resolveGroupPath(item: ReferenceModel, byId: Map<number, ReferenceModel>): string {
    const parts: string[] = [];
    let parentId =
        item.parentId === null || item.parentId === undefined || item.parentId === 0
            ? null
            : item.parentId;

    while (parentId != null) {
        const parent = byId.get(parentId);
        if (!parent) break;
        if (parent.isFolder && parent.name.trim()) {
            parts.unshift(parent.name.trim());
        }
        parentId =
            parent.parentId === null || parent.parentId === undefined || parent.parentId === 0
                ? null
                : parent.parentId;
    }

    return parts.length > 0 ? parts.join('/') : 'Прочие';
}

function inferTypeGroupMaterial(item: ReferenceModel, groupName: string): 1 | 2 | 3 | 4 {
    const haystack = `${groupName} ${item.name}`.toLowerCase();
    if (/кромк|кант|edge/i.test(haystack)) return 3;
    if (/фурнит|креп|petl|направ|евровинт|ручк|петл/i.test(haystack)) return 4;
    if (item.refValues?.isSheetMaterial) return 2;
    if (/дсп|лдсп|мдф|столеш|фанер|лист|плит/i.test(haystack)) return 2;
    return 1;
}

function buildComment(item: ReferenceModel): string | undefined {
    const parts = [
        item.refValues?.manufacture?.trim(),
        item.refValues?.color?.trim(),
        item.refValues?.comment?.trim(),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('; ') : undefined;
}

export function referenceToBasisMaterialRow(
    item: ReferenceModel,
    byId: Map<number, ReferenceModel>,
): BasisMaterialExportRow | null {
    if (item.isFolder) return null;
    if (item.refValues?.typeTMZ !== TypeTMZ.MATERIAL) return null;
    if (item.refValues?.markToDeleted) return null;

    const article = (item.article ?? '').trim();
    if (!article) return null;

    const name = (item.name ?? buildTmzDisplayName({
        shortName: item.refValues?.shortName,
        size: item.refValues?.size,
        color: item.refValues?.color,
        manufacture: item.refValues?.manufacture,
        typeTMZ: item.refValues?.typeTMZ,
    })).trim();

    if (!name) return null;

    const groupName = resolveGroupPath(item, byId);
    const parsedSize = parseTmzSizeForBasis(item.refValues?.size);
    const typeGroupMaterial = inferTypeGroupMaterial(item, groupName);
    const isSheet = Boolean(item.refValues?.isSheetMaterial) || typeGroupMaterial === 2;

    // Для листовых материалов габариты берём из отдельных числовых реквизитов
    // (Высота/Ширина), а толщину — из текстового size. Для нелистовых вся
    // геометрия по-прежнему парсится из size.
    const length = isSheet ? item.refValues?.height ?? parsedSize.length : parsedSize.length;
    const width = isSheet ? item.refValues?.width ?? parsedSize.width : parsedSize.width;
    const thickness = isSheet ? parsedSize.thickness ?? 0 : parsedSize.thickness;

    return {
        article,
        name,
        groupName,
        unitMeasure: item.refValues?.unit?.trim() || undefined,
        price: item.refValues?.firstPrice,
        length,
        width,
        thickness,
        isTape: isSheet ? 'N' : 'Y',
        typeGroupMaterial,
        comment: buildComment(item),
    };
}

export function collectBasisMaterialRows(references: ReferenceModel[]): BasisMaterialExportRow[] {
    const byId = new Map<number, ReferenceModel>();
    for (const ref of references) {
        if (ref.id != null) byId.set(ref.id, ref);
    }

    return references
        .map((item) => referenceToBasisMaterialRow(item, byId))
        .filter((row): row is BasisMaterialExportRow => row != null);
}

function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function downloadBasisMaterialsXml(content: string, filename: string): void {
    downloadFile(content, filename, 'application/xml;charset=utf-8');
}

/** Первые 2 материала из справочника в XML. */
export function exportBasisTestMaterialsXml(references: ReferenceModel[]): number {
    const rows = collectBasisMaterialRows(references).slice(0, 2);
    if (rows.length === 0) return 0;
    const xml = buildBasisMaterialsXml(rows);
    downloadBasisMaterialsXml(xml, 'basis-materials-test.xml');
    return rows.length;
}

export function exportBasisAllMaterialsXml(references: ReferenceModel[]): number {
    const rows = collectBasisMaterialRows(references);
    const xml = buildBasisMaterialsXml(rows);
    const date = formatDateForInput(nowMs());
    downloadBasisMaterialsXml(xml, `basis-materials-${date}.xml`);
    return rows.length;
}
