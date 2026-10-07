'use client'
import styles from './personalItem.module.css';
import { numberValue } from '@/app/service/common/converters';
import { PersonalItemProps } from './personalItem.props';
import { useState } from 'react';
import cn from 'classnames';

import { formatDisplayDateTime } from '@/app/utils/formatDisplayDate';
import { useAppContext } from '@/app/context/app.context';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';

export const secondsToDateString = (seconds: number): String => {
  return formatDisplayDateTime(+seconds)
}


export const PersonalItem = ({className, item, ...props }: PersonalItemProps) :JSX.Element => {

  const [showInners, setShowInners] = useState<boolean>(false)
  const { mainData, setMainData } = useAppContext();
  const token = mainData.users.user?.token;
  const contentName = mainData.document.contentName;

  const openDocument = (docId: number | string | undefined | null) => {
    if (!docId) return;
    getDocument(Number(docId), setMainData, token, mainData, contentName);
  };

  const plus = showInners ? '-':'+';
  return (
      <>
      <thead>
      <tr className={cn(styles.trRowMain, {[styles.opened]: showInners})} >
          <td 
              className={styles.plus} 
              onClick={() => setShowInners(showInners => !showInners)
              }>
                {plus}
          </td>
          <td className={styles.title}>{item?.name}</td>
          <td className={styles.title}></td>
          <td className={styles.title}></td>
          <td className={styles.title}></td>
          <td className={styles.totalTdKol}>{numberValue((-1)*item?.POSUM)}</td>
          <td className={styles.totalTdKol}>{numberValue(item?.TKSUM)}</td>
          <td className={styles.totalTdKol}>{numberValue(item?.TDSUM)}</td>
          <td className={styles.totalTdKol}>{numberValue((-1)*item?.POSUM+item?.TKSUM-item?.TDSUM)}</td>
        </tr>
      </thead>
      <tbody className={styles.tbody}>
          {
              item?.subItems &&
              showInners &&
              item?.subItems.length &&
              item.subItems
              .sort((a:any, b:any) => a.date - b.date)
              .map((element:any, key:number) => {
                  return (
                    <tr
                      key={key}
                      data-report-doc-anchor={element?.docId || undefined}
                      className={cn({ [styles.clickableRow]: !!element?.docId })}
                      onDoubleClick={() => openDocument(element?.docId)}
                      title={element?.docId ? 'Хужжатни очиш (икки марта босинг)' : undefined}
                    >
                      <td className={styles.number}>{key+1}</td>
                      <td></td>
                      <td>{secondsToDateString(element?.date)}</td>
                      <td>{element?.section}</td>
                      <td>{element?.comment}</td>
                      <td></td>
                      <td>{numberValue(element?.TKSUM)}</td>
                      <td>{numberValue(element?.TDSUM)}</td>
                      <td></td>
                    </tr>
                  )
              })
          }
          
      </tbody>
      
    </>
  )
}

// XPathExpression filter for(let first of second) {third}