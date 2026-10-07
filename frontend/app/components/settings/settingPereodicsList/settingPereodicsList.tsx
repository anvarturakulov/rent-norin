'use client'
import styles from './settingPereodicsList.module.css';
import { useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { SettingPereodicModel } from '@/app/interfaces/settings.interface';
import { deleteSettingPereodic } from '@/app/service/settings/deleteSettingPereodic';
import { SettingPereodic } from '../settingPereodic/settingPereodic';
import { secondsToDateString } from '../../documents/document/doc/helpers/doc.functions';
import IcoTrash from '../../lists/pereodicsList/ico/trash.svg';
import useSWR from 'swr';
import axios from 'axios';

export default function SettingPereodicsList(): JSX.Element {
    const { mainData, setMainData } = useAppContext();
    const {
        updateDataForSettingPereodicsList,
        settingIdForPereodicsList,
        pereodicScopeEnterpriseId,
    } = mainData.settingPereodic;
    const { user } = mainData.users;
    const token = user?.token;

    const url = useMemo(() => {
        if (!settingIdForPereodicsList || settingIdForPereodicsList < 0) return null;
        const params =
            pereodicScopeEnterpriseId != null && Number(pereodicScopeEnterpriseId) > 0
                ? `?enterpriseId=${pereodicScopeEnterpriseId}`
                : '';
        return `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings/${settingIdForPereodicsList}/pereodic${params}`;
    }, [settingIdForPereodicsList, pereodicScopeEnterpriseId]);

    const { data, mutate, error, isLoading } = useSWR(
        url,
        (url) => {
            const config: any = {
                headers: { Authorization: `Bearer ${token}` }
            };
            if (
                pereodicScopeEnterpriseId != null &&
                Number(pereodicScopeEnterpriseId) > 0
            ) {
                config.headers['x-enterprise-id'] = String(pereodicScopeEnterpriseId);
            }
            return axios.get(url, config).then(res => res.data);
        }
    );

    const sortedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return [...data].sort((a: SettingPereodicModel, b: SettingPereodicModel) =>
            (a.date || 0) - (b.date || 0)
        );
    }, [data]);

    const handleRowDoubleClick = useCallback((item: SettingPereodicModel) => {
        if (setMainData) {
            const model: SettingPereodicModel = {
                ...item,
                date: typeof item.date === 'string' ? +item.date : item.date,
            };
            setMainData('currentSettingPereodic', model);
            setMainData('showSettingPereodicWindow', true);
            setMainData('isNewSettingPereodic', false);
        }
    }, [setMainData]);

    const handleDeleteClick = useCallback((item: SettingPereodicModel) => {
        if (item.id && settingIdForPereodicsList > 0) {
            deleteSettingPereodic(settingIdForPereodicsList, item.id, setMainData, token);
        }
    }, [setMainData, token, settingIdForPereodicsList]);

    useEffect(() => {
        if (updateDataForSettingPereodicsList) {
            mutate();
            setMainData && setMainData('updateDataForSettingPereodicsList', false);
        }
    }, [updateDataForSettingPereodicsList, mutate, setMainData]);

    if (isLoading) {
        return <div className={styles.loadingBox}>Юкланмоқда...</div>;
    }

    if (error) {
        return <div className={styles.loadingBox}>Хатолик юз берди</div>;
    }

    return (
        <>
            <div className={styles.container}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.rowId}>№</th>
                            <th className={styles.date}>Сана</th>
                            <th className={styles.value}>Қиймат</th>
                            <th className={styles.rowAction}>Амал</th>
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {sortedData.map((item: SettingPereodicModel, index: number) => (
                            <tr
                                key={item.id || index}
                                onDoubleClick={() => handleRowDoubleClick(item)}
                                className={styles.trRow}
                            >
                                <td className={styles.rowId}>{index + 1}</td>
                                <td className={styles.date}>
                                    {secondsToDateString(Number(item.date))}
                                </td>
                                <td className={styles.value}>{item.value}</td>
                                <td className={styles.rowAction}>
                                    <IcoTrash
                                        className={styles.icoTrash}
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleDeleteClick(item);
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Ўчириш"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <SettingPereodic />
        </>
    );
}
