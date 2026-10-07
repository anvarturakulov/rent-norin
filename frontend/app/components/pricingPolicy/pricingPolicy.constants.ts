import { PricingClassPercents } from '@/app/interfaces/pricingPolicy.interface'

export const PRICING_CLASS_COLUMNS: {
    field: keyof PricingClassPercents
    title: string
}[] = [
    { field: 'classA', title: 'Класс A' },
    { field: 'classB', title: 'Класс B' },
    { field: 'classC', title: 'Класс C' },
]

export const EMPTY_CLASS_PERCENTS: PricingClassPercents = {
    classA: 0,
    classB: 0,
    classC: 0,
}
