'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './cuttingBalancesJournal.module.css';
import { useAppContext } from '@/app/context/app.context';
import { cuttingApi } from '@/app/service/furnitureOrders/orderCutting.service';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { formatWorksNumberDisplay } from '@/app/components/furnitureOrders/furnitureOrderCard/workTableCells';
import type { CuttingBalanceRow } from '@/app/interfaces/furnitureOrder.interface';

export default function CuttingBalancesJournal() {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const token = user?.token;
    const enterpriseId = user?.enterpriseId;

    const [materialFilter, setMaterialFilter] = useState('');
    const [showZero, setShowZero] = useState(false);

    const balancesKey =
        token && enterpriseId
            ? `cutting-balances-${enterpriseId}-${materialFilter}-${showZero}`
            : null;

    const { data: balances, error, isLoading, mutate } = useSWR<CuttingBalanceRow[]>(
        balancesKey,
        async () => {
            const params: { materialId?: number; hideZero?: boolean } = { hideZero: !showZero };
            if (materialFilter) params.materialId = Number(materialFilter);
            return cuttingApi.getBalances(token!, Number(enterpriseId), params);
        },
    );

    const { data: materials } = useSWR(
        token && enterpriseId ? `materials-${enterpriseId}` : null,
        () => foApi.getReferences(token!, 'MATERIALS', Number(enterpriseId)),
    );

    const sheetMaterials = useMemo(
        () => (materials ?? []).filter(m => m.isSheetMaterial),
        [materials],
    );

    const materialNameById = useMemo(() => {
        const map = new Map<number, string>();
        for (const m of sheetMaterials) {
            map.set(m.id, m.article ? `${m.name} (${m.article})` : m.name);
        }
        return map;
    }, [sheetMaterials]);

    const rows = balances ?? [];

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Раскрой қолдиқлари</h2>
                <button type="button" className={styles.refreshBtn} onClick={() => mutate()}>
                    Янгилаш
                </button>
            </div>

            {/* <p className={styles.hint}>
                Бошланғич қолдиқларни биринчи заявкада «Приход» бўлимига киритинг. Остаток = приход − расход (барча
                заявкалар бўйича).
            </p> */}

            <div className={styles.filters}>
                <label className={styles.filterLabel}>
                    Материал
                    <select
                        className={styles.select}
                        value={materialFilter}
                        onChange={e => setMaterialFilter(e.target.value)}
                    >
                        <option value="">Барчаси</option>
                        {sheetMaterials.map(m => (
                            <option key={m.id} value={String(m.id)}>
                                {m.article ? `${m.name} (${m.article})` : m.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={showZero} onChange={e => setShowZero(e.target.checked)} />
                    Нол қолдиқларни кўрсатиш
                </label>
            </div>

            {isLoading && <div className={styles.status}>Юкланмоқда...</div>}
            {error && <div className={styles.statusError}>Хатолик: {String((error as Error).message ?? error)}</div>}

            {!isLoading && !error && (
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>№</th>
                                <th>Материал</th>
                                <th>Узунлик (мм)</th>
                                <th>Эни (мм)</th>
                                <th>Қолдиқ (дона)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={5} className={styles.empty}>
                                        Маълумот йўқ
                                    </td>
                                </tr>
                            )}
                            {rows.map((row, i) => {
                                const negative = row.remainQty < -0.000001;
                                const name =
                                    row.material?.name ??
                                    materialNameById.get(row.materialId) ??
                                    `ID ${row.materialId}`;
                                return (
                                    <tr
                                        key={`${row.materialId}-${row.length}-${row.width}`}
                                        className={negative ? styles.rowNegative : undefined}
                                    >
                                        <td>{i + 1}</td>
                                        <td>{name}</td>
                                        <td>{formatWorksNumberDisplay(String(row.length), 2)}</td>
                                        <td>{formatWorksNumberDisplay(String(row.width), 2)}</td>
                                        <td className={negative ? styles.qtyNegative : undefined}>
                                            {formatWorksNumberDisplay(String(row.remainQty), 2)}
                                            {negative ? ' ⚠' : ''}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

