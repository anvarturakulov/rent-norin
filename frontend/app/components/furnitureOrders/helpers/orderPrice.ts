import { getPereodicValueForDate } from '@/app/service/references/getPereodicValueForDate';
import { productNormsApi } from '@/app/service/productNorms/productNorms.service';

/** Иккинчи нарх на дату заявки; при отсутствии — из расчёта норм изделия. */
export async function resolveOrderPriceFromProduct(
    token: string,
    analiticId: number,
    orderDateMs: number,
    enterpriseId?: number | null,
): Promise<number> {
    const periodic = await getPereodicValueForDate(
        analiticId,
        'secondPrice',
        orderDateMs,
        token,
        enterpriseId,
    );
    if (periodic > 0) return periodic;
    try {
        const pricing = await productNormsApi.getPricing(token, analiticId);
        if (pricing.secondPrice > 0) return pricing.secondPrice;
    } catch {
        /* fallback already tried */
    }
    return 0;
}

export function computeOrderTotal(count: number | string, price: number | string): number {
    const c = Number(String(count).replace(',', '.'));
    const p = Number(String(price).replace(',', '.'));
    if (!Number.isFinite(c) || !Number.isFinite(p) || c <= 0 || p < 0) return 0;
    return Math.round(c * p);
}

export function formatOrderAmount(value: number | undefined | null): string {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return Math.round(Number(value)).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

export function formatOrderMoney(value: number | undefined | null): string {
    const formatted = formatOrderAmount(value);
    if (formatted === '—') return formatted;
    return `${formatted} сум`;
}

export function normalizeOrderPrice(value: number | string): number {
    const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
}
