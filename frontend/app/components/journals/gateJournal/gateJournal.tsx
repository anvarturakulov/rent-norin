'use client'
import React, { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import cn from 'classnames';
import styles from './gateJournal.module.css';
import { GateJournalProps } from './gateJournal.props';
import Header from '../../common/header/header';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getTodayRange } from '@/app/service/common/dateRanges';
import Footer from '../../common/footer/footer';
import { dashboardUsersList } from '@/app/interfaces/user.interface';
import LoadingIco from '@/app/components/common/loading.svg';
import loadingStyles from '@/app/components/common/loading.module.css';
import { GateTableRow } from './components/GateTableRow';
import { DEFAULT_FILTER, FILTER_CONFIG, FilterForGateJournal, SortConfig, SortField } from './constants';
import { useGateEventFilter } from './hooks/useGateEventFilter';
import { exportGateFolder } from '@/app/service/gateEvents/exportGate';
import { UserRoles } from '@/app/interfaces/user.interface';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TablePagination,
} from '@/app/components/common/tablePagination/TablePagination';

interface GateEvent {
    id: number;
    plateNumber: string;
    eventType: 'income' | 'outcome';
    eventTime: string | number | bigint;
    cameraIp: string;
    vehicleType?: string;
    vehicleColor?: string;
    imagePath?: string;
    plateImagePath?: string;
    gateAction: 'opened' | 'denied' | 'pending';
    denialReason?: string;
    leaveProdDocument?: {
        id: number;
        docNumber?: string;
        docTableItems?: Array<{
            id: number;
            analiticReference?: {
                name: string;
            };
        }>;
    };
}

const buildUrl = (contentName: string, dateStartForUrl: number, dateEndForUrl: number) => {
    const eventType = contentName === 'gate-income' ? 'income' : 'outcome';
    const params = new URLSearchParams({
        direction: eventType,
        dateStart: dateStartForUrl.toString(),
        dateEnd: dateEndForUrl.toString()
    });
    return `${process.env.NEXT_PUBLIC_DOMAIN}/api/gate-events?${params}`;
};

const getTotals = (events: GateEvent[]) => {
    const total = events.length;
    const opened = events.filter(e => e.gateAction === 'opened').length;
    const denied = events.filter(e => e.gateAction === 'denied').length;
    const pending = events.filter(e => e.gateAction === 'pending').length;
    
    return { total, opened, denied, pending };
};

const GateJournal = memo<GateJournalProps>(({ className, ...props }): JSX.Element => {
    
    const {mainData, setMainData} = useAppContext();
    const {dateStart, dateEnd} = mainData.journal.interval;
    const { updateDataForDocumentJournal } = mainData.journal;

    let dateStartForUrl = dateStart
    let dateEndForUrl = dateEnd

    if (!dateStart && !dateEnd) {
        const today = getTodayRange()
        dateStartForUrl = today.start
        dateEndForUrl = today.end
    }
    
    const [filter, setFilter] = useState<FilterForGateJournal>(DEFAULT_FILTER);
    const [tablePage, setTablePage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        field: 'eventTime',
        direction: 'desc'
    });
    
    const { user } = mainData.users;
    const { contentName } = mainData.document;
    const role = user?.role;
    const dashboardUsers = role && dashboardUsersList.includes(role);

    const token = user?.token;
    const url = buildUrl(contentName, dateStartForUrl, dateEndForUrl);

    const swrKey = `${url}-${dateStartForUrl}-${dateEndForUrl}`;
    const { data : events, mutate, isLoading } = useSWR(swrKey, () => getDataForSwr(url, token));

    useEffect(() => {
        mutate()
        setMainData && setMainData('updateDataForDocumentJournal', false);
    }, [updateDataForDocumentJournal, dateStart, dateEnd])

    const filteredEvents = useGateEventFilter(events, filter, sortConfig);

    const filterKey = useMemo(() => JSON.stringify(filter), [filter]);
    const sortKey = useMemo(() => JSON.stringify(sortConfig), [sortConfig]);

    useEffect(() => {
        setTablePage(1);
    }, [swrKey, filterKey, sortKey]);

    const filteredEventsLength = filteredEvents?.length ?? 0;
    const gateTotalPages = Math.max(
        1,
        Math.ceil(filteredEventsLength / DEFAULT_TABLE_PAGE_SIZE),
    );

    useEffect(() => {
        if (tablePage > gateTotalPages) {
            setTablePage(gateTotalPages);
        }
    }, [tablePage, gateTotalPages]);

    const pageEvents = useMemo(() => {
        if (!filteredEvents || filteredEvents.length === 0) return [];
        const start = (tablePage - 1) * DEFAULT_TABLE_PAGE_SIZE;
        return filteredEvents.slice(start, start + DEFAULT_TABLE_PAGE_SIZE);
    }, [filteredEvents, tablePage]);

    const { total, opened, denied, pending } = useMemo(() => {
        return getTotals(filteredEvents);
    }, [filteredEvents]);

    const onRefresh = useCallback(() => { mutate(); }, [mutate]);

    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState<string>('');

    const handleExportGate = useCallback(async () => {
        if (!token || role !== UserRoles.ADMINGLOBAL) {
            return;
        }

        setIsExporting(true);
        setExportProgress('');

        try {
            await exportGateFolder(
                token,
                setMainData,
                (message, partNumber, totalParts) => {
                    setExportProgress(message);
                    if (partNumber && totalParts) {
                        const percent = Math.round((partNumber / totalParts) * 100);
                        setExportProgress(`${message} (${percent}%)`);
                    }
                }
            );
        } catch (error: any) {
            console.error('Ошибка экспорта:', error);
        } finally {
            setIsExporting(false);
            setExportProgress('');
        }
    }, [token, role, setMainData]);

    const changeFilter = useCallback((target: string) => {
        const config = FILTER_CONFIG[target as keyof typeof FILTER_CONFIG];
        if (!config) return;
        
        const currentValue = prompt(config.title) || config.defaultValue;
        
        if (currentValue != null) {
            setFilter(filter => ({
                ...filter,
                [target]: currentValue
            }));
        }
    }, []);

    const handleSort = useCallback((field: SortField) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);

    return (
        <>
            {dashboardUsers && <Header windowFor='gate' total={total} count={opened}/>}  
            
            {
                dashboardUsers &&
                <div className={styles.container} >
                    <div className={styles.header}>
                        <button 
                            className={styles.button} 
                            onClick={onRefresh}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Обновление...' : 'Обновить данные'}
                        </button>
                        {role === UserRoles.ADMINGLOBAL && (
                            <button 
                                className={styles.button} 
                                onClick={handleExportGate}
                                disabled={isExporting || isLoading}
                                title="Скачать всю папку uploads/gate в виде ZIP архива"
                            >
                                {isExporting ? (exportProgress || 'Экспорт...') : 'Скачать папку gate'}
                            </button>
                        )}
                    </div>
                    {isLoading ? (
                        <LoadingIco className={loadingStyles.loadingIco} />
                    ) : (
                        <>
                        <table className={styles.table}>
                            <thead className={styles.thead}>
                                <tr key='-1'>
                                    <th key='1' className={styles.rowId}>ID</th>
                                    <th 
                                        key='2' 
                                        className={cn(styles.rowDate, {
                                            [styles.sortable]: true
                                        })}
                                        onClick={() => handleSort('eventTime')}
                                    >
                                        Дата/Время
                                        {sortConfig.field === 'eventTime' && (
                                            <span className={styles.sortIndicator}>
                                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </th>
                                    <th 
                                        key='3' 
                                        className={cn(styles.rowPlateNumber, {
                                            [styles.red]: filter.plateNumber !== 'Гос. номер'
                                        })}
                                        onDoubleClick={() => changeFilter('plateNumber')}
                                    >
                                        {filter.plateNumber}
                                    </th>
                                    <th 
                                        key='4' 
                                        className={cn(styles.rowVehicleType, {
                                            [styles.red]: filter.vehicleType !== 'Тип авто'
                                        })}
                                        onDoubleClick={() => changeFilter('vehicleType')}
                                    >
                                        {filter.vehicleType}
                                    </th>
                                    <th key='5' className={styles.rowGateAction}>Действие</th>
                                    <th key='6' className={styles.rowDocument}>Документ выезда</th>
                                    <th key='7' className={styles.rowReason}>Причина отказа</th>
                                    <th key='8' className={styles.rowCameraIp}>IP камеры</th>
                                    <th key='9' className={styles.rowPhoto}>Фото авто</th>
                                    <th key='10' className={styles.rowPlatePhoto}>Фото номера</th>
                                </tr>
                            </thead>
                            <tbody className={styles.tbody}>
                                {pageEvents.map((item) => (
                                    <GateTableRow
                                        key={item.id}
                                        item={item}
                                        className={className}
                                    />
                                ))}
                            </tbody>
                        </table>
                        <TablePagination
                            page={tablePage}
                            pageSize={DEFAULT_TABLE_PAGE_SIZE}
                            totalItems={filteredEventsLength}
                            onPageChange={setTablePage}
                        />
                        </>
                    )}
                </div>
            }
            <div className={styles.footer}>
                {dashboardUsers && <Footer windowFor='gate' total={total} count={opened} docCount={denied} totalSecond={pending} totalCost={0} label='Статистика' />} 
            </div>
        </>
    );
});

GateJournal.displayName = 'GateJournal';

export default GateJournal;
