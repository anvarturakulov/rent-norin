'use client'
import { AktSverkaProps } from './aktSverka.props';
import { AktSverkaItem } from './aktSverkaItem/aktSverkaItem';
import styles from './aktSverka.module.css';
import { useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';

export const AktSverka = ({className, ...props }: AktSverkaProps) :JSX.Element => {
    const { setMainData, mainData } = useAppContext()
    const { aktSverka, reportOption } = mainData.report
    const { firstReferenceId } = reportOption;

    const { user } = mainData.users;
    const token = user?.token;
    const urlReferences = process.env.NEXT_PUBLIC_DOMAIN+'/api/references/all/';

    const { data : references, mutate: mutateReferences, isLoading: isLoadingReferences } = useSWR(urlReferences, (urlReferences) => getDataForSwr(urlReferences, token));

    // Проверяем, выбран ли партнер
    const isPartnerSelected = firstReferenceId !== null && firstReferenceId !== undefined && firstReferenceId !== 0;

    // let datas = data ? data.filter((item: any) => item?.reportType == `CASHOPERATIONS`)[0]?.values : []

    // useEffect(()=> {
    //     console.log(references)
    // }, [references])

    let datas = aktSverka ? aktSverka?.values : []
    
    // Сортируем данные по полю name
    const sortedDatas = datas.sort((a: any, b: any) => {
        if (a.name && b.name) {
            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        }
        return 0;
    });
    
    const reportTitle = `Акт сверка`;
    
    return (
       <div className={styles.sectionContainer}>
            {
                !isPartnerSelected ? (
                    <div className={styles.noData}>Хамкорни танланг</div>
                ) : !aktSverka ? (
                    <div className={styles.noData}>Загрузка данных...</div>
                ) : sortedDatas && sortedDatas.length > 0 ? (
                    sortedDatas.map((element: any, key: number) => {
                        return <AktSverkaItem 
                            key={key}
                            item={element}
                            references={references}
                        />
                    })
                ) : (
                    <div className={styles.noData}>Нет данных для отображения</div>
                )
            }
       </div>
    )
}
