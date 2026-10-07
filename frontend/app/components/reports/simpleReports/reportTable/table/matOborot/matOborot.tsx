'use client'
import { MatOborotProps } from './matOborot.props';
import { MatOborotItem } from './matOborotItem/matOborotItem';
import styles from './matOborot.module.css';
import { useAppContext } from '@/app/context/app.context';
import { getMatOborotTypeTitle } from '@/app/service/reports/matOborotTypes';

const TableHead = () => (
    <thead>
        <tr>
            <td>№</td>
            <td>ТМБ</td>
            <td>Артикул</td>
            <td>улч. бир.</td>
            <td>Колдик сон</td>
            <td>Колдик сумма</td>
            <td>Кирим сон</td>
            <td>Кирим сумма</td>
            <td>Чиким сон</td>
            <td>Чиким сумма</td>
            <td>Колдик сон</td>
            <td>Колдик сумма</td>
        </tr>
    </thead>
);

export const MatOborot = ({className, ...props }: MatOborotProps) :JSX.Element => {
    const { mainData } = useAppContext()
    const { matOborot, reportOption } = mainData.report
    const { firstReferenceId, schet } = reportOption

    const datas = matOborot ? matOborot[0]?.values : []
    const sectionTitle = getMatOborotTypeTitle(schet)

    const filterByWarehouse = (item: { sectionId?: number }) => {
        if (firstReferenceId) return item.sectionId == firstReferenceId
        return true
    }

    // Fallback для старой структуры данных (без accountType)
    const hasAccountTypes = datas.some((item: { accountType?: string }) => item.accountType)
    if (!hasAccountTypes && datas.length > 0) {
        return (
            <div className={styles.matOborotRoot}>
            <table className={`${styles.table} ${styles.tableOnlyHead}`}>
                <TableHead />
                {
                    datas
                    .filter(filterByWarehouse)
                    .map((element: any, key: number) => {
                        if (!element?.items.length) return (
                            <tbody key={`empty-fallback-${key}`}>
                                <tr><td colSpan={12} style={{textAlign: 'center', padding: '20px'}}>Нет данных</td></tr>
                            </tbody>
                        )
                        return <MatOborotItem 
                            key={key}
                            item={element}
                            section={element.section}
                        />
                    })
                }
            </table>
            </div>
        )
    }

    const filteredDatas = datas.filter(filterByWarehouse)

    if (filteredDatas.length === 0) {
        return (
            <div>
                {sectionTitle} бўйича маълумот мавжуд эмас
            </div>
        )
    }

    return (
       <div className={styles.matOborotRoot}>
            <div className={styles.sectionContainer}>
                <h3 className={styles.sectionTitle}>{sectionTitle}</h3>
                <table className={styles.table}>
                    <TableHead />
                    {filteredDatas.map((element: any, key: number) => {
                        if (!element?.items.length) return (
                            <tbody key={`empty-${key}`}>
                                <tr><td colSpan={12} style={{textAlign: 'center', padding: '20px'}}>Нет данных</td></tr>
                            </tbody>
                        )
                        return <MatOborotItem 
                            key={key}
                            item={element}
                            section={element.section}
                        />
                    })}
                </table>
            </div>
       </div>
    )
} 
