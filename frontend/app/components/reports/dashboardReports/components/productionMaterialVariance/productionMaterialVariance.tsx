'use client';

import { ProductionMaterialVarianceProps } from './productionMaterialVariance.props';
import styles from './productionMaterialVariance.module.css';
import { useMemo } from 'react';
import { numberValue } from '@/app/service/common/converters';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const ProductionMaterialVariance = ({
    className,
    data,
    ...props
}: ProductionMaterialVarianceProps): JSX.Element => {
    const enterpriseName = useEnterpriseName();

    const values = useMemo(() => {
        if (!data || !Array.isArray(data)) return null;
        const report = data.find(
            (item: any) => item?.reportType === 'PRODUCTIONMATERIALVARIANCE'
        );
        return report?.values ?? null;
    }, [data]);

    const hasProduction = values?.productionSummary?.length > 0;
    const hasMaterials = values?.byMaterial?.length > 0;
    const isEmpty = !hasProduction && !hasMaterials;

    if (!values) {
        return (
            <div className={styles.container} {...props}>
                <div className={styles.title}>
                    ИШЛАБ ЧИҚАРИШ: ФАКТ ВА НОРМА (МАТЕРИАЛЛАР)
                    {enterpriseName && <span> - {enterpriseName}</span>}
                </div>
                <div className={styles.emptyMessage}>Маълумотлар юкланмоқда</div>
            </div>
        );
    }

    if (isEmpty) {
        return (
            <div className={styles.container} {...props}>
                <div className={styles.title}>
                    ИШЛАБ ЧИҚАРИШ: ФАКТ ВА НОРМА (МАТЕРИАЛЛАР)
                    {enterpriseName && <span> - {enterpriseName}</span>}
                </div>
                <div className={styles.emptyMessage}>
                    Танланган даврда маълумотлар топилмади
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container} {...props}>
            <div className={styles.title}>
                ИШЛАБ ЧИҚАРИШ: ФАКТ ВА НОРМА (МАТЕРИАЛЛАР)
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>

            {hasProduction && (
                <>
                    <div className={styles.sectionTitle}>
                        Ишлаб чикарилган махсулотлар
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.center}>№</th>
                                    <th>Махсулот</th>
                                    <th className={styles.center}>Ул. бирлик</th>
                                    <th className={styles.center}>Миқдор</th>
                                    <th className={styles.numeric}>
                                        Сумма (таннарх)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {values.productionSummary.map((row: any, index: number) => (
                                    <tr key={row.productId}>
                                        <td className={styles.center}>{index + 1}</td>
                                        <td>{row.productName}</td>
                                        <td className={styles.center}>
                                            {row.unit || '-'}
                                        </td>
                                        <td className={styles.center}>
                                            {numberValue(row.totalCount)}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(row.totalCost ?? 0)}
                                        </td>
                                    </tr>
                                ))}
                                {values.productionTotals && (
                                    <tr className={styles.totalRow}>
                                        <td className={styles.center} colSpan={2}>Жами</td>
                                        <td className={styles.center}></td>
                                        <td className={styles.numeric}>
                                            {numberValue(
                                                values.productionTotals.totalCount ?? 0
                                            )}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(
                                                values.productionTotals.totalCost ?? 0
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {hasMaterials && (
                <>
                    <div className={styles.sectionTitle}>
                        Материаллар: факт ва норма
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.center}>№</th>
                                    <th>Материал</th>
                                    <th className={styles.center}>Ул. бирлик</th>
                                    <th className={styles.numeric}>
                                        Факт (миқд.)
                                    </th>
                                    <th className={styles.numeric}>
                                        Факт (сумма)
                                    </th>
                                    <th className={styles.numeric}>
                                        Норма (миқд.)
                                    </th>
                                    <th className={styles.numeric}>
                                        Норма (сумма)
                                    </th>
                                    <th className={styles.numeric}>
                                        Фарқ (миқд.)
                                    </th>
                                    <th className={styles.numeric}>
                                        Фарқ (сумма)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {values.byMaterial.map((row: any, index: number) => (
                                    <tr key={row.materialId}>
                                        <td className={styles.center}>{index + 1}</td>
                                        <td>{row.materialName}</td>
                                        <td className={styles.center}>
                                            {row.unit || '-'}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(row.factQuantity)}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(row.factTotal)}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(row.normQuantity)}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(row.normTotal)}
                                        </td>
                                        <td
                                            className={`${styles.numeric} ${
                                                row.diffQuantity > 0
                                                    ? styles.diffPositive
                                                    : row.diffQuantity < 0
                                                      ? styles.diffNegative
                                                      : ''
                                            }`}
                                        >
                                            {numberValue(row.diffQuantity)}
                                        </td>
                                        <td
                                            className={`${styles.numeric} ${
                                                row.diffTotal > 0
                                                    ? styles.diffPositive
                                                    : row.diffTotal < 0
                                                      ? styles.diffNegative
                                                      : ''
                                            }`}
                                        >
                                            {numberValue(row.diffTotal)}
                                        </td>
                                    </tr>
                                ))}
                                {values.totals && (
                                    <tr className={styles.totalRow}>
                                        <td className={styles.center} colSpan={2}>Жами</td>
                                        <td className={styles.center}></td>
                                        <td className={styles.numeric}>
                                            {numberValue(
                                                values.totals.factQuantity
                                            )}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(
                                                values.totals.factTotal ?? 0
                                            )}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(
                                                values.totals.normQuantity
                                            )}
                                        </td>
                                        <td className={styles.numeric}>
                                            {numberValue(
                                                values.totals.normTotal ?? 0
                                            )}
                                        </td>
                                        <td
                                            className={`${styles.numeric} ${
                                                (values.totals.diffQuantity ?? 0) > 0
                                                    ? styles.diffPositive
                                                    : (values.totals.diffQuantity ?? 0) < 0
                                                      ? styles.diffNegative
                                                      : ''
                                            }`}
                                        >
                                            {numberValue(
                                                values.totals.diffQuantity ?? 0
                                            )}
                                        </td>
                                        <td
                                            className={`${styles.numeric} ${
                                                (values.totals.diffTotal ?? 0) > 0
                                                    ? styles.diffPositive
                                                    : (values.totals.diffTotal ?? 0) < 0
                                                      ? styles.diffNegative
                                                      : ''
                                            }`}
                                        >
                                            {numberValue(
                                                values.totals.diffTotal ?? 0
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};
