'use client'
import { OborotkaItemProps } from './oborotkaItem.props';
import styles from './oborotkaItem.module.css';
import { numberValue } from '@/app/service/common/converters';
import { fetchAnaliticEntries } from '@/app/service/reports/getAnalitic';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';
import { useAppContext } from '@/app/context/app.context';
import { DEBETKREDIT, EntryItem } from '@/app/interfaces/report.interface';
import { useCallback, useState } from 'react';
import { MatOborotEntriesModal } from '../../matOborot/matOborotItem/MatOborotEntriesModal';

export const OborotkaItem = ({className, item, ...props }: OborotkaItemProps) :JSX.Element => {
    
    const {mainData, setMainData} = useAppContext();
    const [showInners, setShowInners] = useState<boolean>(false)
    const [entriesModal, setEntriesModal] = useState<{
        open: boolean;
        loading: boolean;
        title: string;
        entries: EntryItem[];
    }>({ open: false, loading: false, title: '', entries: [] });
    const plus = showInners ? '-':'+';

    let saldoStart = item?.POSUM
    let saldoEnd = item?.KOSUM

    const closeEntriesModal = useCallback(() => {
        setEntriesModal({ open: false, loading: false, title: '', entries: [] });
    }, []);

    const openEntries = useCallback(
        async (
            firstSubcontoId: number | string,
            secondSubcontoId: number | string | null | undefined,
            dk: DEBETKREDIT,
            title: string,
        ) => {
            const { startDate, endDate } = mainData.report.reportOption;
            setEntriesModal({ open: true, loading: true, title, entries: [] });
            try {
                const entries = await fetchAnaliticEntries(
                    mainData,
                    firstSubcontoId,
                    secondSubcontoId,
                    dk,
                    undefined,
                    { startDate, endDate },
                );
                setEntriesModal({ open: true, loading: false, title, entries });
            } catch {
                setEntriesModal({ open: true, loading: false, title, entries: [] });
            }
        },
        [mainData],
    );

    const handleSelectDocument = useCallback(
        (docId: number) => {
            closeEntriesModal();
            void getDocument(
                docId,
                setMainData,
                mainData.users.user?.token,
                mainData,
                mainData.document.contentName,
            );
        },
        [closeEntriesModal, setMainData, mainData],
    );

    return (
       <>
        <thead>
          <tr className={styles.sectionName}>
            <td 
                className={styles.plus} 
                onClick={() => setShowInners(showInners => !showInners)
                }>
                  {plus}
            </td>
            <td className={styles.title}>{item?.name}</td>
            <td className={styles.totalTd}>{numberValue(saldoStart>0 ? saldoStart : 0)}</td>
            <td className={styles.totalTd}>{numberValue(saldoStart<=0 ?(-1)*saldoStart:0)}</td>
            <td 
                className={`${styles.totalTd} ${styles.clickable}`}
                onDoubleClick={() => openEntries(item?.sectionId, undefined, DEBETKREDIT.DEBET, item?.name)}
                >
                  {numberValue(item?.TDSUM)}
            </td>
            <td 
                className={`${styles.totalTd} ${styles.clickable}`}
                onDoubleClick={() => openEntries(item?.sectionId, undefined, DEBETKREDIT.KREDIT, item?.name)}
                >
                  {numberValue(item?.TKSUM)}
            </td>
            <td>{numberValue(saldoEnd > 0 ? saldoEnd : 0)}</td>
            <td>{numberValue(saldoEnd <= 0 ? (-1)*saldoEnd: 0)}</td>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
            {
                item?.subItems &&
                showInners &&
                item?.subItems.length &&
                item?.subItems.map((element:any, key:number) => {
                    if (element?.subTDSUM == 0 && element?.subTKSUM == 0) return null;
                    return (
                        <tr key={key} className={styles.innerItems}>
                          <td className={styles.number}>{key+1}</td>
                          <td id='itemName' className={styles.title}>{element?.name}</td>

                          <td></td>
                          <td></td>
                          <td 
                            className={styles.clickable}
                            onDoubleClick={() => openEntries(item?.sectionId, element?.sectionId, DEBETKREDIT.DEBET, element?.name)}
                            >
                              {numberValue(element?.subTDSUM)}
                          </td>
                          
                          <td
                            className={styles.clickable}
                            onDoubleClick={() => openEntries(item?.sectionId, element?.sectionId, DEBETKREDIT.KREDIT, element?.name)}
                            >
                              {numberValue(element?.subTKSUM)}
                          </td>
                          
                          <td></td>
                          <td></td>
                        </tr>
                    )
                })

            }
            
        </tbody>

        <MatOborotEntriesModal
            isOpen={entriesModal.open}
            onClose={closeEntriesModal}
            title={entriesModal.title}
            loading={entriesModal.loading}
            entries={entriesModal.entries}
            references={mainData.reference?.allReferences}
            onSelectDocument={handleSelectDocument}
        />
        
      </>
    )
} 
