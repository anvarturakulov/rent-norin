'use client'
import { NormaItemProps } from './normaItem.props';
import styles from './normaItem.module.css';
import { Htag } from '@/app/components';
import { numberValue } from '@/app/service/common/converters';
import cn from 'classnames';
import { useEffect, useState } from 'react';

export const NormaItem = ({className, item,  ...props }: NormaItemProps) :JSX.Element => {
    
    const [data, setData] = useState<Array<any>>([])

    useEffect(()=> {
        if (item?.items && item?.items.length) {
            setData([...item.items])
        }
    }, [item?.items])

    return (
       <>
          <div className={styles.item}>
            <Htag tag='h1' className={styles.topTitle}>
                <div>{item?.section}</div>
                <div className={cn(styles.topTitleCount, styles.blue, {
                    [styles.red]: !item?.countHamirs,
                })}>{item?.countHamirs ? `${item?.countHamirs} та хамир` : '**?**' }</div>
            </Htag>
            <div className={styles.row}>
                <div className={cn(styles.title, styles.topRow)}>Ном</div>
                <div className={cn(styles.title, styles.topRow, styles.value)}>Хакикат</div>
                <div className={cn(styles.title, styles.topRow, styles.value)}>Норма</div>
                <div className={cn(styles.title, styles.topRow, styles.value)}>Фарк</div>
            </div>
            {/* <Htag tag='h2' className={styles.h2}>Сон буйича</Htag> */}
            {

                data
                .map((elem: any, key:number) => {
                    const {name, rasxod, norma, farq} = elem
                    return (
                        <div className={styles.row} key={key}>
                            <div className={styles.title}>{name}</div>
                            <div className={styles.value}>{numberValue(rasxod)}</div>
                            <div className={cn(styles.value, styles.green)}>{numberValue(norma)}</div>
                            <div className={cn(styles.value, {
                                [styles.red]: farq < 0,
                                [styles.blue]: farq > 0
                            })}>{numberValue(farq)}</div>
                        </div>
                    )
                })

            }
          </div>
      </>
    )
} 