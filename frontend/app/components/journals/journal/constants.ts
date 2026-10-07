import { TypeReference } from '@/app/interfaces/reference.interface';

export type JournalFilterOp = 'eq' | 'contains' | 'gt' | 'lt';

export type JournalFilterValueType =
    | 'text'
    | 'number'
    | 'date'
    | 'reference'
    | 'documentType'
    | 'enterprise';

export type JournalFilterField =
    | 'docNumber'
    | 'date'
    | 'enterprise'
    | 'documentType'
    | 'summa'
    | 'usd'
    | 'receiver'
    | 'sender'
    | 'analitic'
    | 'order'
    | 'comment'
    | 'user';

export interface JournalFilterRule {
    field: JournalFilterField;
    enabled: boolean;
    op: JournalFilterOp;
    value: string | number | null;
}

export interface JournalFilterFieldDef {
    field: JournalFilterField;
    label: string;
    valueType: JournalFilterValueType;
    ops: JournalFilterOp[];
    defaultOp: JournalFilterOp;
}

export const FILTER_OP_LABELS: Record<JournalFilterOp, string> = {
    eq: 'Равно',
    contains: 'Содержит',
    gt: 'Больше',
    lt: 'Меньше',
};

/** PARTNERS / STORAGES — org-like справочники for reference value UI. */
export function isOrgJournalFilterType(type: TypeReference | undefined | null): boolean {
    return type === TypeReference.PARTNERS || type === TypeReference.STORAGES;
}

export const JOURNAL_FILTER_FIELD_DEFS: JournalFilterFieldDef[] = [
    {
        field: 'docNumber',
        label: 'Раками',
        valueType: 'text',
        ops: ['eq', 'contains'],
        defaultOp: 'eq',
    },
    {
        field: 'date',
        label: 'Сана',
        valueType: 'date',
        ops: ['eq', 'gt', 'lt'],
        defaultOp: 'eq',
    },
    {
        field: 'enterprise',
        label: 'Корхона',
        valueType: 'enterprise',
        ops: ['eq'],
        defaultOp: 'eq',
    },
    {
        field: 'documentType',
        label: 'Хужжат тури',
        valueType: 'documentType',
        ops: ['eq'],
        defaultOp: 'eq',
    },
    {
        field: 'summa',
        label: 'Сумма',
        valueType: 'number',
        ops: ['eq', 'gt', 'lt'],
        defaultOp: 'eq',
    },
    {
        field: 'usd',
        label: 'USD',
        valueType: 'number',
        ops: ['eq', 'gt', 'lt'],
        defaultOp: 'eq',
    },
    {
        field: 'receiver',
        label: 'Олувчи',
        valueType: 'reference',
        ops: ['eq', 'contains'],
        defaultOp: 'eq',
    },
    {
        field: 'sender',
        label: 'Берувчи',
        valueType: 'reference',
        ops: ['eq', 'contains'],
        defaultOp: 'eq',
    },
    {
        field: 'analitic',
        label: 'Аналитика',
        valueType: 'reference',
        ops: ['eq', 'contains'],
        defaultOp: 'eq',
    },
    {
        field: 'order',
        label: 'Заказ',
        valueType: 'text',
        ops: ['eq', 'contains'],
        defaultOp: 'contains',
    },
    {
        field: 'comment',
        label: 'Изох',
        valueType: 'text',
        ops: ['eq', 'contains'],
        defaultOp: 'contains',
    },
    {
        field: 'user',
        label: 'Фойдаланувчи',
        valueType: 'text',
        ops: ['eq', 'contains'],
        defaultOp: 'contains',
    },
];

export function createDefaultJournalFilterRules(): JournalFilterRule[] {
    return JOURNAL_FILTER_FIELD_DEFS.map((def) => ({
        field: def.field,
        enabled: false,
        op: def.defaultOp,
        value: null,
    }));
}

export function countActiveJournalFilterRules(rules: JournalFilterRule[]): number {
    return rules.filter((r) => {
        if (!r.enabled) return false;
        if (r.value === null || r.value === undefined) return false;
        if (typeof r.value === 'string' && r.value.trim() === '') return false;
        return true;
    }).length;
}

export function getJournalFilterFieldDef(
    field: JournalFilterField,
): JournalFilterFieldDef | undefined {
    return JOURNAL_FILTER_FIELD_DEFS.find((d) => d.field === field);
}
