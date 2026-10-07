'use client'
import { useState } from 'react';
import { FoydaByProductionProps } from './foydaByProduction.props';
import styles from './foydaByProduction.module.css';
import { numberValue } from '@/app/service/common/converters';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { useAppContext } from '@/app/context/app.context';
import axios from 'axios';
import { Schet } from '@/app/interfaces/report.interface';
import { showMessage } from '@/app/service/common/showMessage';
import { IncomeDetailsModal } from './IncomeDetailsModal';

const totalByKey = (key: string, data: any[]) => {
    let total = 0;
    if (data && data.length) {
        data.forEach((item: any) => {
            total += (item[key] || 0);
        });
    }
    return total;
};

export const FoydaByProduction = ({ className, data, ...props }: FoydaByProductionProps): JSX.Element | null => {
    const enterpriseName = useEnterpriseName();
    const { mainData, setMainData } = useAppContext();
    const { dateStart, dateEnd } = mainData.journal.interval;
    const { user } = mainData.users;
    const { selectedEnterpriseId } = mainData.report;
    
    const [incomeModalOpen, setIncomeModalOpen] = useState(false);
    const [selectedWorkshop, setSelectedWorkshop] = useState<{ id: number; name: string; income: number } | null>(null);
    
    const reportData = data ? data.filter((item: any) => item?.reportType === 'FOYDABYPRODUCTION')[0]?.values : [];
    
    if (!reportData || reportData.length === 0) {
        return null;
    }
    
    const handleIncomeClick = (item: any) => {
        if (item.income && item.income !== 0) {
            setSelectedWorkshop({
                id: item.workshopId,
                name: item.workshopName || 'Не указано',
                income: item.income || 0
            });
            setIncomeModalOpen(true);
        }
    };
    
    // Маппинг типов расходов на счета
    const expenseTypeMapping: Record<string, { debet: Schet, kredit: Schet, label: string }> = {
        cashExpenses: { debet: Schet.S20, kredit: Schet.S50, label: 'Пуллик харажатлар' },
        materialExpenses: { debet: Schet.S20, kredit: Schet.S10, label: 'Цемент ва арматура харажати' },
        productionExpenses: { debet: Schet.S20, kredit: Schet.S28, label: 'Производственные расходы' },
        internalExpenses: { debet: Schet.S20, kredit: Schet.S41, label: 'Автохизмат ва булимлардан келган харажатлар' },
        supplierExpenses: { debet: Schet.S20, kredit: Schet.S60, label: 'Электроэнергия ва таъминот. келган харажатлар' },
        salaryExpenses: { debet: Schet.S20, kredit: Schet.S67, label: 'Иш хаки харажатлари' }
    };
    
    const handleCellClick = async (column: string, item: any) => {
        // Проверяем, что это колонка расходов и есть значение
        if (!expenseTypeMapping[column] || !item[column] || item[column] === 0) {
            return;
        }
        
        const expenseType = expenseTypeMapping[column];
        const enterpriseId = typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null 
            ? (selectedEnterpriseId as any)?.id 
            : selectedEnterpriseId;
        
        showMessage('Маълумот юкланмокда. Кутуб туринг', 'warm', setMainData);
        
        try {
            let url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/expense-entries?` +
                `debet=${expenseType.debet}&` +
                `kredit=${expenseType.kredit}&` +
                `startDate=${dateStart}&` +
                `endDate=${dateEnd}&` +
                `workshopId=${item.workshopId}`;
            
            if (enterpriseId !== null && enterpriseId !== undefined && typeof enterpriseId === 'number') {
                url += `&enterpriseId=${enterpriseId}`;
            }
            
            const config = {
                headers: { Authorization: `Bearer ${user?.token}` }
            };
            
            const response = await axios.get(url, config);
            const entries = response.data || [];
            
            // Преобразуем entries в формат EntryItem для showMessage
            const formattedEntries = entries.map((entry: any) => {
                const formatted = {
                    date: Number(entry.date),
                    docNumber: entry.docId ? Number(entry.docId) : 0,
                    docId: entry.docId ? String(entry.docId) : '',
                    documentType: entry.documentType,
                    debet: entry.debet,
                    debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                    debetFirstSubcontoName: entry.debetFirstSubcontoReference?.name || '',
                    debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                    debetSecondSubcontoName: entry.debetSecondSubcontoReference?.name || '',
                    kredit: entry.kredit,
                    kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                    kreditFirstSubcontoName: entry.kreditFirstSubcontoReference?.name || '',
                    kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                    kreditSecondSubcontoName: entry.kreditSecondSubcontoReference?.name || '',
                    count: entry.count || 0,
                    total: entry.total || 0,
                    description: entry.description || '',
                    fullDescription: entry.fullDescription || ''
                };
                return formatted;
            });
            
            if (setMainData) {
                showMessage(formattedEntries, 'warm', setMainData);
            }
        } catch (error: any) {
            console.error('Ошибка при загрузке проводок:', error);
            if (setMainData) {
                showMessage(error.message || 'Ошибка при загрузке проводок', 'error', setMainData);
            }
        }
    };
    
    // Рассчитываем итоги
    const totalIncome = totalByKey('income', reportData);
    const totalCashExpenses = totalByKey('cashExpenses', reportData);
    const totalMaterialExpenses = totalByKey('materialExpenses', reportData);
    const totalInternalExpenses = totalByKey('internalExpenses', reportData);
    const totalSupplierExpenses = totalByKey('supplierExpenses', reportData);
    const totalSalaryExpenses = totalByKey('salaryExpenses', reportData);
    const totalCurrentExpenses = totalByKey('currentExpenses', reportData);
    const totalCurrentProfit = totalByKey('currentProfit', reportData);
    const totalDistributedCommonExpenses = totalByKey('distributedCommonExpenses', reportData);
    const totalExpenses = totalByKey('totalExpenses', reportData);
    const totalProfit = totalByKey('profit', reportData);
    
    return (
        <>
            <div className={styles.title}>
                ФОЙДА ХИСОБИ (ЦЕХЛАР БУЙИЧА)
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <div className={styles.tableContainer} data-report-scroll>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <td>№</td>
                            <td>Цех</td>
                            <td>Ишлаб чик. махсулот (сотиш нархида)</td>
                            <td>Пуллик харажатлар</td>
                            <td>Хом ашёлар харажатлари</td>
                            <td>Ички булимлардан келган харажатлар</td>
                            <td>Электроэнергия ва таъминот. келган харажатлар</td>
                            <td>Иш хаки харажатлари</td>
                            <td>Жорий харажатлар</td>
                            <td>Жорий фойда</td>
                            <td>ИТР ва умумий харажатлар</td>
                            <td>Жами харажатлар</td>
                            <td>Фойда</td>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((item: any, index: number) => (
                            <tr key={item.workshopId || index}>
                                <td>{index + 1}</td>
                                <td className={styles.workshopName}>{item.workshopName || 'Не указано'}</td>
                                <td 
                                    className={`${item.income && item.income !== 0 ? styles.clickable : ''}`}
                                    onClick={() => handleIncomeClick(item)}
                                    title={item.income && item.income !== 0 ? 'Кликните для детализации' : ''}
                                >
                                    {numberValue(item.income || 0)}
                                </td>
                                <td 
                                    className={`${styles.clickable} ${expenseTypeMapping.cashExpenses ? styles.expenseCell : ''}`}
                                    onDoubleClick={() => handleCellClick('cashExpenses', item)}
                                >
                                    {numberValue(item.cashExpenses || 0)}
                                </td>
                                <td 
                                    className={`${styles.clickable} ${expenseTypeMapping.materialExpenses ? styles.expenseCell : ''}`}
                                    onDoubleClick={() => handleCellClick('materialExpenses', item)}
                                >
                                    {numberValue(item.materialExpenses || 0)}
                                </td>
                                <td 
                                    className={`${styles.clickable} ${expenseTypeMapping.internalExpenses ? styles.expenseCell : ''}`}
                                    onDoubleClick={() => handleCellClick('internalExpenses', item)}
                                >
                                    {numberValue(item.internalExpenses || 0)}
                                </td>
                                <td 
                                    className={`${styles.clickable} ${expenseTypeMapping.supplierExpenses ? styles.expenseCell : ''}`}
                                    onDoubleClick={() => handleCellClick('supplierExpenses', item)}
                                >
                                    {numberValue(item.supplierExpenses || 0)}
                                </td>
                                <td 
                                    className={`${styles.clickable} ${expenseTypeMapping.salaryExpenses ? styles.expenseCell : ''}`}
                                    onDoubleClick={() => handleCellClick('salaryExpenses', item)}
                                >
                                    {numberValue(item.salaryExpenses || 0)}
                                </td>
                                <td>{numberValue(item.currentExpenses || 0)}</td>
                                <td>{numberValue(item.currentProfit || 0)}</td>
                                <td>{numberValue(item.distributedCommonExpenses || 0)}</td>
                                <td>{numberValue(item.totalExpenses || 0)}</td>
                                <td>{numberValue(item.profit || 0)}</td>
                            </tr>
                        ))}
                        <tr className={styles.totalRow}>
                            <td></td>
                            <td>ЖАМИ</td>
                            <td>{numberValue(totalIncome)}</td>
                            <td>{numberValue(totalCashExpenses)}</td>
                            <td>{numberValue(totalMaterialExpenses)}</td>
                            <td>{numberValue(totalInternalExpenses)}</td>
                            <td>{numberValue(totalSupplierExpenses)}</td>
                            <td>{numberValue(totalSalaryExpenses)}</td>
                            <td>{numberValue(totalCurrentExpenses)}</td>
                            <td>{numberValue(totalCurrentProfit)}</td>
                            <td>{numberValue(totalDistributedCommonExpenses)}</td>
                            <td>{numberValue(totalExpenses)}</td>
                            <td>{numberValue(totalProfit)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            {selectedWorkshop && (
                <IncomeDetailsModal
                    isOpen={incomeModalOpen}
                    onClose={() => {
                        setIncomeModalOpen(false);
                        setSelectedWorkshop(null);
                    }}
                    workshopId={selectedWorkshop.id}
                    workshopName={selectedWorkshop.name}
                    startDate={dateStart}
                    endDate={dateEnd}
                    expectedIncome={selectedWorkshop.income}
                />
            )}
        </>
    );
};

