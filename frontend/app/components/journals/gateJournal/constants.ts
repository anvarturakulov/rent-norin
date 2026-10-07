export interface FilterForGateJournal {
    plateNumber: string;
    vehicleColor: string;
    vehicleType: string;
}

export const DEFAULT_FILTER: FilterForGateJournal = {
    plateNumber: 'Гос. номер',
    vehicleColor: 'Цвет',
    vehicleType: 'Тип авто'
}

export const FILTER_CONFIG = {
    plateNumber: { title: 'Гос. номер ?', defaultValue: 'Гос. номер' },
    vehicleColor: { title: 'Цвет ?', defaultValue: 'Цвет' },
    vehicleType: { title: 'Тип авто ?', defaultValue: 'Тип авто' }
} as const;

export type SortField = 'eventTime' | 'plateNumber' | 'vehicleType' | 'vehicleColor';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
    field: SortField;
    direction: SortDirection;
}
