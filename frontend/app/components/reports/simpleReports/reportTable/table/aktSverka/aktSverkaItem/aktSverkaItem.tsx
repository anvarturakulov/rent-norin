'use client'
import React from 'react';
import { AktSverkaItemProps } from './aktSverkaItem.props';
import styles from './aktSverkaItem.module.css';
import cn from 'classnames';
import { Htag } from '@/app/components';
import { numberValue } from '@/app/service/common/converters';
import { Schet } from '@/app/interfaces/report.interface';
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { secondsToDateString } from '@/app/components/documents/document/doc/helpers/doc.functions';
import { getDocument, getNameReference } from '@/app/components/journals/journal/helpers/journal.functions';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '@/app/components/reports/dashboardReports/hooks/useEnterpriseName';


export const AktSverkaItem = ({className, item, references, ...props }: AktSverkaItemProps) :JSX.Element => {
    const counts = (item && item.counts && item?.counts.length) ? [...item.counts] : []
    const usdStorageId = process.env.NEXT_PUBLIC_USD_STORAGE_ID || -1;

    const { mainData, setMainData } = useAppContext();
    const { reportOption } = mainData.report;
    const { partnerType } = reportOption;
    const schet = partnerType == 'CLIENTS' ? Schet.S40 : partnerType == 'SUPPLIERS' ? Schet.S60 : Schet.S41;
    const enterpriseName = useEnterpriseName();
    const token = mainData.users.user?.token;
    const contentName = mainData.document.contentName;

    const openDocument = (docId: number | string | undefined | null) => {
        if (!docId) return;
        getDocument(Number(docId), setMainData, token, mainData, contentName);
    };

    let startSumma, endSumma

    if (item?.startBalans) {
        if (item?.startBalans > 0) {
            startSumma = `${numberValue(item?.startBalans)} (Корхонамиз фойдасига)`
        } else {
            startSumma = `${numberValue((-1)*item?.startBalans)} (${item?.section} фойдасига)`
        }
    } else {
        startSumma = 'колдик мавжуд эмас'
    }

    if (item?.endBalans) {
        if (item?.endBalans > 0) {
            endSumma = `${numberValue(item?.endBalans)} (${enterpriseName || 'Корхонамиз'} фойдасига)`
        } else {
            endSumma = `${numberValue((-1)*item?.endBalans)} (${item?.section} фойдасига)`
        }
    } else {
        endSumma = 'колдик мавжуд эмас'
    }


    return (
       <>
          <div className={styles.item}>
            {/* <Htag tag='h1'>{item?.section}</Htag> */}
                        
            <div className={styles.sumBox}>
                <div className={styles.row}>
                    <div className={styles.title}>Бошлангич колдик</div>
                    <div className={styles.value}>
                        {startSumma}
                    </div>
                </div>
                
                {item?.results && item?.results.length>0 && (
                    <div className={styles.resultsTable}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.tableHeader}>№</th>
                                    <th className={styles.tableHeader}>Сана</th>
                                    <th className={styles.tableHeader}>Хужжат тури</th>
                                    <th className={styles.tableHeader}>Манба</th>
                                    <th className={styles.tableHeader}>Изох</th>
                                    <th className={styles.tableHeader}>Чиким</th>
                                    <th className={styles.tableHeader}>Кирим</th>

                                </tr>
                            </thead>
                            <tbody>
                                {item.results
                                    .sort((a: any, b: any) => {
                                        // Сортировка по дате (от старых к новым)
                                        // Даты хранятся в секундах, поэтому умножаем на 1000 для преобразования в миллисекунды
                                        const dateA = new Date((a.date || 0) * 1000);
                                        const dateB = new Date((b.date || 0) * 1000);
                                        return dateA.getTime() - dateB.getTime();
                                    })
                                    .map((element: any, key: number) => {

                                        let 
                                        debet = 0, 
                                        kredit = 0, 
                                        firstSubcontoId = -1, 
                                        secondSubcontoId = -1,
                                        receiverFirstSubcontoId = -1    

                                        // Для "Барчаси" (sectionId === -1) проверяем, что проводка относится к любому STORAGES из группы
                                        if (item?.sectionId === -1 && item?.allStorageIds) {
                                            // Проверяем, что debetFirstSubcontoId или kreditFirstSubcontoId находится в списке STORAGES
                                            const isDebetMatch = element.debet == schet && item.allStorageIds.includes(element.debetFirstSubcontoId);
                                            const isKreditMatch = element.kredit == schet && item.allStorageIds.includes(element.kreditFirstSubcontoId);
                                            
                                            if (isDebetMatch) {
                                                debet = (usdStorageId == element.debetFirstSubcontoId)?element.usd : element.total
                                                firstSubcontoId = element.kreditFirstSubcontoId
                                                secondSubcontoId = element.kreditSecondSubcontoId
                                                receiverFirstSubcontoId = element.debetFirstSubcontoId
                                                
                                            }
                                            if (isKreditMatch) {
                                                kredit = (usdStorageId == element.kreditFirstSubcontoId)?element.usd : element.total
                                                firstSubcontoId = element.debetFirstSubcontoId
                                                secondSubcontoId = element.debetSecondSubcontoId
                                                receiverFirstSubcontoId = element.kreditFirstSubcontoId
                                            }
                                        } else {
                                            // Обычная проверка для конкретного партнера
                                            if (element.debet == schet && element.debetFirstSubcontoId == item?.sectionId) {
                                                debet = (usdStorageId == item?.sectionId)?element.usd : element.total
                                                firstSubcontoId = element.kreditFirstSubcontoId
                                                secondSubcontoId = element.kreditSecondSubcontoId
                                                receiverFirstSubcontoId = element.debetFirstSubcontoId
                                            }
                                            if (element.kredit == schet && element.kreditFirstSubcontoId == item?.sectionId) {
                                                kredit = (usdStorageId == item?.sectionId)?element.usd : element.total
                                                firstSubcontoId = element.debetFirstSubcontoId
                                                secondSubcontoId = element.debetSecondSubcontoId
                                                receiverFirstSubcontoId = element.kreditFirstSubcontoId
                                            }
                                        }

                                        // Формируем изох (комментарий)
                                        const secondSubcontoName = secondSubcontoId !== -1 && secondSubcontoId !== null && secondSubcontoId !== undefined 
                                            ? getNameReference(references, secondSubcontoId) || '' 
                                            : '';
                                        const description = element?.description || '';
                                        const receiverName = receiverFirstSubcontoId !== -1 && receiverFirstSubcontoId !== null && receiverFirstSubcontoId !== undefined
                                            ? getNameReference(references, receiverFirstSubcontoId) || ''
                                            : '';
                                        const countInfo = element?.count 
                                            ? `( сон: ${numberValue(element?.count)} x ${numberValue((debet || kredit) / element?.count)} )` 
                                            : '';
                                        
                                        // Собираем части изоха
                                        const izohParts: string[] = [];
                                        if (secondSubcontoName) {
                                            izohParts.push(secondSubcontoName);
                                        }
                                        if (description) {
                                            izohParts.push(description);
                                        }
                                        // if (receiverName) {
                                        //     izohParts.push(`[${receiverName}]`);
                                        // }
                                        if (countInfo) {
                                            izohParts.push(countInfo);
                                        }
                                        
                                        const izoh = izohParts.length > 0 
                                            ? izohParts.join(' - ') 
                                            : '';

                                        return (
                                        <tr
                                            key={key}
                                            data-report-doc-anchor={element?.docId || undefined}
                                            className={cn(styles.tableRow, { [styles.clickableRow]: !!element?.docId })}
                                            onDoubleClick={() => openDocument(element?.docId)}
                                            title={element?.docId ? 'Хужжатни очиш (икки марта босинг)' : undefined}
                                        >
                                            <td className={cn(styles.tableCell, styles.number)}>{key+1}</td>
                                            <td className={cn(styles.tableCell, styles.date)}>{secondsToDateString(element?.date) || '-'}</td>
                                            <td className={cn(styles.tableCell, styles.documentType)}>{getDescriptionDocument(element?.documentType) || '-'}</td>
                                            <td className={cn(styles.tableCell, styles.partner)}>{getNameReference(references, firstSubcontoId) || '-'}</td>
                                            <td className={cn(styles.tableCell, styles.description)}>{izoh}</td>
                                            <td className={cn(styles.tableCell, styles.debet)}>{numberValue(debet)}</td>
                                            <td className={cn(styles.tableCell, styles.kredit)}>{numberValue(kredit)}</td>
                                        </tr>
                                    )})}
                            </tbody>
                            <tfoot>
                                <tr className={cn(styles.tableRow, styles.totalRow)}>
                                    <td className={cn(styles.tableCell, styles.total)} colSpan={5}>Жами</td>
                                    <td className={cn(styles.tableCell, styles.total)}>
                                        {numberValue(
                                            item.results
                                                .filter((element: any) => {
                                                    if (item?.sectionId === -1 && item?.allStorageIds) {
                                                        return element.debet == schet && item.allStorageIds.includes(element.debetFirstSubcontoId);
                                                    }
                                                    return element.debet == schet && element.debetFirstSubcontoId == item?.sectionId;
                                                })
                                                .reduce((sum: number, element: any) => {
                                                    const storageId = item?.sectionId === -1 ? element.debetFirstSubcontoId : item?.sectionId;
                                                    return sum + ((usdStorageId == storageId)?element.usd : element.total || 0);
                                                }, 0)
                                        )}
                                    </td>
                                    <td className={cn(styles.tableCell, styles.total)}>
                                        {numberValue(
                                            item.results
                                                .filter((element: any) => {
                                                    if (item?.sectionId === -1 && item?.allStorageIds) {
                                                        return element.kredit == schet && item.allStorageIds.includes(element.kreditFirstSubcontoId);
                                                    }
                                                    return element.kredit == schet && element.kreditFirstSubcontoId == item?.sectionId;
                                                })
                                                .reduce((sum: number, element: any) => {
                                                    const storageId = item?.sectionId === -1 ? element.kreditFirstSubcontoId : item?.sectionId;
                                                    return sum + ((usdStorageId == storageId)?element.usd : element.total || 0);
                                                }, 0)
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {(!item?.results || item?.results.length == 0) && (
                    <div className={styles.resultsTable}>
                        <div className={styles.empty}>Маълумот мавжуд эмас</div>
                    </div>
                )}

                
                <div className={styles.row}>
                    <div className={styles.title}>Охирги колдик</div> 
                    <div className={styles.value}>{endSumma}</div>
                </div>  
            </div>
            
          </div>
      </>
    )
} 