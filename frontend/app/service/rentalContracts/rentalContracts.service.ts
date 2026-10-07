import type {
    RentalContract,
    SaveRentalContractPayload,
} from '@/app/interfaces/rentalContract.interface';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';

const BASE = () => withApiDomain('/api');

const headers = (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
});

export const rentalContractsApi = {
    list: async (
        token: string,
        enterpriseId?: number,
        clientId?: number,
        dateStart?: number,
        dateEnd?: number,
    ): Promise<RentalContract[]> => {
        const params = new URLSearchParams();
        if (enterpriseId != null) params.set('enterpriseId', String(enterpriseId));
        if (clientId != null) params.set('clientId', String(clientId));
        if (dateStart != null) params.set('dateStart', String(dateStart));
        if (dateEnd != null) params.set('dateEnd', String(dateEnd));
        const q = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${BASE()}/rental-contracts${q}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Не удалось загрузить договоры аренды');
        return res.json();
    },

    getOne: async (token: string, id: number): Promise<RentalContract> => {
        const res = await fetch(`${BASE()}/rental-contracts/${id}`, { headers: headers(token) });
        if (!res.ok) throw new Error('Договор аренды не найден');
        return res.json();
    },

    getActiveByClient: async (
        token: string,
        clientId: number,
        asOf?: number,
    ): Promise<RentalContract | null> => {
        const q = asOf != null ? `?asOf=${asOf}` : '';
        const res = await fetch(
            `${BASE()}/rental-contracts/by-client/${clientId}/active${q}`,
            { headers: headers(token) },
        );
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Не удалось загрузить договор аренды');
        const data = await res.json();
        return data && data.id ? data : null;
    },

    previewNumber: async (
        token: string,
        enterpriseId: number,
        year: number,
    ): Promise<{ contractNumber: string }> => {
        const res = await fetch(
            `${BASE()}/rental-contracts/next-number?enterpriseId=${enterpriseId}&year=${year}`,
            { headers: headers(token) },
        );
        if (!res.ok) throw new Error('Не удалось получить номер');
        return res.json();
    },

    create: async (
        token: string,
        body: SaveRentalContractPayload,
    ): Promise<RentalContract> => {
        const res = await fetch(`${BASE()}/rental-contracts`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const t = await res.text();
            throw new Error(t || 'Ошибка создания договора');
        }
        return res.json();
    },

    update: async (
        token: string,
        id: number,
        body: Partial<SaveRentalContractPayload>,
    ): Promise<RentalContract> => {
        const res = await fetch(`${BASE()}/rental-contracts/${id}`, {
            method: 'PATCH',
            headers: headers(token),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const t = await res.text();
            throw new Error(t || 'Ошибка сохранения договора');
        }
        return res.json();
    },

    delete: async (token: string, id: number): Promise<void> => {
        const res = await fetch(`${BASE()}/rental-contracts/${id}`, {
            method: 'DELETE',
            headers: headers(token),
        });
        if (!res.ok) {
            let message = 'Ошибка удаления договора';
            try {
                const body = await res.json();
                if (typeof body?.message === 'string') message = body.message;
                else if (Array.isArray(body?.message)) message = body.message.join(', ');
            } catch {
                const text = await res.text().catch(() => '');
                if (text) message = text;
            }
            throw new Error(message);
        }
    },

    deleteAll: async (
        token: string,
        enterpriseId?: number | null,
    ): Promise<{ deleted: number }> => {
        const params = new URLSearchParams();
        if (enterpriseId != null) params.set('enterpriseId', String(enterpriseId));
        const q = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${BASE()}/rental-contracts/all${q}`, {
            method: 'DELETE',
            headers: headers(token),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(t || 'Ошибка удаления договоров');
        }
        return res.json();
    },
};
