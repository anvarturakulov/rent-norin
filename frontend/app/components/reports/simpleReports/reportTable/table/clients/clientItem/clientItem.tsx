'use client'
import styles from './clientItem.module.css';
import { numberValue } from '@/app/service/common/converters';
import { totalByKey } from '@/app/components/reports/dashboardReports/inform';
import { ClientItemProps } from './clientItem.props';

export const ClientItem = ({className, item, section, ...props }: ClientItemProps) :JSX.Element => {
    let POKOL = totalByKey('POKOL', item?.items)
    let POSUM = totalByKey('POSUM', item?.items);
    let TDKOL = totalByKey('TDKOL', item?.items)
    let TDSUM = totalByKey('TDSUM', item?.items)
    let TKKOL = totalByKey('TKKOL', item?.items)
    let TKSUM = totalByKey('TKSUM', item?.items)

    return (
       <>
        <thead>
          <tr className={styles.sectionName}>
            <td></td>
            <td>{section}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td> 
          </tr>
        </thead>
        <tbody className={styles.tbody}>
            {
                item?.items &&
                item?.items.length &&
                item?.items.map((element:any, key:number) => {
                    return (
                        <tr key={key}>
                          <td className={styles.number}>{key+1}</td>
                          <td id='itemName' className={styles.title}>{element?.name}</td>
                          <td>--</td>
                          <td>--</td>
                          <td>{numberValue(element?.POKOL)}</td>
                          <td>{numberValue(element?.POSUM)}</td>
                          <td>{numberValue(element?.TDKOL)}</td>
                          <td>{numberValue(element?.TDSUM)}</td>
                          <td>{numberValue(element?.TKKOL)}</td>
                          <td>{numberValue(element?.TKSUM)}</td>
                          <td>{numberValue(element?.POKOL+element?.TDKOL-element?.TKKOL)}</td>
                          <td>{numberValue(element?.POSUM+element?.TDSUM-element?.TKSUM)}</td>
                        </tr>
                    )
                })

            }
            
        </tbody>
        <thead>
          <tr className={styles.total}>
              <td></td>
              <td>Жами</td>
              <td></td>
              <td></td>
              <td className={styles.totalTd}>{numberValue(POKOL)}</td>
              <td className={styles.totalTd}>{numberValue(POSUM)}</td>
              <td className={styles.totalTd}>{numberValue(TDKOL)}</td>
              <td className={styles.totalTd}>{numberValue(TDSUM)}</td>
              <td className={styles.totalTd}>{numberValue(TKKOL)}</td>
              <td className={styles.totalTd}>{numberValue(TKSUM)}</td>
              <td className={styles.totalTd}>{numberValue(POKOL+TDKOL-TKKOL)}</td>
              <td className={styles.totalTd}>{numberValue(POSUM+TDSUM-TKSUM)}</td>

              </tr>
      </thead>
      </>
    )
} 