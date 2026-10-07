'use client'
import { CashOperationsProps } from './cashOperations.props';
import styles from './cashOperations.module.css';
import { CashOperationsItem } from './cashOperationsItem/cashOperationsItem';
import { useEffect } from 'react';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import useSWR from 'swr';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const CashOperations = ({className, data, currentSection, ...props }: CashOperationsProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    let title = 'КАССА ОПЕРАЦИЯЛАР'

    const {mainData} = useAppContext();
    const { user } = mainData.users;
    const token = user?.token;
    const urlReferences = process.env.NEXT_PUBLIC_DOMAIN+'/api/references/all/';

    const { data : references, mutate: mutateReferences, isLoading: isLoadingReferences } = useSWR(urlReferences, (urlReferences) => getDataForSwr(urlReferences, token));

    let datas = data ? data.filter((item: any) => item?.reportType == `CASHOPERATIONS`)[0]?.values : []

    useEffect(()=> {
        console.log(datas)
    }, [datas])

    return (
       <>
            <div className={styles.title}>
                {title}
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <div className={styles.itemsBox}>
                {
                    datas && datas.length &&
                    datas
                    .filter((item:any) => {
                        if (currentSection) return currentSection == item.section
                        return true
                    })
                    .map((element: any, key: number) => {
                        return <CashOperationsItem 
                            key={key}
                            item={element}
                            references={references}
                        />
                    })
                }  
            </div>
       </>
    )
} 