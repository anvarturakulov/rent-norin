'use client'

import { useState } from 'react'
import styles from './pricingPolicy.module.css'
import {
    PricingClassPercents,
    PricingMarkupDefinition,
    PricingMarkupGroup,
} from '@/app/interfaces/pricingPolicy.interface'
import { EMPTY_CLASS_PERCENTS, PRICING_CLASS_COLUMNS } from './pricingPolicy.constants'

type Props = {
    definitions: PricingMarkupDefinition[]
    values: Record<string, PricingClassPercents>
    canEdit: boolean
    onChange: (code: string, field: keyof PricingClassPercents, value: number) => void
    onDeleteDefinition?: (id: number) => void
    onAddDefinition?: (code: string, name: string, includesInCost: boolean) => void
    onUpdateIncludesInCost?: (id: number, includesInCost: boolean) => void
}

const GROUP_TITLE: Record<PricingMarkupGroup, string> = {
    [PricingMarkupGroup.BEFORE_COST]: 'До себестоимости',
    [PricingMarkupGroup.AFTER_COST]: 'После себестоимости',
}

function IncludesInCostBadge({ includesInCost }: { includesInCost: boolean }) {
    return (
        <span
            className={
                includesInCost ? styles.badgeIncluded : styles.badgeInformative
            }
        >
            {includesInCost ? 'В себестоимость' : 'Информативная'}
        </span>
    )
}

function MatrixGroup({
    group,
    definitions,
    values,
    canEdit,
    onChange,
    onDeleteDefinition,
    onAddDefinition,
    onUpdateIncludesInCost,
}: {
    group: PricingMarkupGroup
    definitions: PricingMarkupDefinition[]
    values: Record<string, PricingClassPercents>
    canEdit: boolean
    onChange: Props['onChange']
    onDeleteDefinition?: Props['onDeleteDefinition']
    onAddDefinition?: Props['onAddDefinition']
    onUpdateIncludesInCost?: Props['onUpdateIncludesInCost']
}) {
    const rows = definitions.filter((d) => d.group === group)
    const [newCode, setNewCode] = useState('')
    const [newName, setNewName] = useState('')
    const [newIncludesInCost, setNewIncludesInCost] = useState(true)

    const showCostFlagColumn = group === PricingMarkupGroup.BEFORE_COST

    return (
        <div>
            <div className={styles.groupHeader}>
                <span>{GROUP_TITLE[group]}</span>
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Наценка</th>
                        {showCostFlagColumn && <th className={styles.flagCol}>Тип</th>}
                        {PRICING_CLASS_COLUMNS.map((col) => (
                            <th key={col.field} className={styles.classCol}>
                                {col.title}
                            </th>
                        ))}
                        {canEdit && group === PricingMarkupGroup.BEFORE_COST && (
                            <th style={{ width: 56 }} />
                        )}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((def) => {
                        const v = values[def.code] ?? { ...EMPTY_CLASS_PERCENTS }
                        const includesInCost = def.includesInCost !== false
                        return (
                            <tr key={def.id}>
                                <td>
                                    <div>{def.name}</div>
                                    <div className={styles.code}>{def.code}</div>
                                </td>
                                {showCostFlagColumn && (
                                    <td className={styles.flagCol}>
                                        {canEdit && !def.isSystem && onUpdateIncludesInCost ? (
                                            <label className={styles.flagToggle}>
                                                <input
                                                    type="checkbox"
                                                    checked={includesInCost}
                                                    onChange={(e) =>
                                                        onUpdateIncludesInCost(
                                                            def.id,
                                                            e.target.checked,
                                                        )
                                                    }
                                                />
                                                <span>
                                                    {includesInCost
                                                        ? 'В себестоимость'
                                                        : 'Информативная'}
                                                </span>
                                            </label>
                                        ) : (
                                            <IncludesInCostBadge
                                                includesInCost={includesInCost}
                                            />
                                        )}
                                    </td>
                                )}
                                {PRICING_CLASS_COLUMNS.map(({ field }) => (
                                    <td key={field} className={styles.classCol}>
                                        <span className={styles.percentCell}>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.01}
                                                className={styles.percentInput}
                                                disabled={!canEdit}
                                                value={v[field]}
                                                onChange={(e) =>
                                                    onChange(
                                                        def.code,
                                                        field,
                                                        Math.min(
                                                            100,
                                                            Math.max(
                                                                0,
                                                                Number(e.target.value) || 0,
                                                            ),
                                                        ),
                                                    )
                                                }
                                            />
                                            <span className={styles.percentSign}>%</span>
                                        </span>
                                    </td>
                                ))}
                                {canEdit && group === PricingMarkupGroup.BEFORE_COST && (
                                    <td>
                                        {!def.isSystem && onDeleteDefinition && (
                                            <button
                                                type="button"
                                                className={styles.iconBtn}
                                                onClick={() => onDeleteDefinition(def.id)}
                                                title="Удалить"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {canEdit &&
                group === PricingMarkupGroup.BEFORE_COST &&
                onAddDefinition && (
                    <div className={styles.addRow}>
                        <input
                            className={styles.codeField}
                            placeholder="CODE"
                            value={newCode}
                            onChange={(e) =>
                                setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
                            }
                        />
                        <input
                            className={styles.nameField}
                            placeholder="Название наценки"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <label className={styles.flagToggle}>
                            <input
                                type="checkbox"
                                checked={newIncludesInCost}
                                onChange={(e) => setNewIncludesInCost(e.target.checked)}
                            />
                            <span>Включается в себестоимость</span>
                        </label>
                        <button
                            type="button"
                            className={styles.btn}
                            onClick={() => {
                                if (newCode.trim() && newName.trim()) {
                                    onAddDefinition(
                                        newCode.trim(),
                                        newName.trim(),
                                        newIncludesInCost,
                                    )
                                    setNewCode('')
                                    setNewName('')
                                    setNewIncludesInCost(true)
                                }
                            }}
                        >
                            + Қўшиш
                        </button>
                    </div>
                )}
        </div>
    )
}
export function PricingPolicyMatrix({
    definitions,
    values,
    canEdit,
    onChange,
    onDeleteDefinition,
    onAddDefinition,
    onUpdateIncludesInCost,
}: Props) {
    return (
        <div className={styles.matrixWrap}>
            <MatrixGroup
                group={PricingMarkupGroup.BEFORE_COST}
                definitions={definitions}
                values={values}
                canEdit={canEdit}
                onChange={onChange}
                onDeleteDefinition={onDeleteDefinition}
                onAddDefinition={onAddDefinition}
                onUpdateIncludesInCost={onUpdateIncludesInCost}
            />
            <MatrixGroup
                group={PricingMarkupGroup.AFTER_COST}
                definitions={definitions}
                values={values}
                canEdit={canEdit}
                onChange={onChange}
            />
        </div>
    )
}
