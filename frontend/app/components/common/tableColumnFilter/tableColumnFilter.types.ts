export type ColumnFilterState<K extends string = string> = Record<K, string>;

export type ColumnFilterGetters<T, K extends string = string> = Record<
    K,
    (row: T) => string
>;
