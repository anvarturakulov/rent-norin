'use client'
import styles from './taking.module.css';
import { TakingItem } from './takingItem/takingItem';
import { TakingProps } from './taking.props';
import { useEffect } from 'react';
import { numberValue } from '@/app/service/common/converters';
import { totalByKey } from '../../utils/calculations';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const Taking = ({className, data, currentSection, ...props }: TakingProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    
    useEffect(()=> {
    }, [data])
    
    let datas = data ? data.filter((item: any) => item?.reportType == 'TAKING')[0]?.values : []
    
    return (
       <>
            <div className={styles.title}>
                {'ЦЕХ ВА ЮК ЕТКАЗИБ БЕРУВЧИЛАР ТОПШИРГАН ПУЛЛАРИ'}
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <td>Булим</td>
                        <td>Топширган пули</td>
                    </tr>
                </thead>
                
                {
                    datas && datas.length &&
                    datas
                    .map((element: any, key: number) => {
                        return <TakingItem 
                            key={key}
                            item={element}
                        />
                    })
                }   
            
                <thead>
                    <tr>
                        <td >Жами</td>
                        <td className={styles.totalTd}>{numberValue(totalByKey('taking', datas))}</td>
                    </tr>
                </thead>
                
            </table>
            
       </>
    )
} 