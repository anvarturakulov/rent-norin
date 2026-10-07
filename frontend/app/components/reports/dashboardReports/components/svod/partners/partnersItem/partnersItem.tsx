'use client'
import { PartnersItemProps } from './partnersItem.props';
import styles from './partnersItem.module.css';
import { splitSignedAmountDisplay } from '../splitSignedAmountDisplay';

export const PartnersItem = ({className, item, index, ...props }: PartnersItemProps) :JSX.Element | null => {
    
  const isEmpty = [item?.POSUM, item?.TDSUM, item?.TKSUM]
                  .every(val => !val); // true для 0, null, undefined, '', false

  if (isEmpty) return null;

    const posum = item?.POSUM ?? 0
    const td = item?.TDSUM ?? 0
    const tk = item?.TKSUM ?? 0
    const boshl = splitSignedAmountDisplay(posum)
    const oxirgi = splitSignedAmountDisplay(posum + td - tk)

    return (
        <tr>
          <td className={styles.index}>{index+1}</td>
          <td className={styles.title}>{item?.name}</td>
          <td>{boshl.plus}</td>
          <td>{boshl.minus}</td>
          <td>{oxirgi.plus}</td>
          <td>{oxirgi.minus}</td>
        </tr>
    )
} 
