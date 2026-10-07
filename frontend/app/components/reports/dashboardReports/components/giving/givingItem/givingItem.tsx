'use client'
import { TakingItemProps } from './givingItem.props';
import styles from './givingItem.module.css';
import { numberValue } from '@/app/service/common/converters';

export const GivingItem = ({className, item, ...props }: TakingItemProps) :JSX.Element => {
    
    return (
        <tbody>
            <tr>
                <td className={styles.title}>{item?.section}</td>
                <td className={styles.value}>{numberValue(item?.giving)}</td>
            </tr>
        </tbody>
    )
} 