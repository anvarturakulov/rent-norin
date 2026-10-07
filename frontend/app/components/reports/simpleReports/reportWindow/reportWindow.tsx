import { ReportWindowProps } from './reportWindow.props'
import OptionsBox from '../optionsBox/optionsBox'
import { useAppContext } from '@/app/context/app.context'
import ReportTable from '../reportTable/reportTable'
import LoadingIco from '@/app/components/common/loading.svg'
import loadingStyles from '@/app/components/common/loading.module.css'
import Header from '@/app/components/common/header/header'
import { Doc } from '@/app/components/documents/document/doc/doc'
import styles from './reportWindow.module.css'
import { useRef, useLayoutEffect, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { restoreReportScrollAfterDocument } from '@/app/service/common/reportScrollPreservation'
import { generateSimpleReport } from '@/app/service/reports/generateSimpleReport'
import cn from 'classnames'

export default function ReportWindow({ className, ...props }: ReportWindowProps): JSX.Element {
    const { mainData, setMainData } = useAppContext()
    const { reportOption } = mainData.report
    const { startReport } = reportOption
    const { uploadingDashboard } = mainData.window
    const { showDocumentWindow, contentTitle } = mainData.document

    const printRef = useRef<HTMLDivElement>(null)
    const wasDocumentOpenRef = useRef(showDocumentWindow)
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: contentTitle,
    })

    useLayoutEffect(() => {
        if (wasDocumentOpenRef.current && !showDocumentWindow) {
            restoreReportScrollAfterDocument()
        }
        wasDocumentOpenRef.current = showDocumentWindow
    }, [showDocumentWindow])

    const handleBack = useCallback(() => {
        if (!setMainData || uploadingDashboard) return
        setMainData('reportOption', { ...reportOption, startReport: false })
    }, [setMainData, reportOption, uploadingDashboard])

    const handleRefresh = useCallback(() => {
        if (!setMainData || uploadingDashboard) return
        generateSimpleReport(setMainData, mainData)
    }, [setMainData, mainData, uploadingDashboard])

    const showReportActions = startReport && !showDocumentWindow

    return (
        <div className={styles.container}>
            <Header
                windowFor="report"
                onPrint={showReportActions ? () => handlePrint() : undefined}
                onBack={showReportActions ? handleBack : undefined}
                onRefresh={showReportActions ? handleRefresh : undefined}
            />
            {showDocumentWindow && (
                <div className={styles.docContainer}>
                    <Doc />
                </div>
            )}

            {!showDocumentWindow && !startReport && !uploadingDashboard && <OptionsBox />}

            {startReport && (
                <div className={cn({ [styles.reportBodyHidden]: showDocumentWindow })}>
                    <ReportTable ref={printRef} />
                </div>
            )}

            {!showDocumentWindow && uploadingDashboard && (
                <LoadingIco className={loadingStyles.loadingIco} />
            )}
        </div>
    )
}
