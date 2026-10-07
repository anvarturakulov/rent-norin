/** Пропорционально ценам заказов (как на бэкенде) — предпросмотр в форме */
export function distributeClientContractExpenses(
    orderPrices: number[],
    expenseTotal: number,
): number[] {
    const n = orderPrices.length;
    const zeros = () => Array.from({ length: n }, () => 0);
    if (n === 0) return [];
    const exp = Number(expenseTotal) || 0;
    if (exp <= 0) return zeros();
    const prices = orderPrices.map((p) => Math.max(0, Number(p) || 0));
    const S = prices.reduce((a, b) => a + b, 0);
    if (S <= 0) return zeros();
    const out = prices.map((p) => Math.round(((exp * p) / S) * 100) / 100);
    const drift =
        Math.round((exp - out.reduce((a, b) => a + b, 0)) * 100) / 100;
    if (drift !== 0) {
        let idx = -1;
        for (let i = n - 1; i >= 0; i--) {
            if (prices[i] > 0) {
                idx = i;
                break;
            }
        }
        if (idx >= 0) {
            out[idx] = Math.round((out[idx] + drift) * 100) / 100;
        }
    }
    return out;
}
