'use client'
import { StaticProps } from './static.props';
import styles from './static.module.css';
import { useEffect } from 'react';
import { numberValue } from '@/app/service/common/converters';

export const Static = ({className, data, ...props }: StaticProps) :JSX.Element => {
    
    useEffect(()=> {

    }, [data])
    
    const values = data?.values ?? [];

    return (
       <div>
            <div className={styles.title}>Пул харакати буйича маълумотлар</div>
            <table className={styles.table}>
                <thead className={styles.thead}>
                    <tr>
                        <td>№</td>
                        <td>Курсаткич номи</td>
                        <td>...</td>
                        <td>Сумма</td>
                    </tr>
                </thead>
                <tbody>
                    
                    <tr>
                        <td className={styles.value}>1</td>
                        <td className={styles.caption}>Мижозлардан кирим</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.incomeFromClients)}</td>
                    </tr>
                    <tr>
                        <td className={styles.value}>2</td>
                        <td className={styles.caption}>Ички корхоналардан кирим</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.incomeFromDepartments)}</td>
                    </tr>
                    <tr>
                        <td className={styles.value}>3</td>
                        <td className={styles.caption}>Таъминотчилардан кайтган кирим</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.incomeFromSuppliers)}</td>
                    </tr>
                    <tr>
                        <td className={styles.valueBold}>4</td>
                        <td className={styles.captionBold}>Жами кирим</td>
                        <td className={styles.valueBold}></td>
                        <td className={styles.valueBold}>{numberValue(values?.totalIncome)}</td>
                    </tr>
                    <tr>
                        <td className={styles.value}>5</td>
                        <td className={styles.caption}>Харажатга берилган</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.leaveCashForCharges)}</td>
                    </tr>
                    <tr>
                        <td className={styles.value}>6</td>
                        <td className={styles.caption}>Иш хакига берилган</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.leaveCashForZp)}</td>
                    </tr>
                    <tr>
                        <td className={styles.value}>7</td>
                        <td className={styles.caption}>Мижозларга кайтарилган</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.leaveCashForClients)}</td>
                    </tr>
                    <tr>
                        <td className={styles.value}>8</td>
                        <td className={styles.caption}>Ички корхоналарга берилган</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.leaveCashForDepartments)}</td>
                    </tr>
                    <tr>
                        <td className={styles.value}>9</td>
                        <td className={styles.caption}>Таъминотчиларга берилган</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.leaveCashForSuppliers)}</td>
                    </tr>

                    <tr>
                        <td className={styles.value}>10</td>
                        <td className={styles.caption}>Таъсисчиларга берилган</td>
                        <td className={styles.value}></td>
                        <td className={styles.value}>{numberValue(values?.leaveCashForFounder)}</td>
                    </tr>
                    <tr>
                        <td className={styles.valueBold}>11</td>
                        <td className={styles.captionBold}>Жами харажат</td>
                        <td className={styles.valueBold}></td>
                        <td className={styles.valueBold}>{numberValue(values?.totalLeaveCash)}</td>
                    </tr>
                    
                </tbody>
            </table>
       </div>
    )
} 

