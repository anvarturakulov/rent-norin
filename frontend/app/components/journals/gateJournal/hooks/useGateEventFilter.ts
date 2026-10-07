import { useMemo } from 'react';
import { FilterForGateJournal, SortConfig } from '../constants';

interface GateEvent {
    id: number;
    plateNumber: string;
    eventType: 'income' | 'outcome';
    eventTime: string | number | bigint;
    cameraIp: string;
    vehicleType?: string;
    vehicleColor?: string;
    imagePath?: string;
    gateAction: 'opened' | 'denied' | 'pending';
    denialReason?: string;
    leaveProdDocument?: {
        id: number;
        docNumber?: string;
    };
}

const filterEvents = (
    events: GateEvent[],
    filter: FilterForGateJournal,
    sortConfig: SortConfig
): GateEvent[] => {
    if (!events || !Array.isArray(events)) {
        return [];
    }

    let filtered = events.filter(event => {
        // Фильтрация по гос номеру
        if (filter.plateNumber !== 'Гос. номер' && filter.plateNumber.trim()) {
            const plateNumber = event.plateNumber?.toLowerCase() || '';
            const filterValue = filter.plateNumber.toLowerCase();
            if (!plateNumber.includes(filterValue)) {
                return false;
            }
        }

        // Фильтрация по цвету
        if (filter.vehicleColor !== 'Цвет' && filter.vehicleColor.trim()) {
            const vehicleColor = event.vehicleColor?.toLowerCase() || '';
            const filterValue = filter.vehicleColor.toLowerCase();
            if (!vehicleColor.includes(filterValue)) {
                return false;
            }
        }

        // Фильтрация по типу авто
        if (filter.vehicleType !== 'Тип авто' && filter.vehicleType.trim()) {
            const vehicleType = event.vehicleType?.toLowerCase() || '';
            const filterValue = filter.vehicleType.toLowerCase();
            if (!vehicleType.includes(filterValue)) {
                return false;
            }
        }

        return true;
    });

    // Сортировка
    filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.field) {
            case 'eventTime':
                aValue = typeof a.eventTime === 'string' ? parseInt(a.eventTime, 10) : Number(a.eventTime);
                bValue = typeof b.eventTime === 'string' ? parseInt(b.eventTime, 10) : Number(b.eventTime);
                break;
            case 'plateNumber':
                aValue = a.plateNumber?.toLowerCase() || '';
                bValue = b.plateNumber?.toLowerCase() || '';
                break;
            case 'vehicleType':
                aValue = a.vehicleType?.toLowerCase() || '';
                bValue = b.vehicleType?.toLowerCase() || '';
                break;
            case 'vehicleColor':
                aValue = a.vehicleColor?.toLowerCase() || '';
                bValue = b.vehicleColor?.toLowerCase() || '';
                break;
            default:
                return 0;
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    return filtered;
};

export const useGateEventFilter = (
    events: GateEvent[] | undefined,
    filter: FilterForGateJournal,
    sortConfig: SortConfig
) => {
    return useMemo(() => {
        if (!events || !Array.isArray(events)) {
            return [];
        }
        
        return filterEvents(events, filter, sortConfig);
    }, [events, filter, sortConfig]);
};
