import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain'

const BASE = () => withApiDomain('/api')

const headers = (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
})

export type OrderCommonWorkApi = {
    id?: number
    orderId?: number
    lineIndex?: number
    commonWorkRefId?: number
    workName: string
    unit?: string
    quantity?: number
    price?: number
    amount?: number
    quantityInOrder?: number
    amountInOrder?: number
    selected?: boolean
    sourceNormId?: number
}

export const orderCommonWorksApi = {
    findByOrder: async (token: string, orderId: number): Promise<OrderCommonWorkApi[]> => {
        const res = await fetch(`${BASE()}/order-common-works?orderId=${orderId}`, {
            headers: headers(token),
        })
        if (!res.ok) {
            const t = await res.text().catch(() => '')
            throw new Error(t || 'Ошибка загрузки общих работ заказа')
        }
        return res.json()
    },

    replaceForOrder: async (
        token: string,
        orderId: number,
        rows: OrderCommonWorkApi[],
    ): Promise<OrderCommonWorkApi[]> => {
        const res = await fetch(`${BASE()}/order-common-works/order/${orderId}`, {
            method: 'PUT',
            headers: headers(token),
            body: JSON.stringify(rows),
        })
        if (!res.ok) {
            const t = await res.text().catch(() => '')
            throw new Error(t || 'Ошибка сохранения общих работ заказа')
        }
        return res.json()
    },

    update: async (
        token: string,
        id: number,
        patch: Partial<OrderCommonWorkApi>,
    ): Promise<OrderCommonWorkApi> => {
        const res = await fetch(`${BASE()}/order-common-works/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(patch),
        })
        if (!res.ok) {
            const t = await res.text().catch(() => '')
            throw new Error(t || 'Ошибка обновления общей работы')
        }
        return res.json()
    },

    remove: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/order-common-works/${id}`, {
            method: 'DELETE',
            headers: headers(token),
        })
        if (!res.ok) {
            const t = await res.text().catch(() => '')
            throw new Error(t || 'Ошибка удаления общей работы')
        }
    },
}
