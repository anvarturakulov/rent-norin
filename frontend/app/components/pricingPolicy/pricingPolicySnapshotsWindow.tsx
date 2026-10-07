'use client'

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import styles from './pricingPolicySnapshotsWindow.module.css'
import { pricingPolicyApi } from '@/app/service/pricingPolicy/pricingPolicy.service'
import { PricingPolicySnapshotListItem } from '@/app/interfaces/pricingPolicy.interface'
import { secondsToDateString } from '@/app/components/documents/document/doc/helpers/doc.functions'
import CloseIco from '@/app/components/windows/pereodicsListWindow/ico/close.svg'

type Props = {
    token: string
    open: boolean
    onClose: () => void
    onSelectDate: (effectiveDate: number, snapshotId: number) => void
    onCreateNew: () => void
    canEdit: boolean
    onDeleted?: () => void
}

export function PricingPolicySnapshotsWindow({
    token,
    open,
    onClose,
    onSelectDate,
    onCreateNew,
    canEdit,
    onDeleted,
}: Props) {
    const { data, mutate, isLoading } = useSWR(
        open && token ? ['pricing-policy-snapshots', token] : null,
        () => pricingPolicyApi.listSnapshots(token),
    )

    const sorted = useMemo(() => {
        if (!data?.length) return []
        return [...data].sort(
            (a: PricingPolicySnapshotListItem, b: PricingPolicySnapshotListItem) =>
                Number(a.effectiveDate) - Number(b.effectiveDate),
        )
    }, [data])

    const handleDelete = useCallback(
        async (id: number) => {
            if (!confirm('Снимокни ўчиришни тасдиқлайсизми?')) return
            await pricingPolicyApi.deleteSnapshot(token, id)
            mutate()
            onDeleted?.()
        },
        [token, mutate, onDeleted],
    )

    if (!open) return null

    return (
        <div className={styles.backdrop} role="presentation" onClick={onClose}>
            <div
                className={styles.box}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>Тарих</p>
                        <h2 className={styles.title}>Нарх сиёсати снимклари</h2>
                        <p className={styles.hint}>
                            Қаторга икки марта босинг — сана бўйича юклаш
                        </p>
                    </div>
                    <div className={styles.btnsBox}>
                        {canEdit && (
                            <button type="button" className={styles.iconBtn} onClick={onCreateNew}>
                                +
                            </button>
                        )}
                        <button type="button" className={styles.iconBtn} onClick={onClose}>
                            <CloseIco className={styles.icoSvg} />
                        </button>
                    </div>
                </div>
                <div className={styles.body}>
                    {isLoading && <p>Юкланмоқда...</p>}
                    {!isLoading && (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>№</th>
                                    <th>Сана</th>
                                    <th>Изоҳ</th>
                                    {canEdit && <th>Амал</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        onDoubleClick={() =>
                                            onSelectDate(
                                                Number(item.effectiveDate),
                                                item.id,
                                            )
                                        }
                                    >
                                        <td>{index + 1}</td>
                                        <td>
                                            {secondsToDateString(Number(item.effectiveDate))}
                                        </td>
                                        <td>{item.comment || '—'}</td>
                                        {canEdit && (
                                            <td>
                                                <button
                                                    type="button"
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDelete(item.id)}
                                                >
                                                    Учириш
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
