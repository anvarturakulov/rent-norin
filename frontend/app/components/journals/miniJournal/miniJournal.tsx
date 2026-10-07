'use client'
import styles from './miniJournal.module.css'
import {MiniJournalProps} from './miniJournal.props'
import { useEffect, useRef } from 'react';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import cn from 'classnames';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { DocSTATUS, DocumentModel, DocumentType } from '@/app/interfaces/document.interface';
import { getNameReference } from '../journal/helpers/journal.functions';
import { setProvodkaByReciever } from './helpers/miniJournal.functions';
import { isDocumentDateBanned } from '@/app/service/settings/dateBanEditing';
import { getTodayRange } from '@/app/service/common/dateRanges';
import { secondsToDateString } from '../../documents/document/doc/helpers/doc.functions';


export default function MiniJournal({ className, ...props}:MiniJournalProps):JSX.Element {
    
    const {mainData, setMainData} = useAppContext();
    const { user } = mainData.users;
    const { showDocumentWindow } = mainData.document;
    const { updateDataForDocumentJournal, interval } = mainData.journal;
    const {dateStart, dateEnd} = interval;

    let dateStartForUrl = dateStart
    let dateEndForUrl = dateEnd

    if (!dateStart && !dateEnd) {
        const today = getTodayRange()
        dateStartForUrl = today.start
        dateEndForUrl = today.end
    }

    const token = user?.token;
    const userId = user?.id
    // let url = process.env.NEXT_PUBLIC_DOMAIN+'/api/documents/all/';
    const url = process.env.NEXT_PUBLIC_DOMAIN+'/api/documents/byDate'+'?userId='+userId+'&dateStart='+dateStartForUrl+'&dateEnd='+dateEndForUrl;
    const urlReferences = process.env.NEXT_PUBLIC_DOMAIN+'/api/references/all/';

    const { data : documents, mutate } = useSWR(url, (url) => getDataForSwr(url, token));
    const { data : references, mutate: mutateReferences } = useSWR(urlReferences, (urlReferences) => getDataForSwr(urlReferences, token));

    const wasDocumentOpenRef = useRef(showDocumentWindow);
    useEffect(() => {
        const closedDocument = wasDocumentOpenRef.current && !showDocumentWindow;
        wasDocumentOpenRef.current = showDocumentWindow;

        if (!closedDocument && !updateDataForDocumentJournal) return;

        mutate();
        mutateReferences();
        if (updateDataForDocumentJournal) {
            setMainData && setMainData('updateDataForDocumentJournal', false);
        }
    }, [showDocumentWindow, updateDataForDocumentJournal]);

    return (
        <>
            <div className={styles.title}>Хужжатлар руйхати</div>
            {
                <div className={styles.container} >
                    <table className={styles.table}>
                        <tbody className={styles.tbody}>
                            {documents && documents.length>0 && 
                            documents
                            .filter((item:DocumentModel, key: number) => {
                                return (
                                    item.userId == user?.id || 
                                    item.docValues?.receiverId == user?.sectionId 
                                )
                            })
                            .sort((a:DocumentModel, b:DocumentModel) => {
                                const dateComparison = a.date - b.date;

                                if (dateComparison === 0 && a.id && b.id) {
                                    return a.id - b.id;
                                }
                                
                                return dateComparison;
                            })
                            .map((item:DocumentModel, key: number) => (
                                <tr 
                                    key={key} 
                                    className={cn(className, {
                                            [styles.deleted]: item.docStatus == DocSTATUS.DELETED,
                                            [styles.trRow]: 1,
                                            
                                        })}>
                                    <td className={cn(styles.documentType, {
                                        [styles.proveden]: item.docStatus == DocSTATUS.PROVEDEN
                                    })}>
                                            {getDescriptionDocument(item.documentType)}
                                    </td>
                                    <td>{`${getNameReference(references,item.docValues?.receiverId)}`}</td>
                                    <td>{getNameReference(references,item.docValues?.senderId)}</td>
                                    <td className={styles.rowDate}>{secondsToDateString(item.date)}</td>
                                    <td className={cn(styles.rowSumma, styles.tdSumma)}>{item.docValues?.total ? item.docValues?.total:item.docValues?.comment}</td>
                                    <td>{`${getNameReference(references,item.docValues?.analiticId)? getNameReference(references,item.docValues?.analiticId): ''} ${item.docValues?.count ? `(${item.docValues?.count})`: ''}`}</td>
                                    {
                                        item.docStatus != DocSTATUS.PROVEDEN &&
                                        item.docValues?.receiverId == user?.sectionId &&
                                        item.documentType != DocumentType.LeaveCash &&
                                        !isDocumentDateBanned(item.date, mainData.settings?.dateBanEditing) &&
                                        <td><button 
                                            className={cn(styles.receiveBtn)}
                                            onClick={()=>setProvodkaByReciever(item.id, item.docStatus == DocSTATUS.PROVEDEN , setMainData, mainData, item.date)}
                                            >Кабул килиш</button></td>
                                    }
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            }
            
        </>
    )
}
