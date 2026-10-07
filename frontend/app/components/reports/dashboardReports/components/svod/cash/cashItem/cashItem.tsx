'use client'
import { CashItemProps } from './cashItem.props';
import styles from './cashItem.module.css';
import { numberValue } from '@/app/service/common/converters';

/** Как в ДК «Пул маблаглари» (актив): только неотрицательный остаток. */
const activeOnly = (v: unknown) => Math.max(0, Number(v) || 0);

export const CashItem = ({className, item, index, ...props }: CashItemProps) :JSX.Element | null => {
    
  // const isEmpty = [item?.POKOL, item?.POSUM, item?.TDKOL, item?.TDSUM, item?.TKKOL, item?.TKSUM]
  //                 .every(val => !val); // true для 0, null, undefined, '', false

  // if (isEmpty) return null;

    return (
        <tr>
          <td className={styles.index}>{index+1}</td>
          <td className={styles.title}>{item?.section}</td>
          <td>{numberValue(activeOnly(item?.startBalans))}</td>
          {/* <td className={styles.count}>{numberValue(item?.TDKOL)}</td> */}
          <td>{numberValue(activeOnly(item?.endBalans))}</td>
          
        </tr>
    )
} 