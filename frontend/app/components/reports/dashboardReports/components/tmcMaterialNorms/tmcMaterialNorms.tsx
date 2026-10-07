'use client'
import { TmcMaterialNormsProps } from './tmcMaterialNorms.props';
import styles from './tmcMaterialNorms.module.css';
import { useEffect, useMemo } from 'react';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { numberValue } from '@/app/service/common/converters';

// Функция для форматирования норм с двумя знаками после запятой без округления (обрезка)
const formatNormValue = (value: number | undefined): string => {
  if (value === undefined || value === null) return '';
  // Обрезаем до 2 знаков после запятой без округления
  const truncated = Math.floor(value * 100) / 100;
  // Форматируем с двумя знаками после запятой и пробелами для тысяч
  return truncated.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const TmcMaterialNorms = ({className, data, currentSection, ...props }: TmcMaterialNormsProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    let title = 'МАХСУЛОТЛАР МАТЕРИАЛЛАР НОРМАСИ' 
    
    useEffect(()=> {
    }, [data])
    
    let datas = data ? data.filter((item: any) => item?.reportType == 'TMCMATERIALNORMS')[0]?.values : []

    // Сортируем продукты по наименованию
    const sortedDatas = useMemo(() => {
        if (!datas || !datas.length) return [];
        return [...datas].sort((a: any, b: any) => {
            const nameA = (a.productName || '').toLowerCase();
            const nameB = (b.productName || '').toLowerCase();
            return nameA.localeCompare(nameB, 'ru');
        });
    }, [datas]);

    // Собираем все уникальные материалы из всех продуктов
    const materialsMap = useMemo(() => {
        const materials = new Map<number, { id: number; name: string; unit: string }>();
        
        if (sortedDatas && sortedDatas.length) {
            sortedDatas.forEach((product: any) => {
                if (product.materialNorms && product.materialNorms.length) {
                    product.materialNorms.forEach((norm: any) => {
                        if (!materials.has(norm.materialId)) {
                            materials.set(norm.materialId, {
                                id: norm.materialId,
                                name: norm.materialName,
                                unit: norm.unit || ''
                            });
                        }
                    });
                }
            });
        }
        
        return Array.from(materials.values());
    }, [sortedDatas]);

    // Создаем карту для быстрого поиска норм по продукту и материалу
    const normsMap = useMemo(() => {
        const map = new Map<string, number>(); // key: `${productId}_${materialId}`, value: quantityPerUnit
        
        if (sortedDatas && sortedDatas.length) {
            sortedDatas.forEach((product: any) => {
                if (product.materialNorms && product.materialNorms.length) {
                    product.materialNorms.forEach((norm: any) => {
                        const key = `${product.productId}_${norm.materialId}`;
                        map.set(key, norm.quantityPerUnit);
                    });
                }
            });
        }
        
        return map;
    }, [sortedDatas]);

    return (
       <>
            <div className={styles.title}>
                {title}
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>

            {sortedDatas && sortedDatas.length > 0 && materialsMap.length > 0 ? (
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.productColumn}>Махсулотлар</th>
                                {materialsMap.map((material) => (
                                    <th key={material.id} className={styles.materialColumn} title={material.unit ? `Ед. изм.: ${material.unit}` : ''}>
                                        <div className={styles.materialHeader}>
                                            <div>{material.name}</div>
                                            {material.unit && <div className={styles.materialUnit}>({material.unit})</div>}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedDatas.map((product: any) => (
                                <tr key={product.productId}>
                                    <td className={styles.productCell}>
                                        <div className={styles.productName}>{product.productName}</div>
                                        {product.thirdPrice !== undefined && product.thirdPrice !== null && product.thirdPrice > 0 ? (
                                            <div className={styles.productPrice}>{numberValue(product.thirdPrice)}</div>
                                        ) : (
                                            product.unit && <div className={styles.productUnit}>({product.unit})</div>
                                        )}
                                    </td>
                                    {materialsMap.map((material) => {
                                        const key = `${product.productId}_${material.id}`;
                                        const norm = normsMap.get(key);
                                        return (
                                            <td key={material.id} className={styles.normCell}>
                                                {norm !== undefined ? (
                                                    <span className={styles.normValue}>{formatNormValue(norm)}</span>
                                                ) : (
                                                    <span className={styles.emptyCell}>-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className={styles.emptyMessage}>
                    Материаллар нормаси топилмади
                </div>
            )}
       </>
    )
}

