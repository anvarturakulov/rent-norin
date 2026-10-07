'use client'
import { CashProps } from './cash.props';
import { CashItem } from './cashItem/cashItem';
import styles from './cash.module.css';
import { useContext, useEffect, useState } from 'react';
import { numberValue } from '@/app/service/common/converters';
import { totalByKey } from '../../utils/calculations';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';



export const Cash = ({className, data, ...props }: CashProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    
    useEffect(()=> {
        console.log(data)
    }, [data])
    
    let datas = data ? data.filter((item: any) => item?.reportType == 'CASH')[0]?.values : []

    // Разделяем данные на две группы по названию секции
    const usdData = datas ? datas.filter((item: any) => 
        item?.section?.toLowerCase().includes('валют') || 
        item?.section?.toLowerCase().includes('usd') ||
        item?.section?.toLowerCase().includes('доллар')
    ) : [];
    const nonUsdData = datas ? datas.filter((item: any) => 
        !item?.section?.toLowerCase().includes('валют') && 
        !item?.section?.toLowerCase().includes('usd') &&
        !item?.section?.toLowerCase().includes('доллар')
    ) : [];

    return (
       <>
            
            
            <div className={styles.title}>
                 КАССА ЖАДВАЛ (СУМ)
                 {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <td className={styles.titleTd}>Цех</td>
                        <td>Бошлангич колдик</td>
                        <td>Мижозлар. кирим</td>
                        <td>Ички корхона. кирим</td>
                        <td>Силжишдан кирим</td>
                        <td>Жами кирим</td>
                        <td>Харажат килинди</td>
                        <td>Таъминот. берилди</td>
                        <td>Ички корхонагаберилди</td>
                        <td>Силжишга чиким</td>
                        <td>Таъсисчига берилди</td>
                        <td>Жами чиким</td>
                        <td>Охирги колдик</td>
                    </tr>
                </thead>
                {   
                    nonUsdData && nonUsdData.length &&
                    nonUsdData
                    .map((element: any, key: number) => {
                        return <CashItem key={key} item={element} />
                    })
                }
                <thead>
                    <tr>
                        <td>Жами (СУМ)</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('startBalans', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('incomeFromClients', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('incomeFromDepartments', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('moveIncome', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('allIncome', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('outForCharges', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('outForSuppliers', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('outForDepartments', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('moveOut', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('outForFounder', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('allOut', nonUsdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('endBalans', nonUsdData))}</td>
                    </tr>
                </thead>
            </table>

            <div className={styles.title}>
                 КАССА ЖАДВАЛ (Валютный)
                 {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <td className={styles.titleTd}>Цех</td>
                        <td>Бошлангич колдик</td>
                        <td>Мижозлар. кирим</td>
                        <td>Ички корх. кирим</td>
                        <td>Силжишдан кирим</td>
                        <td>Жами кирим</td>
                        <td>Харажат килинди</td>
                        <td>Таъминот. берилди</td>
                        <td>Ички корхонага берилди</td>
                        <td>Майдалашга чиким</td>
                        <td>Таъсисчига берилди</td>
                        <td>Жами чиким</td>
                        <td>Охирги колдик</td>
                    </tr>
                </thead>
                {   
                    usdData && usdData.length &&
                    usdData
                    .map((element: any, key: number) => {
                        return <CashItem key={key} item={element} />
                    })
                }
                <thead>
                    <tr>
                        <td>Жами (USD)</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('startBalans', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('incomeFromClients', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('incomeFromDepartments', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('moveIncome', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('allIncome', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('outForCharges', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('outForSuppliers', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('outForDepartments', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('moveOut', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('outForFounder', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('allOut', usdData))}</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('endBalans', usdData))}</td>
                    </tr>
                </thead>
            </table>
            
       </>
    )
} 

