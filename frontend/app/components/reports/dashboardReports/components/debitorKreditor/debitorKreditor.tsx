'use client'
import { DebitorKreditorProps } from './debitorKreditor.props';
import styles from './debitorKreditor.module.css';
import { numberValue } from '@/app/service/common/converters';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { DEBETKREDIT, Schet } from '@/app/interfaces/report.interface';
import {
  DebitKreditOborotModal,
  OborotSubcontoItem,
} from './DebitKreditOborotModal';
import { fetchDebitorKreditorOborot } from '@/app/service/reports/getDebitorKreditorOborot';
import { showMessage } from '@/app/service/common/showMessage';

export const total = (key: string, data: any[], value: string) => {
    return data ? data.filter((item: any) => item?.innerReportType == key)[0]?.[value] : 0
}

const getRow = (key: string, data: any[]) =>
    data?.find((item: any) => item?.innerReportType === key) ?? null;

export const setDebitKreditInnerData = (currentDKInnerReportId: string, currentDKInnerArrayId: string, setMainData: Function | undefined ) =>{
    if (setMainData) {
        setMainData('currentDKInnerReportId', currentDKInnerReportId)    
        setMainData('currentDKInnerArrayId', currentDKInnerArrayId)
    }
}

type BalanceRowParams = {
    title: string;
    reportID: string;
    debitArrayId: string;
    kreditArrayId: string;
    valueStart: number;
    valueEnd: number;
    setDebitKreditInnerData: Function;
    setMainData: Function | undefined;
};

const balanceRow = ({
    title,
    reportID,
    debitArrayId,
    kreditArrayId,
    valueStart,
    valueEnd,
    setDebitKreditInnerData,
    setMainData,
}: BalanceRowParams): JSX.Element => (
    <tr>
        <th className={styles.titleTd}>{title}</th>
        <th
            className={styles.totalTd}
            onDoubleClick={() =>
                setDebitKreditInnerData(reportID, debitArrayId, setMainData)
            }
        >
            {numberValue(valueStart)}
        </th>
        <th
            className={styles.totalTd}
            onDoubleClick={() =>
                setDebitKreditInnerData(reportID, kreditArrayId, setMainData)
            }
        >
            {numberValue(valueEnd)}
        </th>
    </tr>
);

type OborotRowParams = {
    title: string;
    reportID: string;
    debitOborot: number;
    kreditOborot: number;
    onOborotClick: (
        reportID: string,
        dk: DEBETKREDIT,
        title: string,
        rowTitle: string,
    ) => void;
};

const oborotRow = ({
    title,
    reportID,
    debitOborot,
    kreditOborot,
    onOborotClick,
}: OborotRowParams): JSX.Element => (
    <tr>
        <th className={styles.titleTd}>{title}</th>
        <th
            className={`${styles.totalTd} ${styles.clickable}`}
            onClick={() =>
                onOborotClick(reportID, DEBETKREDIT.DEBET, title, 'Дебет оборот')
            }
            title="Дебет оборот — расшифровка"
        >
            {numberValue(debitOborot)}
        </th>
        <th
            className={`${styles.totalTd} ${styles.clickable}`}
            onClick={() =>
                onOborotClick(reportID, DEBETKREDIT.KREDIT, title, 'Кредит оборот')
            }
            title="Кредит оборот — расшифровка"
        >
            {numberValue(kreditOborot)}
        </th>
    </tr>
);

type IndicatorRow = {
    title: string;
    reportID: string;
    debitStart: number;
    debitEnd: number;
    debitOborot: number;
    kreditOborot: number;
    kreditStart: number;
    kreditEnd: number;
};

const AKT_SVERKA_PARTNER_BY_REPORT: Record<
    string,
    'CLIENTS' | 'SUPPLIERS' | 'DEPARTMENTS'
> = {
    CLIENTS: 'CLIENTS',
    SUPPLIERS: 'SUPPLIERS',
    DEPARTMENTS: 'DEPARTMENTS',
};

const INDICATOR_DEFS: Pick<IndicatorRow, 'title' | 'reportID'>[] = [
    { title: 'Асосий воситалар', reportID: 'OS' },
    { title: 'Хом ашё', reportID: 'MATERIAL' },
    { title: 'Товарлар', reportID: 'TOVAR' },
    { title: 'Тайёр махсулот таннархи ', reportID: 'PRODUCTIONS' },
    { title: 'Ускуналар (омбор)', reportID: 'TOOLS_WAREHOUSE' },
    { title: 'Ускуналар (мижозда)', reportID: 'TOOLS_AT_CLIENT' },
    { title: 'Мижозларнинг биздан карзи', reportID: 'CLIENTS' },
    { title: 'Ички корхоналарнинг биздан карзи', reportID: 'DEPARTMENTS' },
    { title: 'Пул маблаглари', reportID: 'BUXGALTER' },
    { title: 'Таъминотчиларнинг биздан карзи', reportID: 'SUPPLIERS' },
    { title: 'Ходимлардаги аванслар', reportID: 'WORKERS' },
    { title: 'Жавобгар шахсдаги пул', reportID: 'ACCOUNTABLE' },
    { title: 'Воситачидаги бонус қарзи', reportID: 'MEDIATORS' },
    { title: 'Доставщиклардаги қарз', reportID: 'DELIVERERS' },
    { title: 'Таъсисчиларнинг карзи', reportID: 'FOUNDERS' },
];

const InnerPanel = ({
    datas,
    currentDKInnerReportId,
    currentDKInnerArrayId,
    onOpenAktSverka,
}: {
    datas: any[];
    currentDKInnerReportId: string | number;
    currentDKInnerArrayId: string | number;
    onOpenAktSverka: (reportType: string, referenceId: number) => void;
}) => {
    const reportType = String(currentDKInnerReportId);
    const isDrillable = reportType in AKT_SVERKA_PARTNER_BY_REPORT;

    return (
        <div className={styles.inner}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <td className={styles.innerName}>Номи</td>
                        <td className={styles.innerValue}>Сумма</td>
                    </tr>
                    {datas &&
                        datas.length > 0 &&
                        datas
                            .filter(
                                (item: any) =>
                                    item?.innerReportType == currentDKInnerReportId,
                            )[0]?.[currentDKInnerArrayId]
                            ?.map((element: any, index: number) => {
                                const canOpen =
                                    isDrillable &&
                                    element?.id != null &&
                                    element?.id !== undefined;
                                const rowClass = canOpen
                                    ? `${styles.innerName} ${styles.clickable}`
                                    : styles.innerName;

                                return (
                                    <tr
                                        key={`${currentDKInnerReportId}-${currentDKInnerArrayId}-${index}-${element?.name ?? ''}`}
                                    >
                                        <th
                                            className={rowClass}
                                            onClick={
                                                canOpen
                                                    ? () =>
                                                          onOpenAktSverka(
                                                              reportType,
                                                              Number(element.id),
                                                          )
                                                    : undefined
                                            }
                                            title={
                                                canOpen ? 'Акт сверка' : undefined
                                            }
                                        >
                                            {element?.name}
                                        </th>
                                        <th
                                            className={
                                                canOpen
                                                    ? `${styles.innerValue} ${styles.clickable}`
                                                    : styles.innerValue
                                            }
                                            onClick={
                                                canOpen
                                                    ? () =>
                                                          onOpenAktSverka(
                                                              reportType,
                                                              Number(element.id),
                                                          )
                                                    : undefined
                                            }
                                            title={
                                                canOpen
                                                    ? 'Акт сверка'
                                                    : undefined
                                            }
                                        >
                                            {numberValue(element?.value)}
                                        </th>
                                    </tr>
                                );
                            })}
                </thead>
            </table>
        </div>
    );
};

export const DebitorKreditor = ({ className, data, ...props }: DebitorKreditorProps): JSX.Element => {
    const { mainData, setMainData } = useAppContext();
    const { currentDKInnerReportId, currentDKInnerArrayId, reportOption } =
        mainData.report;
    const enterpriseName = useEnterpriseName();

    const [oborotModal, setOborotModal] = useState<{
        open: boolean;
        title: string;
        schet: Schet | string;
        dk: DEBETKREDIT;
        items: OborotSubcontoItem[];
    }>({
        open: false,
        title: '',
        schet: Schet.S10,
        dk: DEBETKREDIT.DEBET,
        items: [],
    });

    const datas = data ? data.filter((item: any) => item?.reportType == 'DEBITORKREDITOR')[0]?.values : [];

    const [oborotVisible, setOborotVisible] = useState(false);
    const [oborotLoading, setOborotLoading] = useState(false);
    const [oborotValues, setOborotValues] = useState<any[] | null>(null);

    useEffect(() => {
        setOborotVisible(false);
        setOborotValues(null);
        setOborotLoading(false);
    }, [data]);

    const mergedDatas = useMemo(() => {
        if (!oborotValues?.length) return datas;
        return datas.map((row: any) => {
            const ob = oborotValues.find(
                (o: any) => o?.innerReportType === row?.innerReportType,
            );
            return ob ? { ...row, ...ob } : row;
        });
    }, [datas, oborotValues]);

    const handleLoadOborot = useCallback(async () => {
        setOborotLoading(true);
        try {
            const response = await fetchDebitorKreditorOborot(mainData);
            setOborotValues(response.values ?? []);
            setOborotVisible(true);
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : 'Хатолик юз берди';
            showMessage(message, 'error', setMainData);
        } finally {
            setOborotLoading(false);
        }
    }, [mainData, setMainData]);

    const openOborotModal = useCallback(
        (reportID: string, dk: DEBETKREDIT, rowTitle: string, oborotLabel: string) => {
            const row =
                getRow(reportID, oborotValues ?? []) ?? getRow(reportID, mergedDatas);
            if (!row) return;
            const itemsKey = dk === DEBETKREDIT.DEBET ? 'innersDebitOborot' : 'innersKreditOborot';
            const items: OborotSubcontoItem[] = (row[itemsKey] ?? []).map((el: any) => ({
                id: el.id,
                name: el.name,
                value: el.value,
            }));
            setOborotModal({
                open: true,
                title: `${rowTitle} — ${oborotLabel}`,
                schet: row.schet ?? Schet.S10,
                dk,
                items,
            });
        },
        [mergedDatas, oborotValues],
    );

    const closeOborotModal = useCallback(() => {
        setOborotModal((prev) => ({ ...prev, open: false }));
    }, []);

    const openAktSverka = useCallback(
        (reportType: string, referenceId: number) => {
            const partnerType = AKT_SVERKA_PARTNER_BY_REPORT[reportType];
            if (!partnerType || referenceId == null) return;
            setMainData('reportOption', {
                ...reportOption,
                partnerType,
                firstReferenceId: Number(referenceId),
            });
            setMainData('dashboardReturnReportType', 'DebitorKreditor');
            setMainData('dashboardCurrentReportType', 'AktSverka');
        },
        [setMainData, reportOption],
    );

    const indicators: IndicatorRow[] = useMemo(
        () =>
            INDICATOR_DEFS.map((def) => ({
                ...def,
                debitStart: total(def.reportID, datas, 'totalDebitStart'),
                debitEnd: total(def.reportID, datas, 'totalDebitEnd'),
                debitOborot: oborotValues
                    ? total(def.reportID, oborotValues, 'totalDebitOborot')
                    : 0,
                kreditOborot: oborotValues
                    ? total(def.reportID, oborotValues, 'totalKreditOborot')
                    : 0,
                kreditStart: total(def.reportID, datas, 'totalKreditStart'),
                kreditEnd: total(def.reportID, datas, 'totalKreditEnd'),
            })),
        [datas, oborotValues],
    );

    const oborotTitles: Record<string, string> = {
        OS: 'Асосий воситалар',
        MATERIAL: 'Хом ашё',
        TOVAR: 'Товарлар',
        PRODUCTIONS: 'Тайёр махсулотлар',
        TOOLS_WAREHOUSE: 'Ускуналар (омбор)',
        TOOLS_AT_CLIENT: 'Ускуналар (мижозда)',
        CLIENTS: 'Мижозлар',
        DEPARTMENTS: 'Ички корхоналар',
        BUXGALTER: 'Пул маблаглари',
        SUPPLIERS: 'Таъминотчилар',
        WORKERS: 'Ходимлар',
        MEDIATORS: 'Воситачилар',
        DELIVERERS: 'Доставщиклар',
        FOUNDERS: 'Таъсисчилар',
    };

    const passiveTitles: Record<string, string> = {
        OS: 'Асосий воситалар',
        MATERIAL: 'Хом ашё (минус)',
        TOVAR: 'Товарлар (минус)',
        PRODUCTIONS: 'Тайёр махсулот (минус)',
        TOOLS_WAREHOUSE: 'Ускуналар (омбор, минус)',
        TOOLS_AT_CLIENT: 'Ускуналар (мижозда, минус)',
        DEPARTMENTS: 'Ички корхоналардан карзимиз',
        CLIENTS: 'Мижозлардан карзимиз',
        BUXGALTER: 'Пул маблаглари (минус)',
        SUPPLIERS: 'Таъминотчилардан карзимиз',
        WORKERS: 'Ходимлардан карзимиз',
        MEDIATORS: 'Воситачилardan bizga qarz',
        DELIVERERS: 'Доставщиклардан бизга қарз',
        FOUNDERS: 'Таъсисчилардан карзимиз',
    };

    const allDebitStart = indicators.reduce((acc, r) => acc + r.debitStart, 0);
    const allDebitEnd = indicators.reduce((acc, r) => acc + r.debitEnd, 0);
    const allDebitOborot = indicators.reduce((acc, r) => acc + r.debitOborot, 0);
    const allKreditOborot = indicators.reduce((acc, r) => acc + r.kreditOborot, 0);
    const allKreditStart = indicators.reduce((acc, r) => acc + r.kreditStart, 0);
    const allKreditEnd = indicators.reduce((acc, r) => acc + r.kreditEnd, 0);

    const balanceRowProps = { setDebitKreditInnerData, setMainData };

    return (
        <>
            <div className={styles.title}>
                Дебитор кредитор
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>

            <div className={styles.box}>
                <div className={styles.main}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <td></td>
                                <td className={styles.totalTd}>Давр бошига колдик</td>
                                <td className={styles.totalTd}>Давр охирига колдик</td>
                            </tr>
                            <tr>
                                <td>АКТИВ (бизда бор)</td>
                                <td className={styles.totalTd} colSpan={2}></td>
                            </tr>
                            {indicators.map((row) => (
                                <Fragment key={`active-${row.reportID}`}>
                                    {balanceRow({
                                        title: row.title,
                                        reportID: row.reportID,
                                        debitArrayId: 'innersDebitStart',
                                        kreditArrayId: 'innersDebitEnd',
                                        valueStart: row.debitStart,
                                        valueEnd: row.debitEnd,
                                        ...balanceRowProps,
                                    })}
                                </Fragment>
                            ))}
                            <tr>
                                <td>Жами</td>
                                <td className={styles.totalTd}>{numberValue(allDebitStart)}</td>
                                <td className={styles.totalTd}>{numberValue(allDebitEnd)}</td>
                            </tr>
                        </thead>
                        <thead>
                            <tr>
                                <td>ПАССИВ (Карзимиз)</td>
                                <td className={styles.totalTd} colSpan={2}></td>
                            </tr>
                            {indicators.map((row) => (
                                <Fragment key={`passive-${row.reportID}`}>
                                    {balanceRow({
                                        title: passiveTitles[row.reportID] ?? row.title,
                                        reportID: row.reportID,
                                        debitArrayId: 'innersKreditStart',
                                        kreditArrayId: 'innersKreditEnd',
                                        valueStart: row.kreditStart,
                                        valueEnd: row.kreditEnd,
                                        ...balanceRowProps,
                                    })}
                                </Fragment>
                            ))}
                            <tr>
                                <td>Жами</td>
                                <td className={styles.totalTd}>{numberValue(allKreditStart)}</td>
                                <td className={styles.totalTd}>{numberValue(allKreditEnd)}</td>
                            </tr>
                            <tr>
                                <td>ФАРК</td>
                                <td className={styles.totalTdSame}>
                                    {numberValue(allDebitStart - allKreditStart)}
                                </td>
                                <td className={styles.totalTdSame}>
                                    {numberValue(allDebitEnd - allKreditEnd)}
                                </td>
                            </tr>
                        </thead>
                    </table>
                </div>
                <InnerPanel
                    datas={datas}
                    currentDKInnerReportId={currentDKInnerReportId}
                    currentDKInnerArrayId={currentDKInnerArrayId}
                    onOpenAktSverka={openAktSverka}
                />
            </div>

            <div className={styles.oborotSection}>
                <div className={styles.oborotSectionHead}>
                    <div className={styles.sectionTitle}>Обороты по показателям</div>
                    <button
                        type="button"
                        className={styles.showOborotBtn}
                        onClick={() => void handleLoadOborot()}
                        disabled={oborotLoading}
                    >
                        {oborotLoading
                            ? 'Маълумот юкланмокда...'
                            : oborotVisible
                              ? 'Обновить оборот'
                              : 'Показать оборот'}
                    </button>
                </div>
                {oborotLoading && !oborotVisible ? (
                    <p className={styles.oborotLoading}>Маълумот юкланмокда...</p>
                ) : null}
                {oborotVisible ? (
                    <div className={styles.box}>
                        <div className={styles.main}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <td></td>
                                        <td className={styles.totalTd}>Дебет оборот</td>
                                        <td className={styles.totalTd}>Кредит оборот</td>
                                    </tr>
                                    <tr>
                                        <td>Курсаткичлар</td>
                                        <td className={styles.totalTd} colSpan={2}></td>
                                    </tr>
                                    {indicators.map((row) => (
                                        <Fragment key={`oborot-${row.reportID}`}>
                                            {oborotRow({
                                                title: oborotTitles[row.reportID] ?? row.title,
                                                reportID: row.reportID,
                                                debitOborot: row.debitOborot,
                                                kreditOborot: row.kreditOborot,
                                                onOborotClick: openOborotModal,
                                            })}
                                        </Fragment>
                                    ))}
                                    <tr>
                                        <td>Жами</td>
                                        <td className={styles.totalTd}>
                                            {numberValue(allDebitOborot)}
                                        </td>
                                        <td className={styles.totalTd}>
                                            {numberValue(allKreditOborot)}
                                        </td>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                        <div className={styles.inner} aria-hidden="true" />
                    </div>
                ) : null}
            </div>

            <DebitKreditOborotModal
                isOpen={oborotModal.open}
                onClose={closeOborotModal}
                title={oborotModal.title}
                schet={oborotModal.schet}
                dk={oborotModal.dk}
                items={oborotModal.items}
            />
        </>
    );
};
