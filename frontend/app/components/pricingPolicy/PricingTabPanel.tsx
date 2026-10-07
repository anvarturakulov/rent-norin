'use client'

import { useEffect, useMemo, useState } from 'react'
import { PriceClass } from '@/app/interfaces/reference.interface'
import { pricingPolicyApi } from '@/app/service/pricingPolicy/pricingPolicy.service'
import {
    computePricingBreakdown,
    dateStringToMs,
    EMPTY_POLICY,
    msToDateInputValue,
    PRICE_CLASS_LABEL,
    todayDateMs,
} from '@/app/utils/pricingCalculations'
import type { PricingBreakdown } from '@/app/utils/pricingCalculations'
import styles from '@/app/components/reference/tmzProductTabs/TmzProductTabs.module.css'

function formatSum(n: number): string {
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function formatPercent(n: number): string {
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

type Props = {
    /** Сумма вкладки Ишлар (левая колонка) */
    worksTabSum: number
    /** Сумма вкладки Умумий ишлар (правая колонка) */
    commonWorksSum: number
    materialsSum: number
    priceClass: PriceClass
    token: string
    enterpriseId?: number | null
    usesComponents?: boolean
    externalLoading?: boolean
    externalError?: string | null
    /** Выключенные BEFORE_COST для колонки Умумий ишлар */
    disabledBeforeCostMarkupCodes?: string[] | null
    onDisabledBeforeCostMarkupCodesChange?: (codes: string[]) => void
    /** Выключенные BEFORE_COST для колонки Ишлар */
    disabledBeforeCostMarkupCodesWorks?: string[] | null
    onDisabledBeforeCostMarkupCodesWorksChange?: (codes: string[]) => void
    markupsReadOnly?: boolean
}

function PricingColumn({
    title,
    breakdown,
    classLabel,
    usesComponents,
    canToggleMarkups,
    onToggleMarkup,
}: {
    title: string
    breakdown: PricingBreakdown
    classLabel: string
    usesComponents?: boolean
    canToggleMarkups: boolean
    onToggleMarkup: (code: string, enabled: boolean) => void
}): JSX.Element {
    return (
        <div className={`${styles.pricingPanel} ${styles.pricingCol}`}>
            <div className={styles.pricingColTitle}>{title}</div>
            <div className={styles.pricingSummaryRow}>
                Ишлар суммаси: <b>{formatSum(breakdown.worksSum)}</b>
                {usesComponents ? <span> (BOM)</span> : null}
            </div>
            <div className={styles.pricingSummaryRow}>
                Материаллар суммаси: <b>{formatSum(breakdown.materialsSum)}</b>
            </div>
            <div className={`${styles.pricingSummaryRow} ${styles.pricingHammasi}`}>
                Жами: <b>{formatSum(breakdown.jami)}</b>
            </div>
            <div className={styles.pricingSummaryRow}>
                Сумма наценок ({classLabel}):{' '}
                <b>
                    {formatPercent(breakdown.beforeCostMarkupSumPercent)}% —{' '}
                    {formatSum(breakdown.beforeCostMarkupSumAmount)}
                </b>
            </div>
            {breakdown.beforeCostMarkupLines.length > 0 && (
                <div className={styles.pricingMarkupBreakdown}>
                    {breakdown.beforeCostMarkupLines.map((line) => (
                        <div
                            key={line.code}
                            className={
                                line.includesInCost
                                    ? styles.pricingMarkupLine
                                    : `${styles.pricingMarkupLine} ${styles.pricingMarkupLineInformative}`
                            }
                        >
                            <label className={styles.pricingMarkupLineLabel}>
                                <input
                                    type="checkbox"
                                    checked={line.enabled}
                                    disabled={!canToggleMarkups}
                                    onChange={(e) =>
                                        onToggleMarkup(line.code, e.target.checked)
                                    }
                                />
                                <span>
                                    {line.name}
                                    {!line.includesInCost ? ' (информативная)' : ''}:{' '}
                                    <b>
                                        {formatPercent(line.percent)}% —{' '}
                                        {formatSum(line.amount)}
                                    </b>
                                </span>
                            </label>
                        </div>
                    ))}
                </div>
            )}
            <div className={`${styles.pricingSummaryRow} ${styles.pricingCostPrice}`}>
                Режадаги таннарх: <b>{formatSum(breakdown.costPrice)}</b>
            </div>
            <div className={styles.pricingAfterCostBlock}>
                <div className={styles.pricingSummaryRow}>
                    Дилерская наценка: <b>{formatPercent(breakdown.dealerPercent)}%</b>
                </div>
                <div className={styles.pricingSummaryRow}>
                    Розничная наценка: <b>{formatPercent(breakdown.retailPercent)}%</b>
                </div>
                <div className={styles.pricingSummaryRow}>
                    Наценка перечисления:{' '}
                    <b>{formatPercent(breakdown.transferPercent)}%</b>
                </div>
            </div>
            <div className={styles.pricingPricesInCol}>
                <div className={styles.pricingPriceCell}>
                    Диллер: <b>{formatSum(breakdown.dealerPrice)}</b>
                </div>
                <div className={styles.pricingPriceCell}>
                    Чакана: <b>{formatSum(breakdown.retailPrice)}</b>
                </div>
                <div className={styles.pricingPriceCell}>
                    Перечисление: <b>{formatSum(breakdown.transferPrice)}</b>
                </div>
            </div>
        </div>
    )
}

export function PricingTabPanel({
    worksTabSum,
    commonWorksSum,
    materialsSum,
    priceClass,
    token,
    enterpriseId,
    usesComponents,
    externalLoading = false,
    externalError = null,
    disabledBeforeCostMarkupCodes = null,
    onDisabledBeforeCostMarkupCodesChange,
    disabledBeforeCostMarkupCodesWorks = null,
    onDisabledBeforeCostMarkupCodesWorksChange,
    markupsReadOnly = false,
}: Props): JSX.Element {
    const todayMs = useMemo(() => todayDateMs(), [])
    const [datePriceMs, setDatePriceMs] = useState(todayMs)
    const [dateInput, setDateInput] = useState(() => msToDateInputValue(todayMs))
    const [policyLoading, setPolicyLoading] = useState(true)
    const [policyError, setPolicyError] = useState('')
    const [policy, setPolicy] = useState(EMPTY_POLICY)

    useEffect(() => {
        if (!token) {
            setPolicy(EMPTY_POLICY)
            setPolicyLoading(false)
            return
        }
        let cancelled = false
        setPolicyLoading(true)
        setPolicyError('')
        void pricingPolicyApi
            .getForDate(token, datePriceMs, enterpriseId)
            .then((data) => {
                if (!cancelled) setPolicy(data)
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setPolicyError(e instanceof Error ? e.message : 'Хато')
                    setPolicy(EMPTY_POLICY)
                }
            })
            .finally(() => {
                if (!cancelled) setPolicyLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [token, datePriceMs, enterpriseId])

    const disabledCodesCommon = disabledBeforeCostMarkupCodes ?? []
    const disabledCodesWorks = disabledBeforeCostMarkupCodesWorks ?? []

    const worksBreakdown = useMemo(
        () =>
            computePricingBreakdown({
                worksSum: worksTabSum,
                materialsSum,
                policy,
                priceClass,
                disabledBeforeCostMarkupCodes: disabledCodesWorks,
            }),
        [worksTabSum, materialsSum, policy, priceClass, disabledCodesWorks],
    )

    const commonWorksBreakdown = useMemo(
        () =>
            computePricingBreakdown({
                worksSum: commonWorksSum,
                materialsSum,
                policy,
                priceClass,
                disabledBeforeCostMarkupCodes: disabledCodesCommon,
            }),
        [commonWorksSum, materialsSum, policy, priceClass, disabledCodesCommon],
    )

    const classLabel = PRICE_CLASS_LABEL[priceClass]
    const isLoading = externalLoading || policyLoading
    const displayError = externalError || policyError
    const canToggleWorks =
        Boolean(onDisabledBeforeCostMarkupCodesWorksChange) && !markupsReadOnly
    const canToggleCommon =
        Boolean(onDisabledBeforeCostMarkupCodesChange) && !markupsReadOnly

    const toggleCodes = (
        current: string[],
        code: string,
        enabled: boolean,
        onChange?: (codes: string[]) => void,
    ) => {
        if (!onChange) return
        const set = new Set(current)
        if (enabled) set.delete(code)
        else set.add(code)
        onChange(Array.from(set))
    }

    if (isLoading) {
        return <div className={styles.pricingHint}>Юкланмоқда…</div>
    }

    if (displayError) {
        return (
            <div className={styles.pricingHint} style={{ color: '#b91c1c' }}>
                {displayError}
            </div>
        )
    }

    return (
        <div className={styles.pricingTabRoot}>
            <div className={styles.pricingDateRow}>
                <label className={styles.pricingDateLabel}>
                    DatePrice
                    <input
                        type="date"
                        value={dateInput}
                        onChange={(e) => {
                            const v = e.target.value
                            setDateInput(v)
                            if (v) setDatePriceMs(dateStringToMs(v))
                        }}
                    />
                </label>
            </div>

            <div className={styles.pricingLayout}>
                <PricingColumn
                    title="Вариант Олдинги"
                    breakdown={worksBreakdown}
                    classLabel={classLabel}
                    usesComponents={usesComponents}
                    canToggleMarkups={canToggleWorks}
                    onToggleMarkup={(code, enabled) =>
                        toggleCodes(
                            disabledCodesWorks,
                            code,
                            enabled,
                            onDisabledBeforeCostMarkupCodesWorksChange,
                        )
                    }
                />
                <PricingColumn
                    title="Вариант Янги"
                    breakdown={commonWorksBreakdown}
                    classLabel={classLabel}
                    usesComponents={usesComponents}
                    canToggleMarkups={canToggleCommon}
                    onToggleMarkup={(code, enabled) =>
                        toggleCodes(
                            disabledCodesCommon,
                            code,
                            enabled,
                            onDisabledBeforeCostMarkupCodesChange,
                        )
                    }
                />
            </div>
        </div>
    )
}
