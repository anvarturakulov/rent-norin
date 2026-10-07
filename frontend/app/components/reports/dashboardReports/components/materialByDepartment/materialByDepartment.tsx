'use client'
import { MaterialByDepartmentProps } from './materialByDepartment.props';
import styles from './materialByDepartment.module.css';
import { useMemo, useState, useEffect } from 'react';
import { numberValue } from '@/app/service/common/converters';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const MaterialByDepartment = ({ className, data, ...props }: MaterialByDepartmentProps): JSX.Element => {
    const enterpriseName = useEnterpriseName();

    const reportData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        const report = data.find((item: any) => item?.reportType === 'MATERIALBYDEPARTMENT');
        return report?.values || [];
    }, [data]);

    // Инициализируем все цеха как развернутые по умолчанию
    const [expandedDepts, setExpandedDepts] = useState<Set<number>>(() => {
        const initialSet = new Set<number>();
        if (reportData && reportData.length > 0) {
            reportData.forEach((dept: any) => {
                if (dept.departmentId) {
                    initialSet.add(dept.departmentId);
                }
            });
        }
        return initialSet;
    });

    // Обновляем развернутые цеха при изменении данных - все развернуты по умолчанию
    useEffect(() => {
        if (reportData && reportData.length > 0) {
            setExpandedDepts(prev => {
                const newSet = new Set(prev);
                reportData.forEach((dept: any) => {
                    if (dept.departmentId) {
                        newSet.add(dept.departmentId);
                    }
                });
                return newSet;
            });
        }
    }, [reportData]);

    const grandTotals = useMemo(() => {
        return reportData.reduce((acc: any, dept: any) => ({
            count: acc.count + (dept.totalCount || 0),
            summa: acc.summa + (dept.totalSumma || 0)
        }), { count: 0, summa: 0 });
    }, [reportData]);

    const toggleDept = (deptId: number) => {
        setExpandedDepts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(deptId)) {
                newSet.delete(deptId);
            } else {
                newSet.add(deptId);
            }
            return newSet;
        });
    };

    if (!reportData || reportData.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.title}>
                    ХОМ АШЁ ЧИКИМИ - ЦЕХЛАР БУЙИЧА
                    {enterpriseName && <span> - {enterpriseName}</span>}
                </div>
                <div className={styles.emptyMessage}>
                    Маълумотлар топилмади
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container} {...props}>
            <div className={styles.title}>
                ХОМ АШЁ ЧИКИМИ - ЦЕХЛАР БУЙИЧА
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>

            {reportData.map((dept: any) => (
                <div key={dept.departmentId} className={styles.departmentSection}>
                    <div 
                        className={styles.departmentHeader}
                        onClick={() => toggleDept(dept.departmentId)}
                    >
                        <span className={styles.departmentName}>{dept.departmentName}</span>
                        <span className={styles.departmentTotal}>Жами: {numberValue(dept.totalSumma)}</span>
                    </div>
                    
                    {expandedDepts.has(dept.departmentId) && (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Материал</th>
                                    <th>Сон</th>
                                    <th>Сумма</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dept.materials.map((mat: any) => (
                                    <tr key={mat.materialId}>
                                        <td>{mat.materialName}</td>
                                        <td>{numberValue(mat.count)}</td>
                                        <td>{numberValue(mat.summa)}</td>
                                    </tr>
                                ))}
                                <tr className={styles.totalRow}>
                                    <td>Жами</td>
                                    <td className={styles.totalTd}>{numberValue(dept.totalCount)}</td>
                                    <td className={styles.totalTd}>{numberValue(dept.totalSumma)}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            ))}

            <div className={styles.grandTotal}>
                <span className={styles.grandTotalLabel}>УМУМИЙ ЖАМИ:</span>
                <span className={styles.grandTotalValue}>{numberValue(grandTotals.summa)}</span>
            </div>
        </div>
    );
};

