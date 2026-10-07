'use client'
import { CashItemProps } from './cashItem.props';
import styles from './cashItem.module.css';
import { numberValue } from '@/app/service/common/converters';

export const CashItem = ({className, item, ...props }: CashItemProps) :JSX.Element => {
    
    return (
       <>
        <tbody>
            <tr>
              <td className={styles.title}>{item?.section}</td>
              <td>{numberValue(item?.startBalans)}</td>
              <td>{numberValue(item?.incomeFromClients)}</td>
              <td>{numberValue(item?.incomeFromDepartments)}</td>
              <td>{numberValue(item?.moveIncome)}</td>
              <td >{numberValue(item?.allIncome)}</td>
              <td>{numberValue(item?.outForCharges)}</td>
              <td>{numberValue(item?.outForSuppliers)}</td>
              <td>{numberValue(item?.outForDepartments)}</td>
              <td>{numberValue(item?.moveOut)}</td>
              <td>{numberValue(item?.outForFounder)}</td>
              <td>{numberValue(item?.allOut)}</td>
              <td>{numberValue(item?.endBalans)}</td>
            </tr>
        </tbody>
      </>
    )
} 