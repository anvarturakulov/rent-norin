'use client'
import { ProductionItemProps } from './productionItem.props';
import styles from './productionItem.module.css';



export const ProductionItem = ({className, item, ...props }: ProductionItemProps) :JSX.Element => {
    
    return (
        <tbody>
            <tr>
                <td>{item?.section}</td>
                <td className={styles.value}>{item?.countHamirs}</td>
                <td className={styles.value}>{item?.countZagatovka}</td>
                <td>{item?.zuvalaKPI.toFixed(1)}</td>
                
            </tr>
        </tbody>
    )
} 