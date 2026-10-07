'use client'
import { SkladItemProps } from './materialItem.props';
import styles from './materialItem.module.css';
import { numberValue } from '@/app/service/common/converters';


export const MaterialItem = ({className, key, item,  ...props }: SkladItemProps) :JSX.Element => {
    
    const count = item?.count;
    const summa = item?.summa;
    if (count == 0 && summa == 0) return <></>

    return (
       <>
        <tbody>
            <tr>
                <td className={styles.title}>{item?.title}</td>
                <td className={styles.value}>{numberValue(count)}</td>
                <td className={styles.value}>{numberValue(summa)}</td>
            </tr>
        </tbody>
      </>
    )
} 