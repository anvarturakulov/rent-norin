'use client'
import { TakingItemProps } from './takingItem.props';
import styles from './takingItem.module.css';
import { numberValue } from '@/app/service/common/converters';

export const TakingItem = ({className, item, ...props }: TakingItemProps) :JSX.Element => {
    
    return (
        <tbody>
            <tr>
                <td className={styles.title}>{item?.section}</td>
                <td className={styles.value}>{numberValue(item?.taking)}</td>
            </tr>
        </tbody>
    )
} 