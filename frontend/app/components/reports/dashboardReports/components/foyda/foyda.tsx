'use client'
import { FoydaProps } from './foyda.props';
import { FoydaItem } from './foydaItem/foydaItem';
import styles from './foyda.module.css';
import { useEffect, useState } from 'react';
import { numberValue } from '@/app/service/common/converters';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

const totalByKey = (key:string, data:any[]) => {
    let total = 0;
    data && data.length &&
    data.forEach((item:any) => {
        let totalInner = 0
        if (item.subItems && item.subItems.length) {
            item.subItems.forEach((elem: any) => {
                totalInner += elem[key]
            })
        }
        total += totalInner
    })
    return total
  }

export const Foyda = ({className, data, ...props }: FoydaProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();

    useEffect(()=> {
    }, [data])
    
    let datas = data ? data.filter((item: any) => item?.reportType == 'FOYDA')[0]?.values : []

    return (
       <>
      <div className={styles.title}>
        ФOЙДА ХИСОБИ
        {enterpriseName && <span> - {enterpriseName}</span>}
      </div>
      <div className={styles.tableContainer}> {/* Новый контейнер */}
        <table className={styles.table}>
          <thead>
            <tr>
              <td className={styles.section}>Цех</td>
              <td>Ишлаб чикар. нон сони</td>
              <td>Хамир сони</td>
              <td>Цехдага сав. нон сони</td>
              <td>Юк етк. нон сони</td>
              <td>Умум савдо пули</td>
              <td>Ун харажати</td>
              <td>Хом ашёлар хараж.</td>
              <td>Иш хаки хараж.</td>
              <td>Коммун ва бошка хараж.</td>
              <td>Пуллик хараж.</td>
              <td>Умум - ун харажати</td>
              <td>Умум - хом ашё харажати</td>
              <td>Умум - иш хаки</td>
              <td>Умум - комм. ва бошка хараж</td>
              <td>Умум - пуллик харажатлар</td>
              <td>Соф фойда</td>
              <td>Хом аше нормаси</td>
              <td>1 та нонга нис. фойда</td>
            </tr>
          </thead>
          {/* <tbody> */}
            {datas &&
              datas.length &&
              datas.map((element: any, key: number) => {
                return <FoydaItem key={key} item={element} />;
              })}
          {/* </tbody> */}
          <thead className={styles.thead}>
            <tr className={styles.tr}>
              <td className={styles.section}>Жами</td>
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
          </thead>
        </table>
      </div>
    </>
    )
} 

