export interface ParsedTmzSize {
    length?: number;
    width?: number;
    thickness?: number;
}

/** Парсит refValues.size в геометрию для БАЗИС (мм). */
export function parseTmzSizeForBasis(size?: string | null): ParsedTmzSize {
    if (!size?.trim()) return {};

    const normalized = size
        .trim()
        .replace(/[xX×х*]/g, ' ')
        .replace(/,/g, '.')
        .replace(/[^\d.\s]/g, ' ')
        .trim();

    const nums = normalized
        .split(/\s+/)
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);

    if (nums.length === 0) return {};

    if (nums.length === 1) {
        const n = nums[0];
        if (n <= 100) return { thickness: n };
        return { length: n };
    }

    if (nums.length === 2) {
        const [a, b] = [...nums].sort((x, y) => y - x);
        return { length: a, width: b };
    }

    const sorted = [...nums].sort((a, b) => a - b);
    const thickness = sorted[0];
    const rest = sorted.slice(1).sort((a, b) => b - a);
    return {
        length: rest[0],
        width: rest[1],
        thickness,
    };
}
