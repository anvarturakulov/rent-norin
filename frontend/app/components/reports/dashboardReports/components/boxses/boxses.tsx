'use client'
import { BoxsesProps } from './boxses.props';
import { BoxItem } from './boxItem/boxItem';
import styles from './boxses.module.css';
import { useEffect } from 'react';

export const Boxses = ({className, data, ...props }: BoxsesProps) :JSX.Element => {
    
    useEffect(()=> {

    }, [data])
    
    // let datas = data ? data.filter((item: any) => item?.reportType == 'CASH')[0]?.values : []

    const datas = data
    return (
       <div className={styles.boxses}>
            {   
                datas && datas.length &&
                datas
                .map((element: any, key: number) => {
                    return <BoxItem key={element?.title ?? key} item={element} />
                })
            }
       </div>
    )
} 

