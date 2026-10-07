'use client'
import { CashProps } from './cash.props';
import { CashItem } from './cashItem/cashItem';
import styles from './cash.module.css';
import { useEffect } from 'react';
import { numberValue } from '@/app/service/common/converters';

const activeOnly = (v: unknown) => Math.max(0, Number(v) || 0);

export const Cash = ({className, data, ...props }: CashProps) :JSX.Element => {
    
    useEffect(()=> {

    }, [data])
    
    const cashValues = data?.cashValues ?? [];

    const totalStartBalans = cashValues.reduce((acc: number, el: any) => acc + activeOnly(el?.startBalans), 0)
    const totalEndBalans = cashValues.reduce((acc: number, el: any) => acc + activeOnly(el?.endBalans), 0)
    

    return (
       <div>
            <div className={styles.title}>Касса колдиги</div>
            <table className={styles.table}>
                <thead className={styles.thead}>
                    <tr>
                        <td>№</td>
                        <td>Номи</td>
                        <td>Бошл. кол. сумма</td>
                        <td>Охирги кол. сумма</td>
                    </tr>
                </thead>
                <tbody>
                    {   
                        cashValues && cashValues.length  ? (
                            cashValues.map((element: any, key: number) => {
                                return <CashItem key={key} item={element} index={key} />
                            })
                        ) : null
                    }
                    <tr>
                        <td className={styles.totalTd}></td>
                        <td className={styles.totalTd}>Жами</td>
                        <td className={styles.totalTd}>{numberValue(totalStartBalans)}</td>
                        <td className={styles.totalTd}>{numberValue(totalEndBalans)}</td>
                    </tr>
                </tbody>
            </table>
       </div>
    )
} 

