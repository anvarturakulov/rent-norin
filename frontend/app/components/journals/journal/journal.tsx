'use client'
import React, { useEffect, useMemo, useState, useCallback, memo, useRef } from 'react';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import cn from 'classnames';
import styles from './journal.module.css';
import { JournalProps } from './journal.props';
import Header from '../../common/header/header';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { deleteItemDocument, getDocument, setProvodkaToDoc } from './helpers/journal.functions';
import { DocumentType } from '@/app/interfaces/document.interface';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { getTodayRange } from '@/app/service/common/dateRanges';
import Footer from '../../common/footer/footer';
import { CheckBoxInFooter } from '../components/checkBoxInFooter/checkBoxInFooter';
import { dashboardUsersList } from '@/app/interfaces/user.interface';
import { Doc } from '../../documents/document/doc/doc';
import { getTotals } from './journal.helpers';
import {
  JournalFilterRule,
  countActiveJournalFilterRules,
  createDefaultJournalFilterRules,
} from './constants';
import { buildUrl, totals } from './helpers/journal.utils';
import { useDocumentFilter } from './hooks/useDocumentFilter';
import LoadingIco from '@/app/components/common/loading.svg';
import loadingStyles from '@/app/components/common/loading.module.css';
import { TableRow } from './components/TableRow';
import { GateIncomeTableRow } from './components/GateIncomeTableRow';
import { isDocumentWithAnalitic } from '@/app/service/documents/isDocumentWithAnalitic';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { useReactToPrint } from 'react-to-print';
import { PrintRegistry } from './components/PrintRegistry';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TablePagination,
} from '@/app/components/common/tablePagination/TablePagination';
import {
  buildJournalMetaUrl,
  isJournalMetaDocumentType,
} from '@/app/service/documents/getJournalMeta';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { FurnitureOrder } from '@/app/interfaces/furnitureOrder.interface';
import {
  buildOrdersByIdMap,
  showsOrderInJournal,
} from './helpers/orderJournal';
import { showsToolsRentalInJournal } from './helpers/toolsRentalJournal';
import { getOptionOfDocumentElements } from '@/app/service/documents/getOptionOfDocumentElements';
import { applyJournalAdvancedFilter } from './helpers/applyJournalAdvancedFilter';
import { JournalFilterModal } from './components/JournalFilterModal';

const Journal = memo<JournalProps>(({ className, ...props }): JSX.Element => {
    
    const {mainData, setMainData} = useAppContext();
    const {dateStart, dateEnd} = mainData.journal.interval;
    const {
        journalChechboxs,
        updateDataForDocumentJournal,
        activeTab: contextActiveTab,
        lastActedDocumentId,
        navigateToLastActedDocument,
    } = mainData.journal;
    const [isDisabled, setIsDisabled] = useState(false);
    type TabType = 'CASH' | 'BANK' | 'USD' | 'PLASTIK';
    const activeTab = contextActiveTab || 'CASH';
    
    const printRef = useRef<HTMLDivElement>(null);
    const setActiveTab = (tab: TabType) => {
        setMainData && setMainData('activeTab', tab);
    };

    let dateStartForUrl = dateStart
    let dateEndForUrl = dateEnd

    if (!dateStart && !dateEnd) {
        const today = getTodayRange()
        dateStartForUrl = today.start
        dateEndForUrl = today.end
    }
    
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Реестр - ${dateNumberToString(dateStartForUrl)} - ${dateNumberToString(dateEndForUrl)}`,
        pageStyle: `
            @page { size: A4 landscape; margin: 10mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        `,
    });
    const [filterRules, setFilterRules] = useState<JournalFilterRule[]>(() =>
        createDefaultJournalFilterRules(),
    );
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [tablePage, setTablePage] = useState(1);
    const [journalMetaRequested, setJournalMetaRequested] = useState(false);
    const filterKey = useMemo(() => JSON.stringify(filterRules), [filterRules]);
    const checkboxKey = useMemo(() => JSON.stringify(journalChechboxs), [journalChechboxs]);
    const activeFilterCount = useMemo(
        () => countActiveJournalFilterRules(filterRules),
        [filterRules],
    );

    const { user } = mainData.users;
    const { showDocumentWindow, contentName } = mainData.document;
    const role = user?.role;
    const dashboardUsers = role && dashboardUsersList.includes(role);
    const showOrderColumn = showsOrderInJournal(contentName);
    const showToolsRentalColumns = showsToolsRentalInJournal(contentName);

    const docFieldOptions = useMemo(() => {
        if (!contentName || contentName === 'ALL_DOCUMENTS') return null;
        return getOptionOfDocumentElements(contentName);
    }, [contentName]);

    const isAllDocuments = contentName === 'ALL_DOCUMENTS';

    // Определяем, нужно ли показывать вкладки для текущего типа документа
    const shouldShowTabs = contentName === DocumentType.LeaveCash || 
                          contentName === DocumentType.MoveCash || 
                          contentName === DocumentType.ComeCashFromClients ||
                          contentName === DocumentType.Advance;

    const token = user?.token;
    const enterpriseId = user?.enterpriseId;
    const urlReferences = process.env.NEXT_PUBLIC_DOMAIN+'/api/references/all/';

    const { data : references, mutate: mutateReferences, isLoading: isLoadingReferences } = useSWR(urlReferences, (urlReferences) => getDataForSwr(urlReferences, token));
    const { data : enterprises } = useSWR(token ? 'enterprises' : null, () => getEnterprises(token));

    const { data: furnitureOrders } = useSWR<FurnitureOrder[]>(
        token && enterpriseId && showOrderColumn
            ? ['journal-order-labels', token, enterpriseId]
            : null,
        () => foApi.getOrders(token!, Number(enterpriseId)),
    );

    const ordersById = useMemo(
        () => buildOrdersByIdMap(furnitureOrders),
        [furnitureOrders],
    );

    // Определяем URL для загрузки документов
    const url = useMemo(() => {
        // Для всех документов используем специальный endpoint
        if (contentName === 'ALL_DOCUMENTS') {
            const params = new URLSearchParams();
            params.append('dateStart', dateStartForUrl.toString());
            params.append('dateEnd', dateEndForUrl.toString());
            if (enterpriseId !== undefined && enterpriseId !== null) {
                params.append('enterpriseId', enterpriseId.toString());
            }
            return `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/byDate?${params}`;
        }
        return buildUrl(contentName, dateStartForUrl, dateEndForUrl, enterpriseId);
    }, [contentName, dateStartForUrl, dateEndForUrl, enterpriseId]);

    const {
        data: documents,
        mutate,
        isLoading: isLoadingDocuments,
        isValidating: isValidatingDocuments,
    } = useSWR(url, (url) => getDataForSwr(url, token));

    const journalMetaUrl = useMemo(() => {
        if (!isJournalMetaDocumentType(contentName)) return null;
        return buildJournalMetaUrl(contentName);
    }, [contentName]);

    const swrJournalMetaKey =
        token && journalMetaUrl && journalMetaRequested ? journalMetaUrl : null;

    const {
        data: journalMeta,
        mutate: mutateJournalMeta,
        isLoading: isJournalMetaLoading,
    } = useSWR(swrJournalMetaKey, (metaUrl) => getDataForSwr(metaUrl, token));

    useEffect(() => {
        setJournalMetaRequested(false);
        setFilterRules(createDefaultJournalFilterRules());
        setFilterModalOpen(false);
    }, [contentName]);

    const allDocumentsOrgOptions = useMemo(() => {
        if (!isAllDocuments || !Array.isArray(references)) return [];
        return (references as ReferenceModel[]).filter(
            (item) =>
                (item.typeReference === TypeReference.PARTNERS ||
                    item.typeReference === TypeReference.STORAGES) &&
                item.refValues?.markToDeleted !== true,
        );
    }, [isAllDocuments, references]);

    const handleJournalMetaClick = useCallback(() => {
        if (journalMetaRequested && journalMeta !== undefined) {
            mutateJournalMeta();
            return;
        }
        setJournalMetaRequested(true);
    }, [journalMetaRequested, journalMeta, mutateJournalMeta]);

    // Рефетч только после закрытия Doc или явного флага — не при открытии
    // (иначе SWR dedupe может вернуть список без только что созданного документа).
    const wasDocumentOpenRef = useRef(showDocumentWindow);
    const [isRefreshingJournal, setIsRefreshingJournal] = useState(false);
    useEffect(() => {
        const closedDocument = wasDocumentOpenRef.current && !showDocumentWindow;
        wasDocumentOpenRef.current = showDocumentWindow;

        if (!closedDocument && !updateDataForDocumentJournal) return;

        setIsRefreshingJournal(true);
        void mutate()
            .catch(() => undefined)
            .finally(() => setIsRefreshingJournal(false));
        mutateReferences();
        if (journalMetaUrl && journalMetaRequested) {
            mutateJournalMeta();
        }
        if (updateDataForDocumentJournal) {
            setMainData && setMainData('updateDataForDocumentJournal', false);
        }
    }, [showDocumentWindow, updateDataForDocumentJournal]);


    const baseFilteredDocuments = useDocumentFilter(
        documents,
        journalChechboxs,
        references,
        mainData,
        String(role || ''),
        contentName,
        activeTab,
    );

    const filteredDocuments = useMemo(
        () =>
            applyJournalAdvancedFilter(baseFilteredDocuments, filterRules, {
                references,
                enterprises,
                mainData,
                ordersById,
            }),
        [baseFilteredDocuments, filterRules, references, enterprises, mainData, ordersById],
    );

    const filteredDocumentsLength = filteredDocuments?.length ?? 0;
    const journalTotalPages = Math.max(
        1,
        Math.ceil(filteredDocumentsLength / DEFAULT_TABLE_PAGE_SIZE),
    );

    // При открытии и смене источника данных/фильтров — сразу последняя страница
    // (документы отсортированы от старых к новым).
    const openOnLastPageRef = useRef(true);
    useEffect(() => {
        openOnLastPageRef.current = true;
    }, [contentName, url, activeTab, filterKey, checkboxKey]);

    useEffect(() => {
        if (isLoadingDocuments || isValidatingDocuments || isRefreshingJournal) return;
        // Пока ждём документ по id — не гасим fallback на последнюю страницу
        if (navigateToLastActedDocument) return;
        if (!openOnLastPageRef.current) return;
        setTablePage(journalTotalPages);
        openOnLastPageRef.current = false;
    }, [
        contentName,
        url,
        activeTab,
        filterKey,
        checkboxKey,
        isLoadingDocuments,
        isValidatingDocuments,
        isRefreshingJournal,
        journalTotalPages,
        navigateToLastActedDocument,
    ]);

    useEffect(() => {
        if (tablePage > journalTotalPages) {
            setTablePage(journalTotalPages);
        }
    }, [tablePage, journalTotalPages]);

    const pageDocuments = useMemo(() => {
        if (!filteredDocuments || filteredDocuments.length === 0) return [];
        const start = (tablePage - 1) * DEFAULT_TABLE_PAGE_SIZE;
        return filteredDocuments.slice(start, start + DEFAULT_TABLE_PAGE_SIZE);
    }, [filteredDocuments, tablePage]);

    useEffect(() => {
        if (!navigateToLastActedDocument || !setMainData) return;
        if (isLoadingDocuments || isValidatingDocuments || isRefreshingJournal) return;

        if (lastActedDocumentId != null && lastActedDocumentId > 0 && filteredDocuments?.length) {
            const idx = filteredDocuments.findIndex((d) => d.id === lastActedDocumentId);
            if (idx >= 0) {
                setTablePage(Math.floor(idx / DEFAULT_TABLE_PAGE_SIZE) + 1);
                openOnLastPageRef.current = false;
                setMainData('journal.navigateToLastActedDocument', false);
                return;
            }
        }
        // Документ не найден после ревалидации — последняя страница как fallback
        if (openOnLastPageRef.current) {
            setTablePage(journalTotalPages);
            openOnLastPageRef.current = false;
        }
        setMainData('journal.navigateToLastActedDocument', false);
    }, [
        navigateToLastActedDocument,
        lastActedDocumentId,
        filteredDocuments,
        isLoadingDocuments,
        isValidatingDocuments,
        isRefreshingJournal,
        journalTotalPages,
        setMainData,
    ]);

    const { total, count, docCount, totalSecond, totalCost } = useMemo(() => {
        return getTotals(filteredDocuments, totals);
    }, [filteredDocuments]);


    return (
        <>
            {dashboardUsers && (
                <Header
                    windowFor='document'
                    total={total}
                    count={count}
                    onPrint={handlePrint}
                    onFilterClick={
                        contentName === DocumentType.GateIncome
                            ? undefined
                            : () => setFilterModalOpen(true)
                    }
                    activeFilterCount={activeFilterCount}
                    hasJournalMeta={!!journalMetaUrl}
                    journalMeta={journalMetaRequested ? journalMeta ?? null : undefined}
                    isJournalMetaLoading={journalMetaRequested && isJournalMetaLoading}
                    onJournalMetaClick={handleJournalMetaClick}
                />
            )}
            <>
                <div className={styles.newElement}>
                    {showDocumentWindow && <Doc/>}
                </div>
            </>
            {contentName !== DocumentType.GateIncome && (
                <JournalFilterModal
                    isOpen={filterModalOpen}
                    onClose={() => setFilterModalOpen(false)}
                    onApply={setFilterRules}
                    rules={filterRules}
                    contentName={contentName}
                    receiverType={docFieldOptions?.receiverType}
                    senderType={docFieldOptions?.senderType}
                    analiticType={docFieldOptions?.analiticType}
                    allDocumentsOrgOptions={allDocumentsOrgOptions}
                    enterprises={enterprises}
                />
            )}
            
            {
                dashboardUsers && !showDocumentWindow &&
                <div className={styles.container} >
                    {(isLoadingDocuments || isLoadingReferences) ? (
                        <LoadingIco className={loadingStyles.loadingIco} />
                    ) : (
                        <>
                            {shouldShowTabs && (
                                <div className={styles.tabs}>
                                    <button
                                        className={cn(styles.tab, {
                                            [styles.tabActive]: activeTab === 'CASH'
                                        })}
                                        onClick={() => setActiveTab('CASH')}
                                    >
                                        Накд
                                    </button>
                                    <button
                                        className={cn(styles.tab, {
                                            [styles.tabActive]: activeTab === 'USD'
                                        })}
                                        onClick={() => setActiveTab('USD')}
                                    >
                                        USD
                                    </button>
                                    <button
                                        className={cn(styles.tab, {
                                            [styles.tabActive]: activeTab === 'BANK'
                                        })}
                                        onClick={() => setActiveTab('BANK')}
                                    >
                                        Банк
                                    </button>
                                    <button
                                        className={cn(styles.tab, {
                                            [styles.tabActive]: activeTab === 'PLASTIK'
                                        })}
                                        onClick={() => setActiveTab('PLASTIK')}
                                    >
                                        Пластик
                                    </button>
                                </div>
                            )}
                            <table className={styles.table}>
                            <thead className={styles.thead}>
                                {contentName === DocumentType.GateIncome ? (
                                    <tr key='-1'>
                                        <th key='1' className={styles.rowId}>Раками</th>
                                        <th key='2' className={styles.rowDate}>Сана</th>
                                        <th key='3' className={styles.longRow}>Номер машины</th>
                                        <th key='4' className={styles.longRow}>Модель авто</th>
                                        <th key='5' className={styles.longRow}>Изох</th>
                                        <th key='6' className={styles.rowDate}>Холат</th>
                                        <th key='7' className={styles.longRow}>Фойдаланувчи</th>
                                        <th key='8' className={styles.rowAction}>Амал</th>
                                    </tr>
                                ) : (
                                    <tr key='-1' className={styles.headerRow}>
                                        <th key='1' className={styles.rowId}>Раками</th>
                                        <th key='2' className={styles.rowDate}>Сана</th>
                                        <th key='3' className={styles.longRow}>Корхона</th>
                                        {contentName === 'ALL_DOCUMENTS' && (
                                            <th key='4' className={styles.longRow}>Хужжат тури</th>
                                        )}
                                        <th key='5' className={styles.rowSumma}>Сумма</th>
                                        {showToolsRentalColumns && (
                                            <th key='5.1' className={styles.toolsRentalCompact}>Ижара</th>
                                        )}
                                        {(contentName === 'ALL_DOCUMENTS' ||
                                            contentName === DocumentType.LeaveCash ||
                                            contentName === DocumentType.MoveCash ||
                                            contentName === DocumentType.Advance) && (
                                            <th key='5.5' className={styles.rowSumma}>USD</th>
                                        )}
                                        <th key='6' className={styles.longRow}>Олувчи</th>
                                        <th key='7' className={styles.longRow}>Берувчи</th>
                                        {(contentName === 'ALL_DOCUMENTS' ||
                                            isDocumentWithAnalitic(contentName)) && (
                                            <th key='8' className={styles.longRow}>Аналитика</th>
                                        )}
                                        {showOrderColumn && (
                                            <th key='8.5' className={styles.longRow}>Заказ</th>
                                        )}
                                        <th key='9' className={styles.longRow}>Изох</th>
                                        <th key='10' className={styles.longRow}>Фойдаланувчи</th>
                                        <th key='11' className={styles.rowAction}>Учир.</th>
                                        <th key='12' className={styles.rowAction}>Чоп.</th>
                                        <th key='13' className={styles.rowAction}>Тасдик.</th>
                                        <th key='14' className={styles.rowAction}>Куч.</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className={styles.tbody}>
                                {pageDocuments.map((item, key) =>
                                    contentName === DocumentType.GateIncome ? (
                                        <GateIncomeTableRow
                                            key={item.id ?? `gate-${key}`}
                                            item={item}
                                            references={references}
                                            mainData={mainData}
                                            token={token}
                                            setMainData={setMainData}
                                            isDisabled={isDisabled}
                                            setIsDisabled={setIsDisabled}
                                            deleteItemDocument={deleteItemDocument}
                                            getDocument={getDocument}
                                            className={className}
                                        />
                                    ) : (
                                        <TableRow
                                            key={item.id ?? `doc-${key}`}
                                            item={item}
                                            references={references}
                                            enterprises={enterprises}
                                            mainData={mainData}
                                            token={token}
                                            setMainData={setMainData}
                                            isDisabled={isDisabled}
                                            setIsDisabled={setIsDisabled}
                                            deleteItemDocument={deleteItemDocument}
                                            setProvodkaToDoc={setProvodkaToDoc}
                                            getDocument={getDocument}
                                            className={className}
                                            contentName={contentName}
                                            isLastActed={item.id === lastActedDocumentId}
                                            ordersById={ordersById}
                                        />
                                    ),
                                )}
                            </tbody>
                        </table>
                        <TablePagination
                            page={tablePage}
                            pageSize={DEFAULT_TABLE_PAGE_SIZE}
                            totalItems={filteredDocumentsLength}
                            onPageChange={setTablePage}
                        />
                        <PrintRegistry
                            ref={printRef}
                            filteredDocuments={filteredDocuments ?? []}
                            contentName={contentName}
                            references={references}
                            enterprises={enterprises}
                            mainData={mainData}
                            dateStart={dateStartForUrl}
                            dateEnd={dateEndForUrl}
                            total={total}
                            count={count}
                            ordersById={ordersById}
                        />
                        </>
                    )}
                </div>
            }
            <div className={styles.footer}>
                {dashboardUsers && !showDocumentWindow && <Footer windowFor='document' total={total} count={count} docCount={docCount} totalSecond={totalSecond} totalCost={totalCost} label='Себестоимость' />} 
            {
                contentName == DocumentType.LeaveCash && !showDocumentWindow &&
                <div className={styles.checkboxs}>
                    <CheckBoxInFooter id='charges' label='Харажат'/>
                    <CheckBoxInFooter id='workers' label='Иш хаки'/>
                    <CheckBoxInFooter id='mediators' label='Воситачи'/>
                    <CheckBoxInFooter id='deliverers' label='Доставщик'/>
                    <CheckBoxInFooter id='partners' label='Таъминотчи'/>
                    <CheckBoxInFooter id='departments' label='Ички корхона'/>
                </div>
                
            }
            {/* {
                !showDocumentWindow && !mainData.settings?.singleEnterpriseMode &&
                <div className={styles.checkboxs}>
                    <CheckBoxInFooter id='pendingApproval' label='Тасдиклаш учун'/>
                </div>
            } */}

            </div>
            
            
        </>
    );
});

Journal.displayName = 'Journal';

export default Journal;
