'use client'
import { CostProps } from './cost.props';
import { CostItem } from './costItem/costItem';
import styles from './cost.module.css';
import { useEffect } from 'react';
import { numberValue } from '@/app/service/common/converters';

const totalByKey = (key:string, data:any[]) => {
    let total = 0;
    data && data.length &&
    data.forEach((item:any) => {
        let totalInner = 0
        if (item.subItems && item.subItems.length) {
            item.subItems.forEach((elem: any) => {
                totalInner += elem[key]
            })
        }
        total += totalInner
    })
    return total
  }

export const Cost = ({className, data, ...props }: CostProps) :JSX.Element => {
    
    useEffect(()=> {

    }, [data])
    
    const costValues = data?.costValues ?? [];
    // const 
    const totalCount = totalByKey('productionCount', costValues)
    const totalHamirCount = totalByKey('comeProductDocsByProduct', costValues)
    const totalSale = totalByKey('saleWithMove', costValues)
    const totalEarning = totalByKey('earning', costValues)

    return (
       <>
            <div className={styles.title}>Таннарх буйича маълумот</div>
            <table className={styles.table}>
                <thead className={styles.thead}>
                    <tr>
                        <td>№</td>
                        <td>Цех номи</td>
                        <td>Ишлаб чикар. сон</td>
                        <td>Хамир сони</td>
                        <td>Жами савдо</td>
                        <td>Жами харажат</td>
                        <td>Жами фойда</td>
                        <td>Таннарх</td>
                    </tr>
                </thead>
                <tbody>
                    {   
                        costValues && costValues.length ? (
                            costValues.map((element: any, key: number) => {
                                return <CostItem key={key} item={element} index={key} />
                            })
                        ) : null
                    }
                    <tr>
                        <td className={styles.totalTd}></td>
                        <td className={styles.totalTd}>Жами</td>
                        <td className={styles.totalTd}>{numberValue(totalCount)}</td>
                        <td className={styles.totalTd}>{numberValue(totalHamirCount)}</td>
                        <td className={styles.totalTd}>{numberValue(totalSale)}</td>
                        <td className={styles.totalTd}>{numberValue(totalSale - totalEarning)}</td>
                        <td className={styles.totalTd}>{numberValue(totalEarning)}</td>
                        <td className={styles.totalTd}></td>
                    </tr>
                </tbody>
                
            </table>
            
       </>
    )
} 

