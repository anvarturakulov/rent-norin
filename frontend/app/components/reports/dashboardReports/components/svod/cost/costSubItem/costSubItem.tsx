'use client'
import { CostSubItemProps } from './costSubItem.props';
import styles from './costSubItem.module.css';
import { numberValue } from '@/app/service/common/converters';

export const CostSubItem = ({className, item, ...props }: CostSubItemProps) :JSX.Element => {
    const earning = item?.earning
    const saleWithMove = item?.saleWithMove
    const count = item?.productionCount;
    const cost = count !==0 ? (saleWithMove - earning) / count : 0

    return (
        <tr className={styles.tr}>
          <td></td>
          <td className={styles.title}>{item?.title}</td>
          <td className={styles.row}>{numberValue(count)}</td>
          <td className={styles.row}>{numberValue(item?.comeProductDocsByProduct)}</td>
          <td className={styles.row}>{numberValue(saleWithMove)}</td>
          <td className={styles.row}>{numberValue(saleWithMove - earning)}</td>
          <td className={styles.row}>{numberValue(earning)}</td>
          <td className={styles.row}>{numberValue(cost)}</td>
        </tr>
    )
} 