export enum PricingMarkupGroup {
    BEFORE_COST = 'BEFORE_COST',
    AFTER_COST = 'AFTER_COST',
}

export type PricingClassPercents = {
    classA: number
    classB: number
    classC: number
}

export type PricingMarkupDefinition = {
    id: number
    group: PricingMarkupGroup
    code: string
    name: string
    isSystem: boolean
    includesInCost: boolean
    sortOrder: number
    enterpriseId?: number | null
}

export type PricingPolicyForDate = {
    effectiveDate: number
    snapshotId: number | null
    definitions: PricingMarkupDefinition[]
    values: Record<string, PricingClassPercents>
}

export type PricingPolicySnapshotListItem = {
    id: number
    effectiveDate: number | string
    enterpriseId?: number | null
    comment?: string | null
}

export type PricingPolicySnapshotDetail = {
    id: number
    effectiveDate: number
    enterpriseId?: number | null
    comment?: string | null
    values: Record<string, PricingClassPercents>
}

export type SnapshotValueInput = {
    markupCode: string
    percentClassA: number
    percentClassB: number
    percentClassC: number
}
