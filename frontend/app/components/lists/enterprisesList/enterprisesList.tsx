'use client'
import styles from './enterprisesList.module.css';
import cn from 'classnames';
import IcoTrash from './ico/trash.svg';
import { useEffect } from 'react';
import useSWR from 'swr';
import { useAppContext } from '@/app/context/app.context';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import { getEnterpriseById } from '@/app/service/enterprises/getEnterpriseById';
import { markEnterpriseToDelete } from '@/app/service/enterprises/deleteEnterprise';
import { EnterpriseForm } from '../../enterprise/enterprise';
import { Enterprise } from '@/app/interfaces/enterprise.interface';
import HeaderForEnterprises from '../../common/headerForEnterprises/headerForEnterprises';
import { UserRoles } from '@/app/interfaces/user.interface';

interface EnterprisesListProps {
    className?: string;
}

export default function EnterprisesList({ className }: EnterprisesListProps): JSX.Element {
    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users;
    const { updateDataForEnterpriseJournal } = mainData.journal || {};
    const { showEnterpriseWindow } = mainData.enterprises || { showEnterpriseWindow: false };

    const token = user?.token;
    const { data, mutate } = useSWR(
        token ? 'enterprises' : null,
        () => getEnterprises(token)
    );

    useEffect(() => {
        mutate();
        if (setMainData) {
            setMainData('updateDataForEnterpriseJournal', false);
        }
    }, [showEnterpriseWindow, updateDataForEnterpriseJournal]);

    const handleGetEnterprise = async (id: number | undefined) => {
        if (!id) return;
        if (setMainData) {
            setMainData('isNewEnterprise', false);
            setMainData('clearControlElements', false);
        }
        const enterprise = await getEnterpriseById(id, token);
        if (enterprise && setMainData) {
            setMainData('currentEnterprise', enterprise);
            setMainData('showEnterpriseWindow', true);
        }
    };

    const handleDeleteEnterprise = async (id: number | undefined) => {
        if (!id) return;
        if (confirm('Вы уверены, что хотите пометить это предприятие на удаление?')) {
            await markEnterpriseToDelete(id, token, setMainData);
            mutate();
        }
    };

    return (
        <>
            <HeaderForEnterprises />
            <div className={styles.newElement}>
                <EnterpriseForm />
            </div>
            <div className={styles.container}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            <th className={styles.id}>№</th>
                            <th>Название</th>
                            <th>Код</th>
                            <th>Активно</th>
                            <th className={styles.rowAction}>Амал</th>
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {data &&
                            data.length > 0 &&
                            data.map((item: Enterprise, key: number) => {
                                return (
                                    <tr
                                        key={item.id}
                                        onDoubleClick={() => handleGetEnterprise(item.id)}
                                        className={cn(className, {
                                            [styles.inactive]: !item.isActive,
                                        })}
                                    >
                                        <td className={styles.id}>{item.id}</td>
                                        <td>{item.name}</td>
                                        <td>{item.code}</td>
                                        <td>{item.isActive ? 'Да' : 'Нет'}</td>
                                        <td className={styles.rowAction}>
                                            {(user?.role === UserRoles.ADMINGLOBAL) && (
                                                <IcoTrash
                                                    className={cn(className, styles.icoTrash)}
                                                    onClick={() => handleDeleteEnterprise(item.id)}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </>
    );
}

