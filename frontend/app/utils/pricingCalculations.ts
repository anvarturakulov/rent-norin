import {
    PricingClassPercents,
    PricingMarkupGroup,
    PricingPolicyForDate,
} from '@/app/interfaces/pricingPolicy.interface'
import { PriceClass } from '@/app/interfaces/reference.interface'
import { formatDateForInput, parseDateInputValue } from '@/app/utils/dateInput'
import { nowMs } from '@/app/utils/serverNow'

export const PRICE_CLASS_FIELD: Record<PriceClass, keyof PricingClassPercents> = {
    [PriceClass.A]: 'classA',
    [PriceClass.B]: 'classB',
    [PriceClass.C]: 'classC',
}

export const PRICE_CLASS_LABEL: Record<PriceClass, string> = {
    [PriceClass.A]: 'Класс A',
    [PriceClass.B]: 'Класс B',
    [PriceClass.C]: 'Класс C',
}

export function dateStringToMs(dateStr: string): number {
    return parseDateInputValue(dateStr) ?? Date.parse(dateStr)
}

export function msToDateInputValue(ms: number): string {
    return formatDateForInput(ms)
}

export function todayDateMs(): number {
    return parseDateInputValue(formatDateForInput(nowMs())) ?? nowMs()
}

export function applyMarkupPercent(base: number, percent: number): number {
    return base * (100 + percent) / 100
}

export function getClassPercent(
    values: PricingClassPercents | undefined,
    priceClass: PriceClass,
): number {
    if (!values) return 0
    const field = PRICE_CLASS_FIELD[priceClass]
    const n = Number(values[field])
    return Number.isFinite(n) ? n : 0
}

export function sumBeforeCostPercents(
    policy: PricingPolicyForDate,
    priceClass: PriceClass,
    disabledCodes: ReadonlySet<string> | string[] = [],
): number {
    const disabled = disabledCodes instanceof Set
        ? disabledCodes
        : new Set(disabledCodes)
    let sum = 0
    for (const def of policy.definitions) {
        if (def.group !== PricingMarkupGroup.BEFORE_COST) continue
        if (def.includesInCost === false) continue
        if (disabled.has(def.code)) continue
        sum += getClassPercent(policy.values[def.code], priceClass)
    }
    return sum
}

export function getAfterCostPercent(
    policy: PricingPolicyForDate,
    priceClass: PriceClass,
    code: 'DEALER' | 'RETAIL' | 'TRANSFER',
): number {
    return getClassPercent(policy.values[code], priceClass)
}

export type BeforeCostMarkupLine = {
    code: string
    name: string
    percent: number
    amount: number
    includesInCost: boolean
    enabled: boolean
}

export function computeBeforeCostMarkupLines(
    policy: PricingPolicyForDate,
    priceClass: PriceClass,
    jami: number,
    disabledCodes: ReadonlySet<string> | string[] = [],
): BeforeCostMarkupLine[] {
    const disabled = disabledCodes instanceof Set
        ? disabledCodes
        : new Set(disabledCodes)
    return policy.definitions
        .filter((def) => def.group === PricingMarkupGroup.BEFORE_COST)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((def) => {
            const enabled = !disabled.has(def.code)
            const percent = getClassPercent(policy.values[def.code], priceClass)
            return {
                code: def.code,
                name: def.name,
                percent,
                amount: enabled ? jami * percent / 100 : 0,
                includesInCost: def.includesInCost !== false,
                enabled,
            }
        })
}

export type PricingBreakdown = {
    worksSum: number
    materialsSum: number
    jami: number
    beforeCostMarkupSumPercent: number
    beforeCostMarkupSumAmount: number
    beforeCostMarkupLines: BeforeCostMarkupLine[]
    costPrice: number
    dealerPercent: number
    retailPercent: number
    transferPercent: number
    dealerPrice: number
    retailPrice: number
    transferPrice: number
}

export function computePricingBreakdown(params: {
    worksSum: number
    materialsSum: number
    policy: PricingPolicyForDate
    priceClass: PriceClass
    disabledBeforeCostMarkupCodes?: string[] | null
}): PricingBreakdown {
    const {
        worksSum,
        materialsSum,
        policy,
        priceClass,
        disabledBeforeCostMarkupCodes,
    } = params
    const disabled = disabledBeforeCostMarkupCodes ?? []
    const jami = worksSum + materialsSum
    const beforeCostMarkupSumPercent = sumBeforeCostPercents(
        policy,
        priceClass,
        disabled,
    )
    const beforeCostMarkupLines = computeBeforeCostMarkupLines(
        policy,
        priceClass,
        jami,
        disabled,
    )
    const costPrice = applyMarkupPercent(jami, beforeCostMarkupSumPercent)
    const beforeCostMarkupSumAmount = costPrice - jami
    const dealerPercent = getAfterCostPercent(policy, priceClass, 'DEALER')
    const retailPercent = getAfterCostPercent(policy, priceClass, 'RETAIL')
    const transferPercent = getAfterCostPercent(policy, priceClass, 'TRANSFER')
    return {
        worksSum,
        materialsSum,
        jami,
        beforeCostMarkupSumPercent,
        beforeCostMarkupSumAmount,
        beforeCostMarkupLines,
        costPrice,
        dealerPercent,
        retailPercent,
        transferPercent,
        dealerPrice: applyMarkupPercent(costPrice, dealerPercent),
        retailPrice: applyMarkupPercent(costPrice, retailPercent),
        transferPrice: applyMarkupPercent(costPrice, transferPercent),
    }
}

export const EMPTY_POLICY: PricingPolicyForDate = {
    effectiveDate: 0,
    snapshotId: null,
    definitions: [],
    values: {},
}
