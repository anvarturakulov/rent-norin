'use client'
import styles from './giving.module.css';
import { GivingItem} from './givingItem/givingItem';

import { GivingProps } from './giving.props';
import { useEffect, useState } from 'react';
import { numberValue } from '@/app/service/common/converters';
import { totalByKey } from '../../utils/calculations';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const Giving = ({className, data, currentSection, ...props }: GivingProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    
    useEffect(()=> {
    }, [data])
    
    let datas = data ? data.filter((item: any) => item?.reportType == 'GIVING')[0]?.values : []
    
    return (
       <>
            <div className={styles.title}>
                {'НАКД ПУЛ ХАРАЖАТИ'}
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <td>Харажат номи</td>
                        <td>Сумма</td>
                    </tr>
                </thead>
                
                {
                    datas && datas.length &&
                    datas
                    .map((element: any, key: number) => {
                        return <GivingItem 
                            key={key}
                            item={element}
                        />
                    })
                }   
            
                <thead>
                    <tr>
                        <td >Жами</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('giving', datas))}</td>
                    </tr>
                </thead>
                
            </table>
            
       </>
    )
} 