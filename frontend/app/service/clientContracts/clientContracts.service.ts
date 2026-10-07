import type {
    ClientContract,
    ContractSaleCandidate,
    SaveClientContractPayload,
} from '@/app/interfaces/clientContract.interface';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';

const BASE = () => withApiDomain('/api');

const headers = (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
});

async function readError(res: Response, fallback: string): Promise<string> {
    try {
        const body = await res.json();
        if (typeof body?.message === 'string') return body.message;
        if (Array.isArray(body?.message)) return body.message.join(', ');
    } catch {
        const text = await res.text().catch(() => '');
        if (text) return text;
    }
    return fallback;
}

export const clientContractsApi = {
    list: async (
        token: string,
        enterpriseId?: number,
        dateStart?: number,
        dateEnd?: number,
    ): Promise<ClientContract[]> => {
        const params = new URLSearchParams();
        if (enterpriseId != null) params.set('enterpriseId', String(enterpriseId));
        if (dateStart != null) params.set('dateStart', String(dateStart));
        if (dateEnd != null) params.set('dateEnd', String(dateEnd));
        const q = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${BASE()}/client-contracts${q}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Не удалось загрузить договоры');
        return res.json();
    },

    getOne: async (token: string, id: number): Promise<ClientContract> => {
        const res = await fetch(`${BASE()}/client-contracts/${id}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Договор не найден');
        return res.json();
    },

    previewNumber: async (
        token: string,
        enterpriseId: number,
        year: number,
    ): Promise<{ contractNumber: string }> => {
        const res = await fetch(
            `${BASE()}/client-contracts/next-number?enterpriseId=${enterpriseId}&year=${year}`,
            { headers: headers(token) },
        );
        if (!res.ok) throw new Error('Не удалось получить номер');
        return res.json();
    },

    create: async (token: string, body: SaveClientContractPayload): Promise<ClientContract> => {
        const res = await fetch(`${BASE()}/client-contracts`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await readError(res, 'Ошибка создания договора'));
        return res.json();
    },

    update: async (
        token: string,
        id: number,
        body: Partial<SaveClientContractPayload>,
    ): Promise<ClientContract> => {
        const res = await fetch(`${BASE()}/client-contracts/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await readError(res, 'Ошибка сохранения договора'));
        return res.json();
    },

    delete: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/client-contracts/${id}`, {
            method: 'DELETE',
            headers: headers(token),
        });
        if (!res.ok) throw new Error(await readError(res, 'Ошибка удаления договора'));
    },

    saleCandidates: async (
        token: string,
        contractId: number,
        lineType: 'item' | 'order',
        lineId: number,
    ): Promise<ContractSaleCandidate[]> => {
        const res = await fetch(
            `${BASE()}/client-contracts/${contractId}/sale-candidates?lineType=${lineType}&lineId=${lineId}`,
            { headers: headers(token) },
        );
        if (!res.ok) throw new Error(await readError(res, 'Не удалось загрузить документы'));
        return res.json();
    },

    attachSale: async (
        token: string,
        contractId: number,
        body: { lineType: 'item' | 'order'; lineId: number; saleDocId?: number | null },
    ): Promise<ClientContract> => {
        const res = await fetch(`${BASE()}/client-contracts/${contractId}/attach-sale`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await readError(res, 'Не удалось привязать документ'));
        return res.json();
    },

    createSale: async (
        token: string,
        contractId: number,
        body: { userId: number; itemLineIds?: number[] },
    ): Promise<{ documents: { id: number; documentType: string }[]; contract: ClientContract }> => {
        const res = await fetch(`${BASE()}/client-contracts/${contractId}/create-sale`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await readError(res, 'Не удалось создать документ продажи'));
        return res.json();
    },
};
