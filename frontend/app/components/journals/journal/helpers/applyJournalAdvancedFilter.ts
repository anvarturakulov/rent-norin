import { DocumentModel } from '@/app/interfaces/document.interface';
import { FurnitureOrder } from '@/app/interfaces/furnitureOrder.interface';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { parseDateInputValue } from '@/app/utils/dateInput';
import { startOfZonedDay } from '@/app/utils/appTime';
import {
    JournalFilterField,
    JournalFilterOp,
    JournalFilterRule,
    countActiveJournalFilterRules,
} from '../constants';
import {
    getNameEnterprise,
    getNameReference,
    getUserName,
} from './journal.functions';
import {
    formatOrderJournalLabel,
    getOrderJournalFilterValue,
} from './orderJournal';

type ApplyCtx = {
    references: ReferenceModel[] | undefined;
    enterprises: any;
    mainData: any;
    ordersById: Map<number, FurnitureOrder>;
};

function dayStartMs(dateInput: string | number): number | null {
    if (typeof dateInput === 'number' && Number.isFinite(dateInput)) {
        return startOfZonedDay(dateInput);
    }
    const s = String(dateInput || '').trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return parseDateInputValue(s);
    }
    const parsed = Date.parse(s);
    if (Number.isNaN(parsed)) return null;
    return startOfZonedDay(parsed);
}

function compareText(op: JournalFilterOp, actual: string, expected: string): boolean {
    const a = (actual || '').toLowerCase();
    const e = expected.toLowerCase();
    if (op === 'contains') return a.includes(e);
    if (op === 'eq') return a === e;
    return true;
}

function compareNumber(op: JournalFilterOp, actual: number | null | undefined, expected: number): boolean {
    if (actual == null || Number.isNaN(Number(actual))) return false;
    const a = Number(actual);
    if (op === 'eq') return a === expected;
    if (op === 'gt') return a > expected;
    if (op === 'lt') return a < expected;
    return true;
}

function compareDate(op: JournalFilterOp, docDate: number | undefined, expectedRaw: string | number): boolean {
    if (docDate == null) return false;
    const expectedStart = dayStartMs(expectedRaw);
    if (expectedStart == null) return false;
    const docStart = dayStartMs(docDate);
    if (docStart == null) return false;
    if (op === 'eq') return docStart === expectedStart;
    if (op === 'gt') return docStart > expectedStart;
    if (op === 'lt') return docStart < expectedStart;
    return true;
}

function getTextValue(
    field: JournalFilterField,
    item: DocumentModel,
    ctx: ApplyCtx,
): string {
    switch (field) {
        case 'docNumber':
            return String(item.id ?? '');
        case 'documentType':
            return getDescriptionDocument(item.documentType);
        case 'enterprise':
            return (
                item.enterprise?.name ||
                getNameEnterprise(ctx.enterprises, item.enterpriseId) ||
                ''
            );
        case 'receiver':
            return getNameReference(ctx.references, item.docValues?.receiverId) || '';
        case 'sender':
            return getNameReference(ctx.references, item.docValues?.senderId) || '';
        case 'analitic':
            return getNameReference(ctx.references, item.docValues?.analiticId) || '';
        case 'order':
            return getOrderJournalFilterValue(item.docValues?.orderId, ctx.ordersById);
        case 'comment': {
            const productName = getNameReference(
                ctx.references,
                item.docValues?.productForChargeId,
            );
            return `${productName || ''}${item.docValues?.comment || ''}`;
        }
        case 'user':
            return String(getUserName(item.userId, ctx.mainData) || '');
        case 'date':
            return dateNumberToString(item.date);
        default:
            return '';
    }
}

function getReferenceId(field: JournalFilterField, item: DocumentModel): number | undefined {
    if (field === 'receiver') return item.docValues?.receiverId;
    if (field === 'sender') return item.docValues?.senderId;
    if (field === 'analitic') return item.docValues?.analiticId;
    return undefined;
}

function matchRule(item: DocumentModel, rule: JournalFilterRule, ctx: ApplyCtx): boolean {
    const { field, op, value } = rule;
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;

    if (field === 'summa') {
        return compareNumber(op, item.docValues?.total, Number(value));
    }
    if (field === 'usd') {
        return compareNumber(op, item.docValues?.usd, Number(value));
    }
    if (field === 'date') {
        return compareDate(op, item.date, value);
    }
    if (field === 'enterprise') {
        return Number(item.enterpriseId) === Number(value);
    }
    if (field === 'documentType') {
        return String(item.documentType) === String(value);
    }
    if (field === 'receiver' || field === 'sender' || field === 'analitic') {
        if (op === 'eq' && (typeof value === 'number' || /^\d+$/.test(String(value)))) {
            return Number(getReferenceId(field, item)) === Number(value);
        }
        return compareText(op, getTextValue(field, item, ctx), String(value));
    }
    if (field === 'order' && op === 'eq') {
        const label = formatOrderJournalLabel(item.docValues?.orderId, ctx.ordersById);
        const raw = String(item.docValues?.orderId ?? '');
        const q = String(value).trim().toLowerCase();
        return label.toLowerCase() === q || raw === String(value).trim();
    }

    return compareText(op, getTextValue(field, item, ctx), String(value));
}

export function applyJournalAdvancedFilter(
    documents: DocumentModel[],
    rules: JournalFilterRule[],
    ctx: ApplyCtx,
): DocumentModel[] {
    if (!countActiveJournalFilterRules(rules)) return documents;

    const active = rules.filter((r) => {
        if (!r.enabled) return false;
        if (r.value === null || r.value === undefined) return false;
        if (typeof r.value === 'string' && r.value.trim() === '') return false;
        return true;
    });

    return documents.filter((item) => active.every((rule) => matchRule(item, rule, ctx)));
}
