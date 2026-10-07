'use client'
import { PartnersProps } from './partners.props';
import { PartnersItem } from './partnersItem/partnersItem';
import styles from './partners.module.css';
import { useEffect } from 'react';
import { splitSignedAmountDisplay } from './splitSignedAmountDisplay';
import { totalByKey } from '../../../utils/calculations';
import { useState } from 'react';

export const Partners = ({className, data, dataType, ...props }: PartnersProps) :JSX.Element => {
    let [partnersValues, setPartnersValues] = useState<any[]>([]);

    useEffect(()=> {
        if (dataType === 'clients') {
            setPartnersValues(data?.clients?.[0]?.values ?? []);
        } else if (dataType === 'departments') {
            setPartnersValues(data?.departments?.[0]?.values ?? []);
        } else if (dataType === 'suppliers') {
            setPartnersValues(data?.suppliers?.[0]?.values ?? []);
        }
    }, [data, dataType])
   

    const totalPOSUM = totalByKey('POSUM', partnersValues)
    const totalTDSUM = totalByKey('TDSUM', partnersValues)
    const totalTKSUM = totalByKey('TKSUM', partnersValues)
    const totalKOSUM = totalPOSUM + totalTDSUM - totalTKSUM

    const totalBoshl = splitSignedAmountDisplay(totalPOSUM)
    const totalOxirgi = splitSignedAmountDisplay(totalKOSUM)

    let title = dataType === 'clients' ? 'Мижозлар' : dataType === 'departments' ? 'Ички корхоналар' : 'Таъминотчилар';
    const comment = '';
    return (
        <div>
            <div className={styles.title}>
                {title} 
                <span>{comment}</span>
            </div>
            <table className={styles.table}>
                <thead className={styles.thead}>
                    <tr>
                        <td rowSpan={2}>№</td>
                        <td rowSpan={2}>Номи</td>
                        <td colSpan={2}>Бошл. кол. сумма</td>
                        <td colSpan={2}>Охирги кол. сумма</td>
                    </tr>
                    <tr>
                        <td className={styles.subHead}>Дт</td>
                        <td className={styles.subHead}>Кт</td>
                        <td className={styles.subHead}>Дт</td>
                        <td className={styles.subHead}>Кт</td>
                    </tr>
                </thead>
                <tbody>
                    {   
                        partnersValues && partnersValues.length  ? (
                            partnersValues.map((element: any, key: number) => {
                                return <PartnersItem key={key} item={element} index={key} />
                            })
                        ) : null
                    }
                    <tr>
                        <td className={styles.totalTd}></td>
                        <td className={styles.totalTd}>Жами</td>
                        <td className={styles.totalTd}>{totalBoshl.plus}</td>
                        <td className={styles.totalTd}>{totalBoshl.minus}</td>
                        <td className={styles.totalTd}>{totalOxirgi.plus}</td>
                        <td className={styles.totalTd}>{totalOxirgi.minus}</td>
                    </tr>
                </tbody>
                
            </table>
        </div>
    )
} 

