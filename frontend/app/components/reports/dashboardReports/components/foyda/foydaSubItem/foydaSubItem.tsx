'use client'
import { FoydaSubItemProps } from './foydaSubItem.props';
import styles from './foydaSubItem.module.css';
import { numberValue } from '@/app/service/common/converters';

export const FoydaSubItem = ({className, item, ...props }: FoydaSubItemProps) :JSX.Element => {
    return (
        <tr className={styles.tr}>
          <td className={styles.title}>{item?.title}</td>
          <td className={styles.row}>{numberValue(item?.productionCount)}</td>
          <td className={styles.row}>{numberValue(item?.comeProductDocsByProduct)}</td>
          <td className={styles.row}>{numberValue(item?.saleCountWithOutMove)}</td>
          <td className={styles.row}>{numberValue(item?.countDeleviry)}</td>
          <td className={styles.row}>{numberValue(item?.saleWithMove)}</td>
          <td className={styles.row}>{numberValue(item?.zagatovka)}</td>
          <td className={styles.row}>{numberValue(item?.material)}</td>
          <td className={styles.row}>{numberValue(item?.zp)}</td>
          <td className={styles.row}>{numberValue(item?.service)}</td>
          <td className={styles.row}>{numberValue(item?.payment)}</td>
          <td className={styles.row}>{numberValue(item?.addingZagatovka)}</td>
          <td className={styles.row}>{numberValue(item?.addingMaterial)}</td>
          <td className={styles.row}>{numberValue(item?.addingZp)}</td>
          <td className={styles.row}>{numberValue(item?.addingService)}</td>
          <td className={styles.row}>{numberValue(item?.addingPayment)}</td>
          <td className={styles.row}>{numberValue(item?.earning)}</td>
          <td className={styles.row}>{}</td>
          <td className={styles.row}>{}</td>
        </tr>
    )
} 