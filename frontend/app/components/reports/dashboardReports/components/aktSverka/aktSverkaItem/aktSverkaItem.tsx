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

export const AktSverkaItem = ({className, item, references, selectedSchet, ...props }: AktSverkaItemProps) :JSX.Element => {
    const counts = (item && item.counts && item?.counts.length) ? [...item.counts] : []
    const usdStorageId = process.env.NEXT_PUBLIC_USD_STORAGE_ID || -1;
    const { mainData, setMainData } = useAppContext();
    const token = mainData.users.user?.token;
    const contentName = mainData.document.contentName;
    const enterpriseName = useEnterpriseName();

    const openDocument = (docId: number | string | undefined | null) => {
        if (!docId) return;
        getDocument(Number(docId), setMainData, token, mainData, contentName);
    };
    
    // Определяем счет для фильтрации операций
    const schetValue = selectedSchet === '41' ? Schet.S41 : 
                      selectedSchet === '40' ? Schet.S40 : 
                      selectedSchet === '60' ? Schet.S60 : Schet.S41;

    // Формируем остатки: показываем абсолютное значение и в чью пользу
    let startSumma: string;
    if (item?.startBalans) {
        if (item?.startBalans > 0) {
            startSumma = `${numberValue(item?.startBalans)} (${enterpriseName || 'Корхонамиз'} фойдасига)`;
        } else {
            startSumma = `${numberValue((-1) * item?.startBalans)} (${item?.section} фойдасига)`;
        }
    } else {
        startSumma = 'қолдиқ мавжуд эмас';
    }

    let endSumma: string;
    if (item?.endBalans) {
        if (item?.endBalans > 0) {
            endSumma = `${numberValue(item?.endBalans)} (${enterpriseName || 'Корхонамиз'} фойдасига)`;
        } else {
            endSumma = `${numberValue((-1) * item?.endBalans)} (${item?.section} фойдасига)`;
        }
    } else {
        endSumma = 'қолдиқ мавжуд эмас';
    }
    
    return (
       <>
          <div className={styles.item}>
            <Htag tag='h1'>{item?.section}</Htag>
            
            <div className={styles.sumBox}>
                <div className={styles.row}>
                    <div className={styles.title}>Бошлангич қолдиқ</div>
                    <div className={styles.value}>{startSumma}</div>
                </div>
                
                {item?.results && item?.results.length>0 && (
                    <div className={styles.resultsTable}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.tableHeader}>№</th>
                                    <th className={styles.tableHeader}>Сана</th>
                                    <th className={styles.tableHeader}>Хужжат тури</th>
                                    <th className={styles.tableHeader}>Кимга/Кимдан</th>
                                    <th className={styles.tableHeader}>Изох</th>
                                    <th className={styles.tableHeader}>Чиким</th>
                                    <th className={styles.tableHeader}>Кирим</th>
                                </tr>
                            </thead>
                            <tbody>
                                {item.results
                                    .filter((element: any) => 
                                        element.debet == schetValue || element.kredit == schetValue
                                    )
                                    .sort((a: any, b: any) => {
                                        // Сортировка по дате (от старых к новым)
                                        // Даты хранятся в секундах, поэтому приводим к числу для корректного сравнения
                                        const dateA = Number(a.date || 0);
                                        const dateB = Number(b.date || 0);
                                        return dateA - dateB;
                                    })
                                    .map((element: any, key: number) => {

                                        let 
                                        debet = 0, 
                                        kredit = 0, 
                                        firstSubcontoId = -1, 
                                        secondSubcontoId = -1

                                        if (element.debet == schetValue && element.debetFirstSubcontoId == item?.sectionId) {
                                            debet = (usdStorageId == item?.sectionId)?element.usd : element.total
                                            firstSubcontoId = element.kreditFirstSubcontoId
                                            secondSubcontoId = element.kreditSecondSubcontoId
                                        }
                                        if (element.kredit == schetValue && element.kreditFirstSubcontoId == item?.sectionId) {
                                            kredit = (usdStorageId == item?.sectionId)?element.usd : element.total
                                            firstSubcontoId = element.debetFirstSubcontoId
                                            secondSubcontoId = element.debetSecondSubcontoId
                                        }

                                        const secondSubcontoName = secondSubcontoId !== -1 && secondSubcontoId !== null && secondSubcontoId !== undefined
                                            ? getNameReference(references, secondSubcontoId) || ''
                                            : '';
                                        const description = element?.description || '';
                                        const countInfo = element?.count
                                            ? `( сон: ${numberValue(element?.count)} x ${numberValue((debet || kredit) / element?.count)} )`
                                            : '';

                                        const izohParts: string[] = [];
                                        if (secondSubcontoName) {
                                            izohParts.push(secondSubcontoName);
                                        }
                                        if (description) {
                                            izohParts.push(description);
                                        }
                                        if (countInfo) {
                                            izohParts.push(countInfo);
                                        }

                                        const izoh = izohParts.length > 0
                                            ? izohParts.join(' - ')
                                            : '-';

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
                                                .filter((element: any) => 
                                                    element.debet == schetValue && element.debetFirstSubcontoId == item?.sectionId
                                                )
                                                .reduce((sum: number, element: any) => sum + ((usdStorageId == item?.sectionId)?element.usd : element.total || 0), 0)
                                        )}
                                    </td>
                                    <td className={cn(styles.tableCell, styles.total)}>
                                        {numberValue(
                                            item.results
                                                .filter((element: any) => 
                                                    element.kredit == schetValue && element.kreditFirstSubcontoId == item?.sectionId
                                                )
                                                .reduce((sum: number, element: any) => sum + ((usdStorageId == item?.sectionId)?element.usd : element.total || 0), 0)
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
                    <div className={styles.title}>Охирги қолдиқ</div> 
                    <div className={styles.value}>{endSumma}</div>
                </div>  
            </div>
            
          </div>
      </>
    )
}
