'use client'
import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/app.context';
import axios from 'axios';
import { numberValue } from '@/app/service/common/converters';
import styles from './IncomeDetailsModal.module.css';

interface IncomeDetailByDocument {
    docType: string;
    docId: number;
    docDate: number;
    productId: number;
    productName: string;
    count: number;
    price: number;
    total: number;
    priceSource?: 'refValues' | 'pereodic';
    pereodicDate?: number;
    usedThirdPrice?: number;
}

interface IncomeDetailByProduct {
    productId: number;
    productName: string;
    totalCount: number;
    avgPrice: number;
    totalSum: number;
    detailsCount: number;
}

interface IncomeDetailsResult {
    summary: number;
    byDocuments: IncomeDetailByDocument[];
    byProducts: IncomeDetailByProduct[];
}

interface IncomeDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    workshopId: number;
    workshopName: string;
    startDate: number;
    endDate: number;
    expectedIncome: number;
}

export const IncomeDetailsModal: React.FC<IncomeDetailsModalProps> = ({
    isOpen,
    onClose,
    workshopId,
    workshopName,
    startDate,
    endDate,
    expectedIncome
}) => {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const { selectedEnterpriseId } = mainData.report;
    
    const [activeTab, setActiveTab] = useState<'documents' | 'products'>('documents');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<IncomeDetailsResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && workshopId) {
            loadIncomeDetails();
        } else {
            setData(null);
            setError(null);
            setSelectedProductId(null);
        }
    }, [isOpen, workshopId, startDate, endDate]);

    const loadIncomeDetails = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const enterpriseId = typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null 
                ? (selectedEnterpriseId as any)?.id 
                : selectedEnterpriseId;
            
            let url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/foyda-by-production/income-details?` +
                `workshopId=${workshopId}&` +
                `startDate=${startDate}&` +
                `endDate=${endDate}`;
            
            if (enterpriseId !== null && enterpriseId !== undefined && typeof enterpriseId === 'number') {
                url += `&enterpriseId=${enterpriseId}`;
            }
            
            const config = {
                headers: { Authorization: `Bearer ${user?.token}` }
            };
            
            const response = await axios.get<IncomeDetailsResult>(url, config);
            setData(response.data);
            
            // Проверка консистентности
            if (response.data.summary !== expectedIncome) {
                console.warn(
                    `[IncomeDetailsModal] Несоответствие сумм: ожидалось ${expectedIncome}, получено ${response.data.summary}`
                );
            }
        } catch (error: any) {
            console.error('Ошибка при загрузке детализации дохода:', error);
            setError(error.message || 'Ошибка при загрузке данных');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const getPriceSourceLabel = (item: IncomeDetailByDocument): string => {
        if (item.priceSource === 'pereodic' && item.pereodicDate) {
            return `Периодическое (${formatDate(item.pereodicDate)})`;
        }
        if (item.priceSource === 'refValues') {
            return 'Справочник';
        }
        return 'Документ';
    };

    const filteredDocuments = selectedProductId
        ? data?.byDocuments.filter(doc => doc.productId === selectedProductId) || []
        : data?.byDocuments || [];

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Детализация дохода: {workshopName}</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    {loading && (
                        <div className={styles.loading}>
                            <p>Загрузка данных...</p>
                        </div>
                    )}

                    {error && (
                        <div className={styles.error}>
                            <p>Ошибка: {error}</p>
                            <button onClick={loadIncomeDetails}>Повторить</button>
                        </div>
                    )}

                    {!loading && !error && data && (
                        <>
                            <div className={styles.summary}>
                                <div className={styles.summaryItem}>
                                    <span className={styles.summaryLabel}>Итого доход:</span>
                                    <span className={styles.summaryValue}>{numberValue(data.summary)}</span>
                                </div>
                                {data.summary !== expectedIncome && (
                                    <div className={styles.summaryWarning}>
                                        ⚠️ Ожидалось: {numberValue(expectedIncome)} (разница: {numberValue(Math.abs(data.summary - expectedIncome))})
                                    </div>
                                )}
                            </div>

                            <div className={styles.tabs}>
                                <button
                                    className={`${styles.tab} ${activeTab === 'documents' ? styles.activeTab : ''}`}
                                    onClick={() => {
                                        setActiveTab('documents');
                                        setSelectedProductId(null);
                                    }}
                                >
                                    По документам ({data.byDocuments.length})
                                </button>
                                <button
                                    className={`${styles.tab} ${activeTab === 'products' ? styles.activeTab : ''}`}
                                    onClick={() => {
                                        setActiveTab('products');
                                        setSelectedProductId(null);
                                    }}
                                >
                                    По продукции ({data.byProducts.length})
                                </button>
                            </div>

                            {activeTab === 'documents' && (
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Дата</th>
                                                <th>Документ</th>
                                                <th>Товар</th>
                                                <th>Кол-во</th>
                                                <th>Цена</th>
                                                <th>Сумма</th>
                                                {data.byDocuments.some(d => d.priceSource) && <th>Источник цены</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDocuments.length === 0 ? (
                                                <tr>
                                                    <td colSpan={data.byDocuments.some(d => d.priceSource) ? 7 : 6} className={styles.emptyCell}>
                                                        Нет данных
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredDocuments.map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{formatDate(item.docDate)}</td>
                                                        <td>{item.docType} #{item.docId}</td>
                                                        <td>{item.productName}</td>
                                                        <td>{numberValue(item.count)}</td>
                                                        <td>{numberValue(item.price)}</td>
                                                        <td className={styles.totalCell}>{numberValue(item.total)}</td>
                                                        {data.byDocuments.some(d => d.priceSource) && (
                                                            <td className={styles.priceSourceCell}>
                                                                {getPriceSourceLabel(item)}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                        {filteredDocuments.length > 0 && (
                                            <tfoot>
                                                <tr>
                                                    <td colSpan={data.byDocuments.some(d => d.priceSource) ? 5 : 4} className={styles.footerLabel}>
                                                        Итого:
                                                    </td>
                                                    <td className={styles.footerTotal}>
                                                        {numberValue(filteredDocuments.reduce((sum, item) => sum + item.total, 0))}
                                                    </td>
                                                    {data.byDocuments.some(d => d.priceSource) && <td></td>}
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}

                            {activeTab === 'products' && (
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Товар</th>
                                                <th>Кол-во</th>
                                                <th>Средняя цена</th>
                                                <th>Сумма</th>
                                                <th>Документов</th>
                                                <th>Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.byProducts.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className={styles.emptyCell}>
                                                        Нет данных
                                                    </td>
                                                </tr>
                                            ) : (
                                                data.byProducts.map((item) => (
                                                    <tr key={item.productId}>
                                                        <td>{item.productName}</td>
                                                        <td>{numberValue(item.totalCount)}</td>
                                                        <td>{numberValue(item.avgPrice)}</td>
                                                        <td className={styles.totalCell}>{numberValue(item.totalSum)}</td>
                                                        <td>{item.detailsCount}</td>
                                                        <td>
                                                            <button
                                                                className={styles.viewButton}
                                                                onClick={() => {
                                                                    setActiveTab('documents');
                                                                    setSelectedProductId(item.productId);
                                                                }}
                                                            >
                                                                Показать документы
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                        {data.byProducts.length > 0 && (
                                            <tfoot>
                                                <tr>
                                                    <td colSpan={3} className={styles.footerLabel}>
                                                        Итого:
                                                    </td>
                                                    <td className={styles.footerTotal}>
                                                        {numberValue(data.byProducts.reduce((sum, item) => sum + item.totalSum, 0))}
                                                    </td>
                                                    <td colSpan={2}></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}

                            {selectedProductId && activeTab === 'documents' && (
                                <div className={styles.filterInfo}>
                                    <span>Показаны документы для товара: {data.byProducts.find(p => p.productId === selectedProductId)?.productName}</span>
                                    <button onClick={() => setSelectedProductId(null)}>Сбросить фильтр</button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.closeBtn} onClick={onClose}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

