import { TypeReference } from '@/app/interfaces/reference.interface';
import {
    ReferencePermissionItem,
    ReferencePermissions,
    TmzTabPermissions,
    User,
} from '@/app/interfaces/user.interface';

export type TmzProductTabKey = keyof TmzTabPermissions;

const TMZ_TAB_KEYS: TmzProductTabKey[] = [
    'works',
    'commonWorks',
    'materials',
    'halfstuffs',
    'components',
    'techMap',
    'files',
    'pricing',
];

export const REFERENCE_PERMISSION_TYPES: TypeReference[] = [
    TypeReference.TMZ,
    TypeReference.TMZ_SHORT_NAME,
    TypeReference.TMZ_SIZE,
    TypeReference.TMZ_COLOR,
    TypeReference.TMZ_TEXTURE,
    TypeReference.TMZ_MANUFACTURE,
    TypeReference.TMZ_UNIT,
    TypeReference.STORAGES,
    TypeReference.PARTNERS,
    TypeReference.WORKERS,
    TypeReference.WORKS,
    TypeReference.COMMON_WORKS,
    TypeReference.CHARGES,
    TypeReference.SERVICES,
    TypeReference.CARS,
    TypeReference.APARTMENTS,
    TypeReference.MEDIATORS,
    TypeReference.DELIVERERS,
];

export const REFERENCE_TYPE_LABELS: Record<TypeReference, string> = {
    [TypeReference.TMZ]: 'ТМЗ',
    [TypeReference.TMZ_SHORT_NAME]: 'Қисқа номлар (ТМЗ)',
    [TypeReference.TMZ_SIZE]: 'Ўлчамлар (ТМЗ)',
    [TypeReference.TMZ_COLOR]: 'Ранглар (ТМЗ)',
    [TypeReference.TMZ_TEXTURE]: 'Текстуралар (ТМЗ)',
    [TypeReference.TMZ_MANUFACTURE]: 'Ишлаб чиқарувчилар (ТМЗ)',
    [TypeReference.TMZ_UNIT]: 'Ўлчов бирликлари (ТМЗ)',
    [TypeReference.STORAGES]: 'Цех ва омборхоналар',
    [TypeReference.PARTNERS]: 'Хамкорлар',
    [TypeReference.WORKERS]: 'Ходимлар',
    [TypeReference.WORKS]: 'Иш турлари',
    [TypeReference.COMMON_WORKS]: 'Умумий ишлар',
    [TypeReference.CHARGES]: 'Харажатлар',
    [TypeReference.SERVICES]: 'Хизматлар',
    [TypeReference.CARS]: 'Автомашиналар',
    [TypeReference.APARTMENTS]: 'Хонадонлар',
    [TypeReference.PRICES]: 'Нархлар',
    [TypeReference.WORK_ITEMS]: 'Иш бандлари',
    [TypeReference.MEDIATORS]: 'Воситачилар',
    [TypeReference.DELIVERERS]: 'Доставщиклар',
};

export const TMZ_TAB_LABELS: Record<TmzProductTabKey, string> = {
    works: 'Ишлар',
    commonWorks: 'Умумий ишлар',
    materials: 'Материаллар',
    halfstuffs: 'Ярим тайёр махсулот',
    components: 'Составные части',
    techMap: 'Техкарт',
    files: 'Файллар',
    pricing: 'Нархлаш',
};

function getTypePermission(
    user: User | null | undefined,
    type: TypeReference,
): ReferencePermissionItem | null {
    if (!user?.referencePermissions) return null;
    return user.referencePermissions[type] ?? null;
}

function hasFlag(
    user: User | null | undefined,
    type: TypeReference,
    key: keyof Omit<ReferencePermissionItem, 'tmzTabs'>,
): boolean {
    const item = getTypePermission(user, type);
    if (!item) return true;
    return item[key] !== false;
}

export function canViewReference(user: User | null | undefined, type: TypeReference): boolean {
    return hasFlag(user, type, 'canView');
}

export function canCreateReference(user: User | null | undefined, type: TypeReference): boolean {
    return hasFlag(user, type, 'canCreate');
}

export function canEditReference(user: User | null | undefined, type: TypeReference): boolean {
    return hasFlag(user, type, 'canEdit');
}

export function canDeleteReference(user: User | null | undefined, type: TypeReference): boolean {
    return hasFlag(user, type, 'canDelete');
}

export function canUploadReferenceFiles(user: User | null | undefined, type: TypeReference): boolean {
    return hasFlag(user, type, 'canUploadFiles');
}

export function canViewTmzTab(user: User | null | undefined, tab: TmzProductTabKey): boolean {
    if (!user?.referencePermissions) return true;
    const item = user.referencePermissions[TypeReference.TMZ];
    if (!item) return true;
    if (!item.tmzTabs) return true;
    return item.tmzTabs[tab] !== false;
}

export function getVisibleTmzTabs(user: User | null | undefined): TmzProductTabKey[] {
    return TMZ_TAB_KEYS.filter((tab) => canViewTmzTab(user, tab));
}

export function createFullReferencePermissions(): ReferencePermissions {
    const base: ReferencePermissionItem = {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canUploadFiles: true,
    };
    const tmzTabs: TmzTabPermissions = {
        works: true,
        commonWorks: true,
        materials: true,
        halfstuffs: true,
        components: true,
        pricing: true,
        techMap: true,
        files: true,
    };
    const result: ReferencePermissions = {};
    for (const type of REFERENCE_PERMISSION_TYPES) {
        result[type] =
            type === TypeReference.TMZ
                ? { ...base, tmzTabs: { ...tmzTabs } }
                : { ...base };
    }
    return result;
}

export function createDeniedReferencePermissions(): ReferencePermissions {
    const base: ReferencePermissionItem = {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canUploadFiles: false,
    };
    const tmzTabs: TmzTabPermissions = {
        works: false,
        commonWorks: false,
        materials: false,
        halfstuffs: false,
        components: false,
        pricing: false,
        techMap: false,
        files: false,
    };
    const result: ReferencePermissions = {};
    for (const type of REFERENCE_PERMISSION_TYPES) {
        result[type] =
            type === TypeReference.TMZ
                ? { ...base, tmzTabs: { ...tmzTabs } }
                : { ...base };
    }
    return result;
}

export function ensureReferencePermissionItem(
    permissions: ReferencePermissions | null | undefined,
    type: TypeReference,
): ReferencePermissionItem {
    const existing = permissions?.[type];
    if (existing) {
        return {
            canView: existing.canView ?? true,
            canCreate: existing.canCreate ?? true,
            canEdit: existing.canEdit ?? true,
            canDelete: existing.canDelete ?? true,
            canUploadFiles: existing.canUploadFiles ?? true,
            tmzTabs: existing.tmzTabs,
        };
    }
    return {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canUploadFiles: true,
        ...(type === TypeReference.TMZ
            ? {
                  tmzTabs: {
                      works: true,
                      commonWorks: true,
                      materials: true,
                      halfstuffs: true,
                      components: true,
                      pricing: true,
                      techMap: true,
                      files: true,
                  },
              }
            : {}),
    };
}
