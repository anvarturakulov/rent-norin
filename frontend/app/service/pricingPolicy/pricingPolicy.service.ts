import axios from 'axios'
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain'
import {
    PricingMarkupDefinition,
    PricingPolicyForDate,
    PricingPolicySnapshotDetail,
    PricingPolicySnapshotListItem,
    SnapshotValueInput,
} from '@/app/interfaces/pricingPolicy.interface'

const BASE = () => withApiDomain('/api/pricing-policy')

const authHeaders = (token: string, enterpriseId?: number | null) => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...getNgrokBypassHeaders(),
    }
    if (enterpriseId !== undefined && enterpriseId !== null) {
        headers['x-enterprise-id'] = String(enterpriseId)
    }
    return headers
}

export const pricingPolicyApi = {
    async getDefinitions(
        token: string,
        enterpriseId?: number | null,
    ): Promise<PricingMarkupDefinition[]> {
        const params =
            enterpriseId !== undefined && enterpriseId !== null
                ? `?enterpriseId=${enterpriseId}`
                : ''
        const res = await axios.get(`${BASE()}/definitions${params}`, {
            headers: authHeaders(token, enterpriseId),
        })
        return res.data
    },

    async getForDate(
        token: string,
        date: number,
        enterpriseId?: number | null,
    ): Promise<PricingPolicyForDate> {
        const q = new URLSearchParams({ date: String(date) })
        if (enterpriseId !== undefined && enterpriseId !== null) {
            q.set('enterpriseId', String(enterpriseId))
        }
        const res = await axios.get(`${BASE()}/for-date?${q}`, {
            headers: authHeaders(token, enterpriseId),
        })
        return res.data
    },

    async listSnapshots(
        token: string,
        enterpriseId?: number | null,
    ): Promise<PricingPolicySnapshotListItem[]> {
        const params =
            enterpriseId !== undefined && enterpriseId !== null
                ? `?enterpriseId=${enterpriseId}`
                : ''
        const res = await axios.get(`${BASE()}/snapshots${params}`, {
            headers: authHeaders(token, enterpriseId),
        })
        return res.data
    },

    async getSnapshot(
        token: string,
        id: number,
        enterpriseId?: number | null,
    ): Promise<PricingPolicySnapshotDetail> {
        const res = await axios.get(`${BASE()}/snapshots/${id}`, {
            headers: authHeaders(token, enterpriseId),
        })
        return res.data
    },

    async createSnapshot(
        token: string,
        body: {
            effectiveDate: number
            comment?: string
            values: SnapshotValueInput[]
            enterpriseId?: number | null
        },
        enterpriseId?: number | null,
    ) {
        const res = await axios.post(`${BASE()}/snapshots`, body, {
            headers: authHeaders(token, enterpriseId),
        })
        return res.data
    },

    async updateSnapshot(
        token: string,
        id: number,
        body: {
            effectiveDate?: number
            comment?: string | null
            values?: SnapshotValueInput[]
        },
        enterpriseId?: number | null,
    ) {
        const res = await axios.patch(`${BASE()}/snapshots/${id}`, body, {
            headers: authHeaders(token, enterpriseId),
        })
        return res.data
    },

    async deleteSnapshot(
        token: string,
        id: number,
        enterpriseId?: number | null,
    ) {
        const res = await axios.delete(`${BASE()}/snapshots/${id}`, {
            headers: authHeaders(token, enterpriseId),
        })
        return res.data
    },

    async createDefinition(
        token: string,
        body: { code: string; name: string; sortOrder?: number; includesInCost?: boolean },
    ) {
        const res = await axios.post(`${BASE()}/definitions`, body, {
            headers: authHeaders(token),
        })
        return res.data
    },

    async updateDefinition(
        token: string,
        id: number,
        body: { name?: string; sortOrder?: number; includesInCost?: boolean },
    ) {
        const res = await axios.patch(`${BASE()}/definitions/${id}`, body, {
            headers: authHeaders(token),
        })
        return res.data
    },

    async deleteDefinition(token: string, id: number) {
        const res = await axios.delete(`${BASE()}/definitions/${id}`, {
            headers: authHeaders(token),
        })
        return res.data
    },
}
