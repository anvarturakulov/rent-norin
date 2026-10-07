'use client'

import styles from './personal.module.css';
import { useAppContext } from '@/app/context/app.context';
import { PersonalProps } from './personal.props';
import { PersonalItem } from './personalItem/personalItem';
import { useEffect } from 'react';
import { numberValue } from '@/app/service/common/converters';


export const Personal = ({className, ...props }: PersonalProps) :JSX.Element => {
    const { setMainData, mainData } = useAppContext()
    const { personal, reportOption } = mainData.report
    const { firstReferenceId } = reportOption
    let TOTALPOSUM = 0, TOTALTDSUM = 0, TOTALTKSUM = 0, TOTALKOSUM = 0

    let datas = personal ? personal?.values : []
    if (datas.length > 0) {
        TOTALPOSUM = datas.reduce((summa: number, item:any) => summa + (item.POSUM ? -item.POSUM : 0), 0);
        TOTALTDSUM = datas.reduce((summa: number, item:any) => summa + (item.TDSUM || 0), 0);
        TOTALTKSUM = datas.reduce((summa: number, item:any) => summa + (item.TKSUM || 0), 0);
        TOTALKOSUM = TOTALPOSUM + TOTALTKSUM-TOTALTDSUM;
    }

    return (
       <div className={styles.sectionContainer}>
            <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <td >№</td>
                        <td className={styles.titleName}>ФИШ</td>
                        <td className={styles.titleValue}>сана</td>
                        <td className={styles.titleValue}>цех</td>
                        <td className={styles.titleValue}>изох</td>
                        <td className={styles.titleValue}>Колдик сумма</td>
                        <td className={styles.titleValue}>Хисобланди</td>
                        <td className={styles.titleValue}>Туланди</td>
                        <td className={styles.titleValue}>Колдик сумма</td>
                    </tr>
                </thead>
                {
                    datas && datas.length &&
                    datas
                    .sort((a:any, b:any) => a.name.localeCompare(b.name))
                    .map((element: any, key: number) => {
                        return <PersonalItem 
                            key={key}
                            item={element}
                        />
                    })
                }
                <thead>
                    <tr>
                        <td ></td>
                        <td className={styles.titleName}>Жами</td>
                        <td className={styles.titleValue}></td>
                        <td className={styles.titleValue}></td>
                        <td className={styles.titleValue}></td>
                        <td className={styles.titleValue}>{numberValue(TOTALPOSUM)}</td>
                        <td className={styles.titleValue}>{numberValue(TOTALTKSUM)}</td>
                        <td className={styles.titleValue}>{numberValue(TOTALTDSUM)}</td>
                        <td className={styles.titleValue}>{numberValue(TOTALKOSUM)}</td>
                    </tr>
                </thead>
                {/* <td className={styles.totalTdKol}>{numberValue((-1)*item?.POSUM)}</td>
          <td className={styles.totalTdKol}>{numberValue(item?.TKSUM)}</td>
          <td className={styles.totalTdKol}>{numberValue(item?.TDSUM)}</td>
          <td className={styles.totalTdKol}>{numberValue((-1)*item?.POSUM+item?.TKSUM-item?.TDSUM)}</td> */}
            </table>
            </div>
       </div>
    )
} 

