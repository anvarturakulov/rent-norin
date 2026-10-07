'use client';
import { InformationProps } from './inform.props';
import styles from './inform.module.css';
import { RefreshPanel } from './refreshPanel/refreshPanel';
import { useRef, useCallback, useLayoutEffect } from 'react';
import { getReportByType } from './helper';
import LoadingIco from '@/app/components/common/loading.svg';
import loadingStyles from '@/app/components/common/loading.module.css';
import { Button } from '../../common/button/Button';
import { totalByKey, totalByKeyForFinancial } from './utils/calculations';
import { useInform } from './hooks/useInform';
import {  useTelegramSender } from './hooks/other';
import { useReactToPrint } from 'react-to-print';
import PrintIco from '../simpleReports/reportTable/ico/print.svg';
import { useAppContext } from '@/app/context/app.context';
import { Doc } from '@/app/components/documents/document/doc/doc';
import { restoreReportScrollAfterDocument } from '@/app/service/common/reportScrollPreservation';
import cn from 'classnames';

const LANDSCAPE_REPORTS = new Set(['FoydaByOrder', 'FoydaByProduction', 'ContractFulfillment', 'ClientsContractsWork']);

const LANDSCAPE_PAGE_STYLE = `
  @page { size: A4 landscape; margin: 10mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

export const Inform = ({ className, ...props }: InformationProps): JSX.Element => {
  const { mainData } = useAppContext();
  const { showDocumentWindow } = mainData.document;
  const {
    uploadingDashboard,
    informData,
    dashboardCurrentReportType,
    dateStartInStr,
    dateEndInStr,
    showPdfButton,
  } = useInform();
  
  
  const reportRef = useRef<HTMLDivElement>(null);
  const wasDocumentOpenRef = useRef(showDocumentWindow);
  const { sendToTelegram } = useTelegramSender();

  // После закрытия Doc отчёт снова в DOM — вернуть позицию (дубль к вызову в handleClose/cancel)
  useLayoutEffect(() => {
    if (wasDocumentOpenRef.current && !showDocumentWindow) {
      restoreReportScrollAfterDocument();
    }
    wasDocumentOpenRef.current = showDocumentWindow;
  }, [showDocumentWindow]);

  // Обработчик для отправки PDF
  const handleSendToTelegram = useCallback(() => {
    sendToTelegram(reportRef, dateStartInStr, dateEndInStr);
  }, [sendToTelegram, dateStartInStr, dateEndInStr]);

  // Печать (иконка как в простых отчетах)
  const documentTitle = `${dashboardCurrentReportType} ${dateStartInStr} - ${dateEndInStr}`;
  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle,
    pageStyle: LANDSCAPE_REPORTS.has(dashboardCurrentReportType) ? LANDSCAPE_PAGE_STYLE : undefined,
  });

  return (
    <div ref={reportRef} className={styles.container} {...props}>
      <div className={styles.headerTitleBox}>
        <div className={styles.headerTitle}>Асосий натижалар</div>
        <div className={styles.headerTitleText}>
            Жамланма маълумотлар
        </div>
      </div>

      <div className={styles.refreshPanelWrapper}>
        <RefreshPanel />
      </div>

      {showDocumentWindow && (
        <div className={styles.docContainer}>
          <Doc />
        </div>
      )}
      
      <div className={cn(styles.reportBody, { [styles.reportBodyHidden]: showDocumentWindow })}>
        {getReportByType(dashboardCurrentReportType, informData)}
        {uploadingDashboard && (
          <div className={styles.loadingOverlay} aria-busy="true" aria-live="polite">
            <LoadingIco className={loadingStyles.loadingIco} />
          </div>
        )}
      </div>

      {!showDocumentWindow && showPdfButton && (
        <Button 
          appearance='primary' 
          onClick={handleSendToTelegram} 
          className={styles.pdfBtn}
        >
          Архивга олиш
        </Button>
      )}
      {!showDocumentWindow && (
      <PrintIco onClick={handlePrint} className={styles.printIco} />
      )}
    </div>
  );
};

// Экспортируем утилитарные функции для использования в других компонентах
export { totalByKey, totalByKeyForFinancial };
