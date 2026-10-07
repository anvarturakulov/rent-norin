'use client'
import { SvodProps } from './svod.props';
import styles from './svod.module.css';
import { useEffect, useMemo } from 'react';
import { Static } from './static/static';
import { Partners } from './partners/partners';
import { Cash } from './cash/cash';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const Svod = ({className, data, ...props }: SvodProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    
    // Мемоизируем данные, чтобы избежать лишних перерисовок
    const datas = useMemo(() => {
        return data ? data.filter((item: any) => item?.reportType == 'SVOD')[0] : null;
    }, [data]);
    
    if (!datas) {
        return (
            <div className={styles.title}>
                Умум жамланма - маълумотлар топилмади
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
        )
    }

    return (
       <>
            <div className={styles.title}>
                Умум жамланма
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <div className={styles.box}>
                <Static data={datas}/>
                <Cash data={datas}/>
            </div>
            <div className={styles.boxPartners}>
                <Partners data={datas} dataType="clients"/>
                <Partners data={datas} dataType="suppliers"/>
                <Partners data={datas} dataType="departments"/>
            </div>

       </>
    )
} 

