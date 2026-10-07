export function truncateNorma(value: number, decimals = 3): number {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** decimals;
    return Math.trunc(value * factor) / factor;
}

export function normaMatchesAt3Decimals(a: number, b: number): boolean {
    return truncateNorma(a, 3) === truncateNorma(b, 3);
}

export function roundNormaTo4(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 10000) / 10000;
}

/** Норма выработки — не более 3 знаков после запятой (для хранения при импорте) */
export function roundNorma(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 1000) / 1000;
}
