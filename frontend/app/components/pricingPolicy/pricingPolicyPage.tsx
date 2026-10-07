'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '@/app/context/app.context'
import { canEditPricingPolicy } from '@/app/utils/roleHelpers'
import { pricingPolicyApi } from '@/app/service/pricingPolicy/pricingPolicy.service'
import {
    PricingClassPercents,
    PricingMarkupDefinition,
    SnapshotValueInput,
} from '@/app/interfaces/pricingPolicy.interface'
import { showMessage } from '@/app/service/common/showMessage'
import { EMPTY_CLASS_PERCENTS } from './pricingPolicy.constants'
import { PricingPolicyMatrix } from './pricingPolicyMatrix'
import { PricingPolicySnapshotsWindow } from './pricingPolicySnapshotsWindow'
import styles from './pricingPolicy.module.css'

function localTodayMs(): number {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

function dateStringToMs(dateStr: string): number {
    const [y, m, day] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, day).getTime()
}

function msToDateInputValue(ms: number): string {
    const d = new Date(ms)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function buildEmptyValues(
    definitions: PricingMarkupDefinition[],
    existing?: Record<string, PricingClassPercents>,
): Record<string, PricingClassPercents> {
    const out: Record<string, PricingClassPercents> = {}
    for (const d of definitions) {
        out[d.code] = existing?.[d.code] ?? { ...EMPTY_CLASS_PERCENTS }
    }
    return out
}

function toSnapshotPayload(
    definitions: PricingMarkupDefinition[],
    values: Record<string, PricingClassPercents>,
): SnapshotValueInput[] {
    return definitions.map((d) => ({
        markupCode: d.code,
        percentClassA: values[d.code]?.classA ?? 0,
        percentClassB: values[d.code]?.classB ?? 0,
        percentClassC: values[d.code]?.classC ?? 0,
    }))
}

function allValuesZero(values: Record<string, PricingClassPercents>): boolean {
    return Object.values(values).every(
        (v) => v.classA === 0 && v.classB === 0 && v.classC === 0,
    )
}

export function PricingPolicyPage(): JSX.Element {
    const { mainData, setMainData } = useAppContext()
    const token = mainData.users.user?.token ?? ''
    const role = mainData.users.user?.role
    const canEdit = canEditPricingPolicy(role)

    const todayMs = useMemo(() => localTodayMs(), [])

    const [effectiveDateMs, setEffectiveDateMs] = useState(todayMs)
    const [dateInput, setDateInput] = useState(msToDateInputValue(todayMs))
    const [definitions, setDefinitions] = useState<PricingMarkupDefinition[]>([])
    const [values, setValues] = useState<Record<string, PricingClassPercents>>({})
    const [snapshotId, setSnapshotId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [isNewSnapshot, setIsNewSnapshot] = useState(false)

    const loadPolicy = useCallback(async () => {
        if (!token) return
        setLoading(true)
        try {
            const [defs, policy] = await Promise.all([
                pricingPolicyApi.getDefinitions(token),
                pricingPolicyApi.getForDate(token, effectiveDateMs),
            ])
            setDefinitions(defs)
            setSnapshotId(policy.snapshotId)
            // Новый снимок, если на выбранную дату нет точного совпадения (только более старый «действует с»)
            const exactDateMatch =
                policy.snapshotId != null &&
                Number(policy.effectiveDate) === effectiveDateMs
            setIsNewSnapshot(!exactDateMatch)
            setValues(buildEmptyValues(defs, policy.values))
        } catch {
            showMessage('Нарх сиёсатини юклаб бўлмади', 'error', setMainData)
        } finally {
            setLoading(false)
        }
    }, [token, effectiveDateMs])

    useEffect(() => {
        loadPolicy()
    }, [loadPolicy])

    const handleDateChange = (dateStr: string) => {
        setDateInput(dateStr)
        setEffectiveDateMs(dateStringToMs(dateStr))
    }

    const handleValueChange = (
        code: string,
        field: keyof PricingClassPercents,
        value: number,
    ) => {
        setValues((prev) => ({
            ...prev,
            [code]: { ...(prev[code] ?? { ...EMPTY_CLASS_PERCENTS }), [field]: value },
        }))
    }

    const handleSave = async () => {
        if (!canEdit || !token) return
        setSaving(true)
        try {
            const payload = {
                effectiveDate: effectiveDateMs,
                values: toSnapshotPayload(definitions, values),
            }
            if (snapshotId && !isNewSnapshot) {
                await pricingPolicyApi.updateSnapshot(token, snapshotId, payload)
                showMessage('Сақланди', 'success', setMainData)
            } else {
                const created = await pricingPolicyApi.createSnapshot(token, payload)
                setSnapshotId(created.id)
                setIsNewSnapshot(false)
                showMessage('Янги снимок яратилди', 'success', setMainData)
            }
            await loadPolicy()
        } catch (e: unknown) {
            const msg =
                (e as { response?: { data?: { message?: string | string[] } } })?.response
                    ?.data?.message
            showMessage(
                Array.isArray(msg) ? msg.join(', ') : msg || 'Сақлашда хатолик',
                'error',
                setMainData,
            )
        } finally {
            setSaving(false)
        }
    }

    const handleAddDefinition = async (
        code: string,
        name: string,
        includesInCost: boolean,
    ) => {
        if (!canEdit || !token) return
        try {
            await pricingPolicyApi.createDefinition(token, { code, name, includesInCost })
            showMessage('Қўшилди', 'success', setMainData)
            await loadPolicy()
        } catch (e: unknown) {
            const msg =
                (e as { response?: { data?: { message?: string | string[] } } })?.response
                    ?.data?.message
            showMessage(Array.isArray(msg) ? msg.join(', ') : msg || 'Хатолик', 'error', setMainData)
        }
    }

    const handleUpdateIncludesInCost = async (id: number, includesInCost: boolean) => {
        if (!canEdit || !token) return
        try {
            await pricingPolicyApi.updateDefinition(token, id, { includesInCost })
            setDefinitions((prev) =>
                prev.map((d) => (d.id === id ? { ...d, includesInCost } : d)),
            )
        } catch (e: unknown) {
            const msg =
                (e as { response?: { data?: { message?: string | string[] } } })?.response
                    ?.data?.message
            showMessage(Array.isArray(msg) ? msg.join(', ') : msg || 'Хатолик', 'error', setMainData)
            await loadPolicy()
        }
    }

    const handleDeleteDefinition = async (id: number) => {
        if (!canEdit || !token) return
        if (!confirm('Наценкани ўчиришни тасдиқлайсизми?')) return
        try {
            await pricingPolicyApi.deleteDefinition(token, id)
            showMessage('Ўчирилди', 'success', setMainData)
            await loadPolicy()
        } catch {
            showMessage('Ўчириб бўлмади', 'error', setMainData)
        }
    }

    const handleSelectSnapshot = (dateMs: number, id: number) => {
        setEffectiveDateMs(dateMs)
        setDateInput(msToDateInputValue(dateMs))
        setSnapshotId(id)
        setIsNewSnapshot(false)
        setHistoryOpen(false)
    }

    const handleCreateNewSnapshot = () => {
        const next = localTodayMs()
        setEffectiveDateMs(next)
        setDateInput(msToDateInputValue(next))
        setSnapshotId(null)
        setIsNewSnapshot(true)
        setValues(buildEmptyValues(definitions, values))
        setHistoryOpen(false)
    }

    const showNoSnapshotHint =
        !loading && isNewSnapshot && snapshotId == null && allValuesZero(values)

    if (loading && definitions.length === 0) {
        return <div className={styles.loading}>Юкланмоқда...</div>
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Нарх сиёсати</h1>
                    <p className={styles.subtitle}>
                        Глобальная матрица наценок по классам (A, B, C). Снимок целиком на дату.
                    </p>
                </div>
                <div className={styles.toolbar}>
                    <label>
                        Сана:{' '}
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={dateInput}
                            onChange={(e) => handleDateChange(e.target.value)}
                        />
                    </label>
                    <button type="button" className={styles.btn} onClick={() => setHistoryOpen(true)}>
                        Тарих
                    </button>
                    {canEdit && (
                        <button
                            type="button"
                            className={styles.btnPrimary}
                            disabled={saving}
                            onClick={handleSave}
                        >
                            {saving ? 'Сақланмоқда...' : isNewSnapshot ? 'Янги снимок' : 'Сақлаш'}
                        </button>
                    )}
                </div>
            </div>

            {showNoSnapshotHint && (
                <p className={styles.noSnapshotHint}>
                    Ушбу сана учун снимок сақланмаган. «Тарих» орқали мавжуд снимокни танланг ёки
                    янги снимок яратинг.
                </p>
            )}

            <PricingPolicyMatrix
                definitions={definitions}
                values={values}
                canEdit={canEdit}
                onChange={handleValueChange}
                onDeleteDefinition={canEdit ? handleDeleteDefinition : undefined}
                onAddDefinition={canEdit ? handleAddDefinition : undefined}
                onUpdateIncludesInCost={canEdit ? handleUpdateIncludesInCost : undefined}
            />

            {!canEdit && (
                <p className={styles.readonlyNote}>
                    Фақат ADMINGLOBAL, HEADCOMPANY ва GLAVBUX таҳрирлаши мумкин.
                </p>
            )}

            <PricingPolicySnapshotsWindow
                token={token}
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                onSelectDate={handleSelectSnapshot}
                onCreateNew={handleCreateNewSnapshot}
                canEdit={canEdit}
                onDeleted={loadPolicy}
            />
        </div>
    )
}
