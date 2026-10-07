'use client'
import { CostItemProps } from './costItem.props';
import styles from './costItem.module.css';
import { CostSubItem } from '../costSubItem/costSubItem';

const totalByKey = (key:string, data:any[]) => {
  let total = 0;
  data && data.length &&
  data.forEach((item:any) => {
      total += item[key]
  })
  return total
}

export const CostItem = ({className, item, ...props }: CostItemProps) :JSX.Element => {
  const datas = item.subItems ? [...item.subItems] : []    
  return (
    <>
      <tr className={styles.tr}>
        <td></td>
        <td className={styles.section}>{item?.section}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        {/* <td className={styles.column}>{numberValue(totalByKey('productionCount', datas))}</td> */}
      </tr>
      {
        datas && datas.length && datas
        .map((element: any, key: number) => {
            return <CostSubItem 
                key={key}
                item={element}
                index = {key}
            />
        })
      }
    </>
    
  )
} 