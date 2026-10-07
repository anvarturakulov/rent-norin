import styles from './header.module.css'
import { HeaderProps } from './header.props'
import DateIco from './date.svg'
import { useAppContext } from '@/app/context/app.context';
import cn from 'classnames';
import { setNewDocumentParams } from '@/app/service/documents/setNewDocumentParams'
import { 
    getButtonText, 
    getFirstText, 
    getSecondText, 
    getDateRangeText,
    getJournalMetaText,
    JOURNAL_META_PLACEHOLDER,
} from './helpers/headerTextHelpers'
import { UserRoles } from '@/app/interfaces/user.interface'
import useSWR from 'swr';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { getTypeReference } from '@/app/service/references/getTypeReference';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { getSingleEnterpriseMode } from '@/app/service/settings/getSingleEnterpriseMode';
import { getDateBanEditingValue } from '@/app/service/settings/dateBanEditing';
import { canCreateReference } from '@/app/utils/referencePermissions';
import { useReportMeta } from '@/app/components/reports/simpleReports/hooks/useReportMeta';
import { DocumentType } from '@/app/interfaces/document.interface';
import {
    buildReadyRentalOrdersHeaderText,
    emptyReadyRentalOrders,
    isRentalToolsContent,
} from '@/app/service/documents/rentalOrders';
import { fetchReadyRentalOrders, readyRentalOrdersKey } from '@/app/service/documents/rentalOrdersApi';

export default function Header({
    windowFor,
    className,
    count,
    total,
    onPrint,
    onBack,
    onRefresh,
    onFilterClick,
    activeFilterCount = 0,
    hasJournalMeta,
    journalMeta,
    isJournalMetaLoading,
    onJournalMetaClick,
    ...props
}: HeaderProps): JSX.Element {
    
    const {mainData, setMainData} = useAppContext()
    const {dateStart, dateEnd} = mainData.journal.interval
    const {user} = mainData.users
    const {showReferenceWindow, isNewReference, selectedEnterpriseId } = mainData.reference 
    const {contentType, contentTitle, contentName, showDocumentWindow, isNewDocument } = mainData.document
    const {showSettingsWindow, isNewSetting, uploadingDashboard} = mainData.window
    const reportMeta = useReportMeta()
    const showReportMeta = windowFor === 'report' && !!reportMeta && !showDocumentWindow
    const showJournalMeta = windowFor === 'document' && !!hasJournalMeta && !showDocumentWindow
    const isRentalJournal = windowFor === 'document' && isRentalToolsContent(contentName)
    const journalMetaLoaded = journalMeta !== undefined
    const journalMetaText = journalMetaLoaded
        ? getJournalMetaText(journalMeta)
        : isJournalMetaLoading
            ? `${JOURNAL_META_PLACEHOLDER}...`
            : JOURNAL_META_PLACEHOLDER
    
    // Загружаем предприятия для отображения названия предприятия
    const token = user?.token;
    const rentalEnterpriseId =
        mainData.report?.selectedEnterpriseId ?? user?.enterpriseId ?? null;
    const readyRentalKey = isRentalJournal
        ? readyRentalOrdersKey(token, rentalEnterpriseId)
        : null;
    useSWR(
        readyRentalKey,
        () => fetchReadyRentalOrders(token, rentalEnterpriseId),
        {
            refreshInterval: 60_000,
            revalidateOnFocus: true,
            onSuccess: (payload) => {
                if (!setMainData) return;
                setMainData(
                    'rentalReadyOrders',
                    payload?.orders?.length ? payload : emptyReadyRentalOrders(),
                );
            },
        },
    );
    const readyRentalPayload = mainData.window.rentalReadyOrders;
    const readyRentalHint = isRentalJournal
        ? buildReadyRentalOrdersHeaderText(readyRentalPayload)
        : '';
    const { data: enterprises } = useSWR(
        token ? 'enterprises' : null,
        () => getEnterprises(token)
    );

    // Загружаем режим одного предприятия
    useSWR(
        token ? 'singleEnterpriseMode' : null,
        () => getSingleEnterpriseMode(token),
        {
            onSuccess: (data) => {
                if (data && setMainData) {
                    setMainData('settings.singleEnterpriseMode', data.singleEnterpriseMode);
                    setMainData(
                        'settings.avtoProvodkaInManyEnterpriseMode',
                        data.avtoProvodkaInManyEnterpriseMode ?? false
                    );
                }
            },
            revalidateOnFocus: false,
        }
    );

    useSWR(
        token ? 'dateBanEditing' : null,
        () => getDateBanEditingValue(token),
        {
            onSuccess: (value) => {
                if (setMainData) {
                    setMainData('settings.dateBanEditing', value ?? null);
                }
            },
            revalidateOnFocus: true,
        }
    );

    // Проверяем, нужно ли показывать переключатель предприятия для referencesList
    const referenceType = windowFor === 'reference' ? getTypeReference(contentName) : null;
    const showEnterpriseSelector = useMemo(() => {
        return false;
    }, []);

    // Обработчик изменения выбранного предприятия
    const handleEnterpriseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const newEnterpriseId = value === 'all' ? null : parseInt(value, 10);
        
        if (setMainData && newEnterpriseId !== selectedEnterpriseId) {
            setMainData('reference.selectedEnterpriseId', newEnterpriseId);
        }
    };

    let showAddBtn = windowFor === 'document' || windowFor === 'reference' || windowFor === 'settings'
    if (user?.role == UserRoles.GUEST) {
        showAddBtn = false
    }
    if (windowFor === 'reference' && referenceType && user) {
        showAddBtn = showAddBtn && canCreateReference(user, referenceType);
    }
    const showDateBtn = windowFor === 'document' || windowFor === 'gate'
    const isWindowOpen = showReferenceWindow || showDocumentWindow || showSettingsWindow
    const isNewItem = isNewReference || isNewDocument || isNewSetting

    const handleAddNewElement = useCallback(() => {
        if (!setMainData) return

        setMainData('clearControlElements', false);
        setNewDocumentParams(setMainData, mainData)
        
        if (windowFor === 'reference') {
            setMainData('currentReference', null);
            setMainData('showReferenceWindow', true);
            setMainData('isNewReference', true);    
        }

        if (windowFor === 'document') {
            setMainData('showDocumentWindow', true);
            setMainData('isNewDocument', true);
        }

        if (windowFor === 'settings') {
            setMainData('showSettingsWindow', true);
            setMainData('isNewSetting', true);
        }

    }, [setMainData, mainData, windowFor])

    useEffect(() => {
        if (!showAddBtn || isWindowOpen) return

        const isTypingTarget = (target: EventTarget | null): boolean => {
            if (!target || !(target instanceof HTMLElement)) return false
            if (target.isContentEditable) return true
            const tag = target.tagName
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        }

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Insert' && e.code !== 'Insert') return
            if (isTypingTarget(e.target)) return
            e.preventDefault()
            handleAddNewElement()
        }

        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [showAddBtn, isWindowOpen, handleAddNewElement])

    const handleDateClick = () => {
        setMainData && setMainData('showIntervalWindow', true)
    }

    const sentinelRef = useRef<HTMLDivElement>(null)
    const [isHeaderHidden, setIsHeaderHidden] = useState(false)

    useEffect(() => {
        if (windowFor !== 'document' || isWindowOpen) {
            setIsHeaderHidden(false)
            return
        }

        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsHeaderHidden(!entry.isIntersecting)
            },
            { threshold: 0 },
        )

        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [windowFor, isWindowOpen])

    const showFloatingPanel =
        windowFor === 'document' && !isWindowOpen && isHeaderHidden

    return (
        <>
            <div ref={sentinelRef} className={styles.scrollSentinel} aria-hidden />
            <div className={styles.headerBox}>
                <div className={styles.headerTitleBox}>
                    <div className={styles.headerTitleRow}>
                        <div className={styles.headerTitle}>{contentTitle}</div>
                        {contentName === DocumentType.OrderToolsToClient && (
                            <span className={cn(styles.docTypeBadge, styles.docTypeBadgeBlue)}>БУЮРТМА</span>
                        )}
                        {contentName === DocumentType.TransferToolsToClient && (
                            <span className={cn(styles.docTypeBadge, styles.docTypeBadgeGreen)}>ТОПШИРИШ</span>
                        )}
                        {contentName === DocumentType.ReceiveToolsFromClient && (
                            <span className={cn(styles.docTypeBadge, styles.docTypeBadgeRed)}>КАЙТАРИШ</span>
                        )}
                    </div>
                    <div className={styles.headerTitleText}>
                        <div className={cn(styles.title, {[styles.newWindow]: isNewItem})}>
                            {showReportMeta && reportMeta
                                ? reportMeta.reportTitle
                                : (isWindowOpen
                                    ? getFirstText(contentType, isNewDocument, isNewReference, isNewSetting)
                                    : getSecondText(contentType))}
                        </div>
                    </div>
                    {readyRentalHint && (
                        <button
                            type="button"
                            className={styles.readyOrdersHint}
                            onClick={() => setMainData && setMainData('showReadyRentalOrdersModal', true)}
                            title="Ёпиш мумкин бўлган буюртмалар"
                        >
                            <span className={styles.readyOrdersCount}>
                                {readyRentalPayload?.orders?.length || 0}
                            </span>
                            <span>{readyRentalHint}</span>
                        </button>
                    )}
                </div>
                
                {showAddBtn && !isWindowOpen && (
                    <div className={styles.addBtnBox}>
                        <button
                            type="button"
                            className={styles.addButton}
                            onClick={handleAddNewElement}
                            title={`Insert — ${getButtonText(contentType)}`}
                        >
                            <span>+</span> {getButtonText(contentType)}
                        </button>
                    </div>
                )}
            </div>

            {showReportMeta && reportMeta && !isWindowOpen && (
                <div className={styles.reportMetaBox}>
                    <div className={styles.reportMetaDetails}>
                        {reportMeta.enterpriseLine && (
                            <div className={styles.reportMetaLine}>{reportMeta.enterpriseLine}</div>
                        )}
                        <div className={styles.reportMetaLine}>{reportMeta.periodLine}</div>
                        <div className={styles.reportMetaLine}>{reportMeta.scopeLine}</div>
                    </div>
                    {(onBack || onPrint || onRefresh) && (
                        <div className={styles.rightActions}>
                            {onBack && (
                                <button
                                    type="button"
                                    className={styles.printBtn}
                                    onClick={onBack}
                                    disabled={uploadingDashboard}
                                >
                                    Орқага
                                </button>
                            )}
                            {onRefresh && (
                                <button
                                    type="button"
                                    className={styles.printBtn}
                                    onClick={onRefresh}
                                    disabled={uploadingDashboard}
                                >
                                    {uploadingDashboard ? 'Юкланмокда...' : 'Янгилаш'}
                                </button>
                            )}
                            {onPrint && (
                                <button
                                    type="button"
                                    className={styles.printBtn}
                                    onClick={onPrint}
                                    disabled={uploadingDashboard}
                                >
                                    Чоп этиш
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {(showAddBtn || showDateBtn || showEnterpriseSelector) && !isWindowOpen && !showReportMeta &&(
                <div className={styles.box}>
                    {showDateBtn && (
                        <div>{getDateRangeText(dateStart, dateEnd)}</div>

                    )}
                    {showDocumentWindow && <div></div>}
                    {showEnterpriseSelector && enterprises && Array.isArray(enterprises) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500' }}>Корхона:</label>
                            <select
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    fontSize: '14px',
                                    minWidth: '200px'
                                }}
                                value={selectedEnterpriseId === null || selectedEnterpriseId === undefined ? 'all' : selectedEnterpriseId.toString()}
                                onChange={handleEnterpriseChange}
                            >
                                <option value="all">Барча корхоналар</option>
                                {enterprises
                                    .filter((enterprise: any) => !enterprise.markToDeleted && enterprise.isActive !== false)
                                    .map((enterprise: any) => (
                                        <option key={enterprise.id} value={enterprise.id}>
                                            {enterprise.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}
                    <div className={styles.rightActions}>
                        {onFilterClick && (
                            <button
                                type="button"
                                className={cn(styles.printBtn, {
                                    [styles.filterBtnActive]: activeFilterCount > 0,
                                })}
                                onClick={onFilterClick}
                                title="Фильтр"
                            >
                                Фильтр{activeFilterCount > 0 ? `: ${activeFilterCount}` : ''}
                            </button>
                        )}
                        {onPrint && (
                            <button className={styles.printBtn} onClick={onPrint}>
                                🖨 Реестр
                            </button>
                        )}
                        {showDateBtn && (
                            <DateIco className={styles.ico} onClick={handleDateClick} />
                        )}
                    </div>
                </div>
            )}

            {showJournalMeta && (
                <div className={styles.journalMetaBox}>
                    <button
                        type="button"
                        className={cn(styles.journalMetaLine, styles.journalMetaButton, {
                            [styles.journalMetaButtonLoading]: isJournalMetaLoading,
                        })}
                        onClick={onJournalMetaClick}
                        disabled={isJournalMetaLoading}
                    >
                        {journalMetaText}
                    </button>
                </div>
            )}

            {showFloatingPanel && (
                <div className={styles.floatingPanel}>
                    <div className={styles.floatingInfo}>
                        <span className={styles.floatingTitle}>{contentTitle}</span>
                        <span className={styles.floatingSubtitle}>
                            {getSecondText(contentType)}
                        </span>
                        {showDateBtn && (
                            <button
                                type="button"
                                className={styles.floatingInterval}
                                onClick={handleDateClick}
                            >
                                {getDateRangeText(dateStart, dateEnd)}
                            </button>
                        )}
                        {hasJournalMeta && (
                            <button
                                type="button"
                                className={cn(styles.floatingJournalMeta, styles.journalMetaButton, {
                                    [styles.journalMetaButtonLoading]: isJournalMetaLoading,
                                })}
                                onClick={onJournalMetaClick}
                                disabled={isJournalMetaLoading}
                            >
                                {journalMetaText}
                            </button>
                        )}
                        {readyRentalHint && (
                            <button
                                type="button"
                                className={styles.readyOrdersHint}
                                onClick={() => setMainData && setMainData('showReadyRentalOrdersModal', true)}
                                title="Ёпиш мумкин бўлган буюртмалар"
                            >
                                <span className={styles.readyOrdersCount}>
                                    {readyRentalPayload?.orders?.length || 0}
                                </span>
                                <span>{readyRentalHint}</span>
                            </button>
                        )}
                    </div>
                    {showAddBtn && (
                        <button
                            type="button"
                            className={styles.addButton}
                            onClick={handleAddNewElement}
                            title={`Insert — ${getButtonText(contentType)}`}
                        >
                            <span>+</span> {getButtonText(contentType)}
                        </button>
                    )}
                </div>
            )}
        </>
    )
}

