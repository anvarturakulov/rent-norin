import { OrderStageType } from '@/app/interfaces/furnitureOrder.interface';
import { UserRoles } from '@/app/interfaces/user.interface';

export type FurnitureOrderTab =
    | 'info'
    | 'scaling'
    | 'drawing'
    | 'works'
    | 'commonWorks'
    | 'cutting'
    | 'materials'
    | 'halfstuffs'
    | 'pricing'
    | 'techMap'
    | 'processes'
    | 'history'
    | 'storeWork'
    | 'files';

export const TAB_ORDER: FurnitureOrderTab[] = [
    'info',
    'processes',
    'scaling',
    'drawing',
    'works',
    'commonWorks',
    'materials',
    'halfstuffs',
    'cutting',
    'storeWork',
    'techMap',
    'history',
    'files',
    'pricing',
];

const INFO_ONLY: FurnitureOrderTab[] = ['info'];
const INFO_SCALING: FurnitureOrderTab[] = ['info', 'scaling'];
const INFO_DRAWING_WORKS: FurnitureOrderTab[] = [
    'info',
    'drawing',
    'works',
    'commonWorks',
    'materials',
    'halfstuffs',
    'techMap',
    'files',
];
const INFO_HISTORY_FILES: FurnitureOrderTab[] = ['info', 'history', 'files'];
const INFO_WORKS_MATERIALS_PRICING: FurnitureOrderTab[] = ['info', 'works', 'commonWorks', 'materials', 'halfstuffs', 'pricing'];
const INFO_WORKS_MATERIALS_PRICING_TECH_MAP: FurnitureOrderTab[] = ['info', 'works', 'commonWorks', 'materials', 'halfstuffs', 'techMap', 'files', 'pricing'];
const INFO_WORKS_MATERIALS_TECH_MAP: FurnitureOrderTab[] = ['info', 'works', 'commonWorks', 'materials', 'halfstuffs', 'techMap'];
const INFO_HISTORY_FILES_TECH_MAP_PROCESSES: FurnitureOrderTab[] = ['info', 'processes', 'history', 'files', 'techMap'];
const INFO_CUTTING: FurnitureOrderTab[] = ['info', 'cutting'];
const INFO_STORE_WORK: FurnitureOrderTab[] = ['info', 'storeWork'];
const COMPLETED_TABS: FurnitureOrderTab[] = [
    'info',
    'works',
    'commonWorks',
    'materials',
    'halfstuffs',
    'cutting',
    'storeWork',
    'techMap',
    'history',
    'files',
    'pricing',
];

const DRAWING_ROLE_TABS: FurnitureOrderTab[] = [
    'info',
    'scaling',
    'drawing',
    'works',
    'commonWorks',
    'materials',
    'halfstuffs',
    'techMap',
    'files',
];

export function canDrawingRoleEditComposition(stage: OrderStageType): boolean {
    return stage === 'SCALING' || stage === 'DRAWING';
}

export function canDrawingRoleAdvance(stage: OrderStageType): boolean {
    return stage === 'SCALING' || stage === 'DRAWING';
}

export function canDrawingRoleRevert(stage: OrderStageType): boolean {
    return stage === 'DRAWING';
}

const STAGE_TABS: Record<OrderStageType, FurnitureOrderTab[]> = {
    TALABGOR: INFO_ONLY,
    SCALING: INFO_SCALING,
    DRAWING: INFO_DRAWING_WORKS,
    IN_PRODUCTION: INFO_HISTORY_FILES_TECH_MAP_PROCESSES,
    DELIVERY: INFO_HISTORY_FILES,
    PRICING: INFO_WORKS_MATERIALS_PRICING,
    DOGOVOR: INFO_WORKS_MATERIALS_PRICING_TECH_MAP,
    TEXNOLOG: INFO_WORKS_MATERIALS_TECH_MAP,
    CUTTING: INFO_CUTTING,
    STORE: INFO_STORE_WORK,
    COMPLETED: COMPLETED_TABS,
};

export function getTabsForStage(stage: OrderStageType, role?: UserRoles): FurnitureOrderTab[] {
    if (role === UserRoles.DRAWING) {
        return TAB_ORDER.filter((tab) => DRAWING_ROLE_TABS.includes(tab));
    }
    const allowed = STAGE_TABS[stage] ?? INFO_ONLY;
    return TAB_ORDER.filter((tab) => allowed.includes(tab));
}
