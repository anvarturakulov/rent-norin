'use client'
import { FoydaItemProps } from './foydaItem.props';
import styles from './foydaItem.module.css';
import { numberValue } from '@/app/service/common/converters';
import { FoydaSubItem } from '../foydaSubItem/foydaSubItem';

const totalByKey = (key:string, data:any[]) => {
  let total = 0;
  data && data.length &&
  data.forEach((item:any) => {
      total += item[key]
  })
  return total
}

export const FoydaItem = ({className, item, ...props }: FoydaItemProps) :JSX.Element => {
  const datas = item.subItems ? [...item.subItems] : []    
  return (
      <tbody className={styles.tbody}>
          <tr className={styles.tr}>
            <td className={styles.column}>{item?.section}</td>
            <td className={styles.column}>{numberValue(totalByKey('productionCount', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('comeProductDocsByProduct', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('saleCountWithOutMove', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('countDeleviry', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('saleWithMove', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('zagatovka', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('material', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('zp', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('service', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('payment', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('addingZagatovka', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('addingMaterial', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('addingZp', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('addingService', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('addingPayment', datas))}</td>
            <td className={styles.column}>{numberValue(totalByKey('earning', datas))}</td>
            <td className={styles.column}></td>
            <td className={styles.column}></td>
          </tr>
          {
            datas && datas.length && datas
            .map((element: any, key: number) => {
                return <FoydaSubItem 
                    key={key}
                    item={element}
                />
            })
          }
      </tbody>
  )
} 