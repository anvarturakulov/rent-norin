'use client'
import styles from './pereodicsList.module.css'
import { useEffect, useCallback } from 'react';
import { PereodicListProps } from './pereodicsList.props';
import { useAppContext } from '@/app/context/app.context';
import { PereodicModel } from '@/app/interfaces/reference.interface';
import { markToDeletePereodic } from '@/app/service/references/markToDeletePereodic';
import { getPereodic } from './helpers/pereodics.functions';
import { Pereodic } from '../../pereodic/pereodic';
import PereodicTableRow from './PereodicTableRow';
import { usePereodicsData } from './hooks/usePereodicsData';
import { TABLE_HEADERS, LOADING_MESSAGES } from './constants/table.constants';

export default function PereodicList({className, ...props}: PereodicListProps): JSX.Element {
    const { mainData, setMainData } = useAppContext();
    const { updateDataForPereodicsList } = mainData.pereodic;
    const { referenceIdForPereodicsList, valueNameForPereodicsList } = mainData.pereodic;
    const { user } = mainData.users;
    const token = user?.token;

    const { data: sortedData, mutate, isLoading, error } = usePereodicsData({
        referenceId: referenceIdForPereodicsList,
        valueName: valueNameForPereodicsList,
        token
    });

    // Мемоизируем обработчики событий
    const handleRowDoubleClick = useCallback((id: number | undefined) => {
        if (id) {
            getPereodic(id, setMainData, token);
        }
    }, [setMainData, token]);

    const handleDeleteClick = useCallback((id: number | undefined) => {
        if (id) {
            markToDeletePereodic(id, setMainData, token);
        }
    }, [setMainData, token]);

    useEffect(() => {
        if (updateDataForPereodicsList) {
            mutate();
            setMainData && setMainData('updateDataForPereodicsList', false);
        }
    }, [updateDataForPereodicsList, mutate, setMainData]);

    if (isLoading) {
        return <div className={styles.loadingBox}>{LOADING_MESSAGES.LOADING}</div>;
    }

    if (error) {
        return <div className={styles.loadingBox}>{LOADING_MESSAGES.ERROR}</div>;
    }

    return (
        <>  
            <div className={styles.container}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.rowId}>{TABLE_HEADERS.ID}</th>
                            <th className={styles.date}>{TABLE_HEADERS.DATE}</th>
                            <th className={styles.value}>{TABLE_HEADERS.VALUE}</th>
                            <th className={styles.rowAction}>{TABLE_HEADERS.ACTION}</th>
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {sortedData.map((item: PereodicModel, index: number) => (
                            <PereodicTableRow
                                key={item.id || index}
                                item={item}
                                index={index}
                                className={className}
                                onDoubleClick={handleRowDoubleClick}
                                onDeleteClick={handleDeleteClick}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            <Pereodic />
        </>
    );
}
