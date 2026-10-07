'use client'
import { CashOperationsItemProps } from './cashOperationsItem.props';
import styles from './cashOperationsItem.module.css';
import cn from 'classnames';
import { Htag } from '@/app/components';
import { numberValue } from '@/app/service/common/converters';
import { Schet } from '@/app/interfaces/report.interface';
import { secondsToDateString } from '@/app/components/documents/document/doc/helpers/doc.functions';
import { getDocument, getNameReference, getUserName } from '@/app/components/journals/journal/helpers/journal.functions';
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { useAppContext } from '@/app/context/app.context';

export const CashOperationsItem = ({className, item, references, ...props }: CashOperationsItemProps) :JSX.Element => {
    const { mainData, setMainData } = useAppContext();
    const token = mainData.users.user?.token;
    const contentName = mainData.document.contentName;

    const openDocument = (docId: number | string | undefined | null) => {
        if (!docId) return;
        getDocument(Number(docId), setMainData, token, mainData, contentName);
    };
    // Получаем справочник STORAGE по sectionId и проверяем isForeign
    const getStorageReference = (storageId: number | undefined | null) => {
        if (references && references.length > 0 && storageId) {
            return references.find((ref: any) => ref.id === storageId);
        }
        return null;
    };
    
    const storageReference = getStorageReference(item?.sectionId);
    const isForeignStorage = storageReference?.refValues?.isForeign === true;

    // Строки таблицы: считаем кирим/чиким и фильтруем те, где оба значения = 0
    const rows = [...(item?.results ?? [])]
        // Сортировка по дате (от старых к новым).
        // `date` здесь приходит как timestamp в секундах (см. secondsToDateString),
        // поэтому сортируем числом, а не через new Date("1738...").
        .sort((a: any, b: any) => Number(a?.date ?? 0) - Number(b?.date ?? 0))
        .map((element: any) => {
            let debet = 0;
            let kredit = 0;
            let firstSubcontoId = -1;
            let secondSubcontoId = -1;

            if (element.debet == Schet.S50 && element.debetFirstSubcontoId == item?.sectionId) {
                debet = Number(isForeignStorage ? element.usd : element.total) || 0;
                firstSubcontoId = element.kreditFirstSubcontoId;
                secondSubcontoId = element.kreditSecondSubcontoId;
            }
            if (element.kredit == Schet.S50 && element.kreditFirstSubcontoId == item?.sectionId) {
                kredit = Number(isForeignStorage ? element.usd : element.total) || 0;
                firstSubcontoId = element.debetFirstSubcontoId;
                secondSubcontoId = element.debetSecondSubcontoId;
            }

            // Для межпредприятийного LeaveCash аналитика лежит во 2-м субконто контр-стороны.
            // Показываем её в колонке "Изох", т.к. в "Объект" виден общий склад (COMMON), а не аналитика.
            const isGlobalLeaveCash =
                element?.documentType === 'LeaveCash' &&
                (element?.debet === Schet.S41 || element?.kredit === Schet.S41);

            const analiticName = isGlobalLeaveCash
                ? getNameReference(references, secondSubcontoId)
                : '';

            const izoh = analiticName
                ? `ким учун: ${analiticName}${element?.description ? ` | ${element.description}` : ''}`
                : (element?.description || '-');

            const userName =
                element?.document?.user?.name ||
                (element?.document?.userId
                    ? getUserName(element.document.userId, mainData)
                    : '') ||
                '-';

            return { element, debet, kredit, firstSubcontoId, secondSubcontoId, izoh, userName };
        })
        .filter((r) => !(r.debet === 0 && r.kredit === 0));
    
    return (
       <>
          <div className={styles.item}>
            <Htag tag='h1'>{item?.section}</Htag>
            
                        
            <div className={styles.sumBox}>
                <div className={styles.row}>
                    <div className={styles.title}>Бошлангич колдик</div>
                    <div className={styles.value}>{item?.startBalans ? numberValue(item?.startBalans) : 'колдик мавжуд эмас'}</div>
                </div>
                
                {rows.length > 0 && (
                    <div className={styles.resultsTable}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.tableHeader}>№</th>
                                    <th className={styles.tableHeader}>Сана</th>
                                    <th className={styles.tableHeader}>Хужжат тури</th>
                                    <th className={styles.tableHeader}>Объект</th>
                                    <th className={styles.tableHeader}>Изох</th>
                                    <th className={styles.tableHeader}>Фойдаланувчи</th>
                                    <th className={styles.tableHeader}>Кирим</th>
                                    <th className={styles.tableHeader}>Чиким</th>

                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(({ element, debet, kredit, firstSubcontoId, izoh, userName }, key: number) => {
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
                                        <td className={cn(styles.tableCell, styles.user)}>{userName}</td>
                                        <td className={cn(styles.tableCell, styles.debet)}>{numberValue(debet)}</td>
                                        <td className={cn(styles.tableCell, styles.kredit)}>{numberValue(kredit)}</td>
                                    </tr>
                                )})}
                            </tbody>
                            <tfoot>
                                <tr className={cn(styles.tableRow, styles.totalRow)}>
                                    <td className={cn(styles.tableCell, styles.total)} colSpan={6}>Жами</td>
                                    <td className={cn(styles.tableCell, styles.total)}>
                                        {numberValue(
                                            item.results
                                                .filter((element: any) => 
                                                    element.debet == Schet.S50 && element.debetFirstSubcontoId == item?.sectionId
                                                )
                                                .reduce((sum: number, element: any) => sum + (isForeignStorage ? element.usd : element.total || 0), 0)
                                        )}
                                    </td>
                                    <td className={cn(styles.tableCell, styles.total)}>
                                        {numberValue(
                                            item.results
                                                .filter((element: any) => 
                                                    element.kredit == Schet.S50 && element.kreditFirstSubcontoId == item?.sectionId
                                                )
                                                .reduce((sum: number, element: any) => sum + (isForeignStorage ? element.usd : element.total || 0), 0)
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {rows.length === 0 && (
                    <div className={styles.resultsTable}>
                        <div className={styles.empty}>Маълумот мавжуд эмас</div>
                    </div>
                )}

                
                <div className={styles.row}>
                    <div className={styles.title}>Охирги колдик</div> 
                    <div className={styles.value}>{item?.endBalans ? numberValue(item?.endBalans) : 'колдик мавжуд эмас'}</div>
                </div>  
            </div>
            
          </div>
      </>
    )
} 