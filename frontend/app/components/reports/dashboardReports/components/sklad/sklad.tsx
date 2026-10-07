'use client'
import { SkladProps } from './sklad.props';
import styles from './sklad.module.css';
import { SkladItem } from './skladItem/skladItem';
import { useEffect } from 'react';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const Sklad = ({className, data, currentSection, ...props }: SkladProps) :JSX.Element => {
    let title = 'ХОМ АШЁ КОЛДИГИ' 
    const enterpriseName = useEnterpriseName();
    
    useEffect(()=> {
        console.log('Sklad data:', data);
        console.log('Sklad filtered datas:', datas);
    }, [data])
    
    let datas = data ? data.filter((item: any) => item?.reportType == 'SKLAD')[0]?.values : []

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
                    .filter((item:any) => {
                        if (currentSection) return currentSection == item.sectionId
                        return true
                    })
                    .map((element: any, key: number) => {
                        return <SkladItem 
                            key={key}
                            item={element}
                        />
                    })
                }  
            </div>

            
       </>
    )
} 