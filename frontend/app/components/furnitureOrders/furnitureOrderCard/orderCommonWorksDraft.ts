import type { OrderCommonWorkApi } from '@/app/service/orderCommonWorks/orderCommonWorks.service'

export type DraftCommonWorkRow = {
    draftId: string
    serverId?: number
    commonWorkRefId: string
    workName: string
    unit: string
    quantity: string
    price: string
    amount: string
    selected: boolean
}

export type OrderCommonWork = OrderCommonWorkApi

export function makeCommonWorkDraftId(): string {
    return `cw-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function emptyCommonWorkDraftRow(): DraftCommonWorkRow {
    return {
        draftId: makeCommonWorkDraftId(),
        commonWorkRefId: '',
        workName: '',
        unit: '',
        quantity: '0',
        price: '0',
        amount: '0',
        selected: false,
    }
}

function numFromDraftString(s: string | undefined): number {
    const t = (s ?? '').trim()
    if (t === '') return 0
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
}

export function recomputeCommonWorkAmount(row: DraftCommonWorkRow): DraftCommonWorkRow {
    const quantity = numFromDraftString(row.quantity)
    const price = numFromDraftString(row.price)
    const amount = Math.round(quantity * price * 100) / 100
    return { ...row, amount: String(amount) }
}

export function selectedCommonWorksSum(rows: DraftCommonWorkRow[]): number {
    return rows.reduce((acc, row) => {
        if (!row.selected) return acc
        const amount = numFromDraftString(row.amount)
        if (amount !== 0 || (row.amount ?? '').trim() !== '') return acc + amount
        return acc + numFromDraftString(row.quantity) * numFromDraftString(row.price)
    }, 0)
}

/** Для заказа: сумма выбранных строк по amountInOrder / amount × count */
export function selectedOrderCommonWorksSum(
    rows: DraftCommonWorkRow[],
    orderCount = 1,
): number {
    const mult = orderCount > 0 ? orderCount : 1
    return rows.reduce((acc, row) => {
        if (!row.selected) return acc
        const perUnit = numFromDraftString(row.amount)
            || numFromDraftString(row.quantity) * numFromDraftString(row.price)
        return acc + perUnit * mult
    }, 0)
}

export function orderCommonWorkToDraft(w: OrderCommonWorkApi): DraftCommonWorkRow {
    const quantity = w.quantity ?? 0
    const price = w.price ?? 0
    const amount =
        w.amount != null && Number.isFinite(Number(w.amount))
            ? Number(w.amount)
            : Math.round(quantity * price * 100) / 100
    return recomputeCommonWorkAmount({
        draftId: w.id != null ? `srv-ocw-${w.id}` : makeCommonWorkDraftId(),
        serverId: w.id,
        commonWorkRefId: w.commonWorkRefId != null ? String(w.commonWorkRefId) : '',
        workName: w.workName ?? '',
        unit: w.unit ?? '',
        quantity: String(quantity),
        price: String(price),
        amount: String(amount),
        selected: Boolean(w.selected),
    })
}

export function draftCommonWorkToApiPayload(
    row: DraftCommonWorkRow,
    orderId: number,
    lineIndex: number,
    orderCount = 1,
): OrderCommonWorkApi {
    const quantity = numFromDraftString(row.quantity)
    const price = numFromDraftString(row.price)
    const amount =
        numFromDraftString(row.amount) || Math.round(quantity * price * 100) / 100
    const mult = orderCount > 0 ? orderCount : 1
    const refId = Number(row.commonWorkRefId)
    return {
        orderId,
        lineIndex,
        commonWorkRefId: Number.isFinite(refId) && refId > 0 ? refId : undefined,
        workName: row.workName?.trim() || '—',
        unit: row.unit || undefined,
        quantity,
        price,
        amount,
        quantityInOrder: quantity * mult,
        amountInOrder: amount * mult,
        selected: Boolean(row.selected),
    }
}
