import type { ReferenceModel } from '@/app/interfaces/reference.interface';
import type { RefValues } from '@/app/interfaces/reference.interface';

const UZ_MONTHS = [
    'январ',
    'феврал',
    'март',
    'апрел',
    'май',
    'июн',
    'июл',
    'август',
    'сентябр',
    'октябр',
    'ноябр',
    'декабр',
] as const;

export type RentalContractPrintData = {
    contractNumber: string;
    contractDateLabel: string;
    endDateLabel: string | null;
    isLegalEntity: boolean;
    lesseeName: string;
    lesseeNameLine2: string;
    lesseePreamblePassport: string;
    lesseePreamblePinfl: string;
    lesseeAddress: string;
    lesseeAddressLine2: string;
    lesseeInn: string;
    lesseeBankName: string;
    lesseeBankAccount: string;
    lesseeBankMfo: string;
    lesseePassportBlock: string;
    lesseePassportBlockLine2: string;
    lesseePhone1: string;
    lesseePhone2: string;
    lesseePhone3: string;
    lesseeContact: string;
};

function fillOrUnderline(value: string | undefined | null, minLen = 20): string {
    const v = (value ?? '').trim();
    if (v) return v;
    return '_'.repeat(minLen);
}

export function formatUzbekContractDate(ms: number): string {
    const d = new Date(ms);
    if (!Number.isFinite(d.getTime())) return fillOrUnderline('', 18);
    const day = d.getDate();
    const month = UZ_MONTHS[d.getMonth()] ?? '';
    const year = d.getFullYear();
    return `«${day}» ${month} ${year} й.`;
}

export function formatPassportShort(rv: RefValues | undefined): string {
    const series = (rv?.passportSeries ?? '').trim().toUpperCase();
    const number = (rv?.passportNumber ?? '').trim();
    if (!series && !number) return fillOrUnderline('', 40);
    return `${series} ${number}`.trim();
}

export function formatPassportFull(rv: RefValues | undefined): string {
    const short = formatPassportShort(rv);
    if (short.startsWith('_')) return short;
    const issuedBy = (rv?.passportIssuedBy ?? '').trim();
    const rawDate = rv?.passportIssueDate;
    const dateStr = rawDate ? String(rawDate).slice(0, 10) : '';
    const parts = [short];
    if (issuedBy) parts.push(`берилган: ${issuedBy}`);
    if (dateStr) parts.push(`сана: ${dateStr}`);
    return parts.join(', ');
}

function splitLongText(text: string, maxFirstLine = 42): { line1: string; line2: string } {
    const t = text.trim();
    if (!t) return { line1: fillOrUnderline('', maxFirstLine), line2: fillOrUnderline('', maxFirstLine) };
    if (t.length <= maxFirstLine) return { line1: t, line2: fillOrUnderline('', maxFirstLine) };
    const cut = t.lastIndexOf(' ', maxFirstLine);
    const idx = cut > 20 ? cut : maxFirstLine;
    return { line1: t.slice(0, idx).trim(), line2: t.slice(idx).trim() };
}

function formatPhoneDisplay(phone: string | undefined): string {
    const p = (phone ?? '').trim();
    return p || fillOrUnderline('', 15);
}

export function buildRentalContractPrintData(params: {
    contractNumber: string;
    contractDateMs: number;
    endDateMs: number | null;
    client: ReferenceModel | null;
}): RentalContractPrintData {
    const rv = params.client?.refValues;
    const name = (params.client?.name ?? '').trim();
    const nameLines = splitLongText(name, 38);
    const addressLines = splitLongText(rv?.address ?? '', 40);

    const inn = (rv?.inn ?? '').trim();
    const jshshir = (rv?.jshshir ?? '').trim();
    const isIndividual = Boolean(rv?.isIndividualPerson);
    const isLegal = Boolean(rv?.isLegalEntity);

    const lesseeInnOrJshshir = isLegal ? inn : isIndividual ? jshshir : '';

    const passportFull = isIndividual ? formatPassportFull(rv) : '';

    return {
        contractNumber: fillOrUnderline(params.contractNumber.trim() || undefined, 8),
        contractDateLabel: formatUzbekContractDate(params.contractDateMs),
        endDateLabel:
            params.endDateMs != null && Number.isFinite(params.endDateMs)
                ? formatUzbekContractDate(params.endDateMs)
                : null,
        isLegalEntity: isLegal,
        lesseeName: nameLines.line1,
        lesseeNameLine2: nameLines.line2,
        lesseePreamblePassport: isIndividual ? formatPassportShort(rv) : '',
        lesseePreamblePinfl: isIndividual ? fillOrUnderline(jshshir || undefined, 25) : '',
        lesseeAddress: addressLines.line1,
        lesseeAddressLine2: addressLines.line2,
        lesseeInn: fillOrUnderline(lesseeInnOrJshshir || undefined, 25),
        lesseeBankName: fillOrUnderline(rv?.bankName, 30),
        lesseeBankAccount: fillOrUnderline(rv?.bankAccount, 20),
        lesseeBankMfo: fillOrUnderline(rv?.bankMfo, 8),
        lesseePassportBlock: isIndividual ? passportFull.slice(0, 48) : '',
        lesseePassportBlockLine2: isIndividual
            ? passportFull.slice(48).trim() || fillOrUnderline('', 40)
            : '',
        lesseePhone1: formatPhoneDisplay(rv?.phone),
        lesseePhone2: formatPhoneDisplay(rv?.phone2),
        lesseePhone3: fillOrUnderline('', 15),
        lesseeContact: fillOrUnderline(rv?.contactName1, 25),
    };
}
