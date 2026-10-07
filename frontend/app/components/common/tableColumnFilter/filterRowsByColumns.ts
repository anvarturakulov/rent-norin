import type { ColumnFilterGetters, ColumnFilterState } from './tableColumnFilter.types';

export type ColumnFilterMatchers<K extends string = string> = Partial<
    Record<K, (value: string, query: string) => boolean>
>;

export type FilterRowsByColumnsOptions<K extends string = string> = {
    matchers?: ColumnFilterMatchers<K>;
};

export function filterRowsByColumns<T, K extends string>(
    rows: T[],
    filters: ColumnFilterState<K>,
    getters: ColumnFilterGetters<T, K>,
    options?: FilterRowsByColumnsOptions<K>,
): T[] {
    const activeKeys = (Object.keys(filters) as K[]).filter(
        (key) => (filters[key] ?? '').trim() !== '',
    );

    if (activeKeys.length === 0) {
        return rows;
    }

    return rows.filter((row) =>
        activeKeys.every((key) => {
            const query = (filters[key] ?? '').trim();
            const value = getters[key]?.(row) ?? '';
            const matcher = options?.matchers?.[key];
            if (matcher) {
                return matcher(value, query);
            }
            return value.toLowerCase().includes(query.toLowerCase());
        }),
    );
}
