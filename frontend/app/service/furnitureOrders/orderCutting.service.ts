import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import type { CuttingBalanceRow, OrderCuttingLine } from '@/app/interfaces/furnitureOrder.interface';

const BASE = () => withApiDomain('/api');

const headers = (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
});

export const cuttingApi = {
    getIssues: async (token: string, orderId: number): Promise<OrderCuttingLine[]> => {
        const res = await fetch(`${BASE()}/order-cutting/issues?orderId=${orderId}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Расходни юклашда хатолик');
        return res.json();
    },

    getOutputs: async (token: string, orderId: number): Promise<OrderCuttingLine[]> => {
        const res = await fetch(`${BASE()}/order-cutting/outputs?orderId=${orderId}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Приходни юклашда хатолик');
        return res.json();
    },

    createIssue: async (
        token: string,
        data: { orderId: number; materialId: number; length: number; width: number; quantity: number; comment?: string },
    ): Promise<OrderCuttingLine> => {
        const res = await fetch(`${BASE()}/order-cutting/issues`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Расход қўшишда хатолик');
        return res.json();
    },

    createOutput: async (
        token: string,
        data: { orderId: number; materialId: number; length: number; width: number; quantity: number; comment?: string },
    ): Promise<OrderCuttingLine> => {
        const res = await fetch(`${BASE()}/order-cutting/outputs`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Приход қўшишда хатолик');
        return res.json();
    },

    updateIssue: async (
        token: string,
        id: number,
        data: Partial<{ materialId: number; length: number; width: number; quantity: number; comment?: string }>,
    ): Promise<OrderCuttingLine> => {
        const res = await fetch(`${BASE()}/order-cutting/issues/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Расходни янгилашда хатолик');
        return res.json();
    },

    updateOutput: async (
        token: string,
        id: number,
        data: Partial<{ materialId: number; length: number; width: number; quantity: number; comment?: string }>,
    ): Promise<OrderCuttingLine> => {
        const res = await fetch(`${BASE()}/order-cutting/outputs/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Приходни янгилашда хатолик');
        return res.json();
    },

    deleteIssue: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/order-cutting/issues/${id}`, { method: 'DELETE', headers: headers(token) });
        if (!res.ok) throw new Error('Расходни ўчиришда хатолик');
    },

    deleteOutput: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/order-cutting/outputs/${id}`, { method: 'DELETE', headers: headers(token) });
        if (!res.ok) throw new Error('Приходни ўчиришда хатолик');
    },

    getBalances: async (
        token: string,
        enterpriseId: number,
        params?: { materialId?: number; hideZero?: boolean },
    ): Promise<CuttingBalanceRow[]> => {
        const q = new URLSearchParams({ enterpriseId: String(enterpriseId) });
        if (params?.materialId) q.set('materialId', String(params.materialId));
        if (params?.hideZero === false) q.set('hideZero', 'false');
        const res = await fetch(`${BASE()}/order-cutting/balances?${q}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Қолдиқларни юклашда хатолик');
        return res.json();
    },
};
