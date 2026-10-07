'use client'
import { OborotkaProps } from './oborotka.props';
import { OborotkaItem } from './oborotkaItem/oborotkaItem';
import styles from './oborotka.module.css';
import { useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/app.context';

export const Oborotka = ({className, ...props }: OborotkaProps) :JSX.Element => {
    const { setMainData, mainData } = useAppContext()
    const { oborotka, reportOption } = mainData.report
    const { firstReferenceId } = reportOption

    useEffect(()=> {
        if (oborotka) {
        }
    }, [oborotka])
    
    let datas = oborotka ? oborotka?.values : []
    
    // Сортируем данные по полю name
    const sortedDatas = datas.sort((a: any, b: any) => {
        if (a.name && b.name) {
            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        }
        return 0;
    });
    
    console.log(sortedDatas)
    
    return (
       <div className={styles.sectionContainer}>
            <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <td >№</td>
                        <td className={styles.titleName}>Номи</td>
                        <td className={styles.titleValue}>Колдик сумма +</td>
                        <td className={styles.titleValue}>Колдик сумма -</td>
                        <td className={styles.titleValue}>Дебет сумма</td>
                        <td className={styles.titleValue}>Кредит сумма</td>
                        <td className={styles.titleValue}>Колдик сумма +</td>
                        <td className={styles.titleValue}>Колдик сумма -</td>
                    </tr>
                </thead>
                {
                    sortedDatas && sortedDatas.length &&
                    sortedDatas
                    .filter((item:any) => {
                        if (firstReferenceId) return item.sectionId == firstReferenceId
                        return true
                    })
                    .map((element: any, key: number) => {
                        return <OborotkaItem 
                            key={key}
                            item={element}
                        />
                    })
                }
                
            </table>
            </div>
       </div>
    )
} 

