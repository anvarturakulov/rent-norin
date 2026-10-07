'use client'
import { NormaProps } from './norma.props';
import styles from './norma.module.css';
import { NormaItem } from './normaItem/normaItem';
import { useEffect } from 'react';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const Norma = ({className, data, currentSection, ...props }: NormaProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    let title = 'ХОМ АШЁЛАРНИНГ НОРМА БУЙИЧА ЧИКИМИ' 
    
    useEffect(()=> {
    }, [data])
    
    let datas = data ? data.filter((item: any) => item?.reportType == 'NORMA')[0]?.values : []

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
                    .map((element: any, key: number) => {
                        return <NormaItem 
                            key={key}
                            item={element}
                        />
                    })
                }
            </div>

             
       </>
    )
} 