'use client'
import { MaterialProps } from './material.props';
import styles from './material.module.css';
import { MaterialItem } from './materialItem/materialItem';
import { useEffect } from 'react';
import { numberValue } from '@/app/service/common/converters';
import { totalByKey } from '../../utils/calculations';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const Material = ({className, data, ...props }: MaterialProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    let title = 'УМУМ ХОМ АШЁ ЧИКИМИ' 
    
    useEffect(()=> {
    }, [data])
    
    let datas = data ? data.filter((item: any) => item?.reportType == 'MATERIAL')[0]?.values : []

    return (
       <>
            <div className={styles.title}>
            {'УМУМ КОРХОНА БУЙИЧА ХОМ АШЁ ЧИКИМИ'}
            {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <td>Махсулот</td>
                        <td>Сон</td>
                        <td>Сумма</td>
                    </tr>
                </thead>
                
                {
                    datas && datas.length &&
                    datas
                    .map((element: any, key: number) => {
                        return <MaterialItem 
                            key={key}
                            item={element}
                        />
                    })
                }   
            
                <thead>
                    <tr>
                        <td>Жами</td>
                        <td></td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('summa', datas))}</td>
                    </tr>
                </thead>
                
            </table>            
       </>
    )
} 