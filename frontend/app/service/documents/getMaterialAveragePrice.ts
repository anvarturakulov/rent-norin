import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';

const authHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
});

export async function getMaterialAveragePrice(
    materialId: number,
    token: string,
): Promise<number> {
    try {
        const url = withApiDomain(
            `/api/reports/materialAveragePrice?materialId=${materialId}`,
        );
        const res = await axios.get(url, { headers: authHeaders(token) });
        return Number(res.data?.price) || 0;
    } catch {
        return 0;
    }
}

export async function getMaterialAveragePrices(
    materialIds: number[],
    token: string,
): Promise<Record<number, number>> {
    if (!materialIds.length) return {};
    try {
        const url = withApiDomain('/api/reports/materialAveragePrices');
        const res = await axios.post(
            url,
            { materialIds },
            { headers: authHeaders(token) },
        );
        const data = res.data as Record<string, number>;
        const result: Record<number, number> = {};
        for (const [k, v] of Object.entries(data)) {
            result[Number(k)] = Number(v) || 0;
        }
        return result;
    } catch {
        return {};
    }
}
