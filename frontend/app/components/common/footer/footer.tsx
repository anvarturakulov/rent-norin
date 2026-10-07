import { numberValue } from '@/app/service/common/converters'
import styles from './footer.module.css'
import { FooterProps } from './footer.props'

export default function Footer({ windowFor ,className, count, total, docCount, label, totalSecond, totalCost, ...props }: FooterProps): JSX.Element {
    if (windowFor == 'reference') return <></>
    
    return (
        <div className={styles.box}>
            {
                count!=undefined && count>0 && 
                <div>Сон: <span>{numberValue(count)}</span></div>

            }

            {
                total!=undefined && total>0 &&
                <div>Сумма: <span>{numberValue(total)}</span></div>

            }

            {
                docCount!=undefined && docCount>0 &&
                <div>Хужжат сони: <span>{numberValue(docCount)}</span></div>

            }

            {
                totalSecond!=undefined && totalSecond>0 &&
                <div>Сумма: <span>{numberValue(totalSecond)}</span></div>
            }

            {
                totalCost!=undefined && totalCost>0 &&
                <div>Себестоимость: <span>{numberValue(totalCost)}</span></div>
            }

            {/* {
                docCount!=undefined && docCount>0 && count && windowFor != 'order' &&
                <div>Урта сон: <span>{numberValue(count/docCount)}</span></div>
            }

            {
                count !=undefined && count >0 && count && total && windowFor != 'order' &&
                <div>Урта киймат: <span>{numberValue(total/count)}</span></div>
            } */}

        </div>
    )
}

