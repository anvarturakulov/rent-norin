'use client'
import { TmcMaterialNormsItemProps } from './tmcMaterialNormsItem.props';
import styles from './tmcMaterialNormsItem.module.css';
import { Htag } from '@/app/components';
import { numberValue } from '@/app/service/common/converters';
import cn from 'classnames';
import { useEffect, useState } from 'react';

export const TmcMaterialNormsItem = ({className, item,  ...props }: TmcMaterialNormsItemProps) :JSX.Element => {
    
    const [materialNorms, setMaterialNorms] = useState<Array<any>>([])

    useEffect(()=> {
        if (item?.materialNorms && item?.materialNorms.length) {
            setMaterialNorms([...item.materialNorms])
        }
    }, [item?.materialNorms])

    return (
       <>
          <div className={styles.item}>
            <Htag tag='h1' className={styles.topTitle}>
                <div>{item?.productName}</div>
                {item?.unit && <div className={cn(styles.topTitleUnit, styles.blue)}>
                    ({item.unit})
                </div>}
            </Htag>
            <div className={styles.row}>
                <div className={cn(styles.title, styles.topRow)}>Материал номи</div>
                <div className={cn(styles.title, styles.topRow, styles.value)}>Норма</div>
                <div className={cn(styles.title, styles.topRow, styles.value)}>Ўлчов бирлиги</div>
            </div>
            {
                materialNorms.length > 0 ? (
                    materialNorms
                    .map((material: any, key:number) => {
                        const {materialName, quantityPerUnit, unit} = material
                        return (
                            <div className={styles.row} key={key}>
                                <div className={styles.title}>{materialName}</div>
                                <div className={cn(styles.value, styles.green)}>{numberValue(quantityPerUnit)}</div>
                                <div className={styles.value}>{unit || '-'}</div>
                            </div>
                        )
                    })
                ) : (
                    <div className={styles.emptyMessage}>
                        Материаллар нормаси топилмади
                    </div>
                )
            }
          </div>
      </>
    )
}

