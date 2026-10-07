import styles from './reportTable.module.css';
import { ReportTableProps } from './reportTable.props';
import { forwardRef, useEffect, useRef } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { ReportType } from '@/app/interfaces/report.interface';
import { MatOborot } from './table/matOborot/matOborot';
import { OsOborot } from './table/osOborot/osOborot';
import { Oborotka } from './table/oborotka/oborotka';
import { Personal } from './table/personal/personal';
import { MediatorPersonal } from './table/mediatorPersonal/mediatorPersonal';
import { DelivererPersonal } from './table/delivererPersonal/delivererPersonal';
import { Clients } from './table/clients/clients';
import { AktSverka } from './table/aktSverka/aktSverka';
import { useReportMeta } from '../hooks/useReportMeta';

const ReportTable = forwardRef<HTMLDivElement, ReportTableProps>(function ReportTable(
    { className, ...props },
    ref,
) {
    const { mainData } = useAppContext();
    const { contentName } = mainData.document;
    const { startReport } = mainData.report.reportOption;

    const reportMeta = useReportMeta();
    const matOborotScrollRef = useRef<HTMLDivElement>(null);

    const isMatOborot = contentName == ReportType.MatOborot;

    useEffect(() => {
        if (!startReport || !isMatOborot) return;
        const scroll = matOborotScrollRef.current;
        if (!scroll) return;
        scroll.style.setProperty('--report-title-offset', '0px');
    }, [startReport, isMatOborot]);

    if (!startReport) return <></>;

    const titleBox = reportMeta && (
        <div className={`${styles.titleBox} ${styles.titleBoxPrintOnly}`}>
            <div className={styles.title}>{reportMeta.reportTitle}</div>
            {reportMeta.enterpriseLine && (
                <div className={styles.organization}>{reportMeta.enterpriseLine}</div>
            )}
            <div className={styles.metaLine}>{reportMeta.periodLine}</div>
            <div className={styles.metaLine}>{reportMeta.scopeLine}</div>
        </div>
    );

    return (
        <div
            className={`${styles.container} ${className ?? ''}`}
            ref={ref}
            {...props}
        >
            {isMatOborot ? (
                <div
                    ref={matOborotScrollRef}
                    data-report-scroll
                    className={styles.matOborotReportScroll}
                >
                    {titleBox}
                    <MatOborot />
                </div>
            ) : (
                <>
                    {titleBox}
                    {contentName == ReportType.OsOborot && <OsOborot />}
                    {contentName == ReportType.Oborotka && <Oborotka />}
                    {contentName == ReportType.Personal && <Personal />}
                    {contentName == ReportType.MediatorPersonal && <MediatorPersonal />}
                    {contentName == ReportType.DelivererPersonal && <DelivererPersonal />}
                    {contentName == ReportType.Clients && <Clients />}
                    {contentName == ReportType.AktSverka && <AktSverka />}
                </>
            )}
        </div>
    );
});

export default ReportTable;
