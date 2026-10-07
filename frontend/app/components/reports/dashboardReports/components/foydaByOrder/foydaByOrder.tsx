'use client'
import { useState } from 'react';
import { FoydaByOrderProps } from './foydaByOrder.props';
import styles from './foydaByOrder.module.css';
import { numberValue } from '@/app/service/common/converters';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { useAppContext } from '@/app/context/app.context';
import { Schet } from '@/app/interfaces/report.interface';
import {
    OrderEntriesDetailsModal,
    OrderEntriesModalRequest,
} from './OrderEntriesDetailsModal';

const totalByKey = (key: string, data: any[]) => {
    let total = 0;
    if (data && data.length) {
        data.forEach((item: any) => {
            total += (item[key] || 0);
        });
    }
    return total;
};

const formatPercent = (value: number): string => {
    if (!Number.isFinite(value)) return '0%';
    return `${value.toFixed(1)}%`;
};

const EXPENSE_TYPE_MAPPING: Record<string, { debet: Schet; kredit: Schet; label: string }> = {
    cashExpenses: { debet: Schet.S20, kredit: Schet.S50, label: 'Пуллик харажатлар' },
    materialExpenses: { debet: Schet.S20, kredit: Schet.S10, label: 'Хом ашё' },
    halfstuffExpenses: { debet: Schet.S20, kredit: Schet.S21, label: 'Ярим тайёр махсулот' },
    supplierExpenses: { debet: Schet.S20, kredit: Schet.S60, label: 'Таъминотчилар' },
    salaryExpenses: { debet: Schet.S20, kredit: Schet.S67, label: 'Иш хаки' },
};

const EXPENSE_COLUMNS = Object.keys(EXPENSE_TYPE_MAPPING);

export const FoydaByOrder = ({ className, data, ...props }: FoydaByOrderProps): JSX.Element | null => {
    const enterpriseName = useEnterpriseName();
    const { mainData } = useAppContext();
    const { dateStart, dateEnd } = mainData.journal.interval;

    const [modalOpen, setModalOpen] = useState(false);
    const [modalRequest, setModalRequest] = useState<OrderEntriesModalRequest | null>(null);

    const reportData = data
        ? data.filter((item: any) => item?.reportType === 'FOYDABYORDER')[0]?.values
        : [];

    if (!reportData || reportData.length === 0) {
        return null;
    }

    const openIncomeDetails = (item: any) => {
        if (!item.income || item.income === 0 || item.isOverhead) {
            return;
        }
        setModalRequest({
            type: 'income',
            orderId: item.isUnallocatedIncome ? null : item.orderId ?? null,
            saleDocId: item.saleDocId ?? null,
            orderLabel: item.orderLabel || (item.isUnallocatedIncome ? 'Умумий даромад (заказсиз)' : `#${item.orderId}`),
            columnLabel: 'Тушум',
        });
        setModalOpen(true);
    };

    const openExpenseDetails = (column: string, item: any) => {
        const expenseType = EXPENSE_TYPE_MAPPING[column];
        if (!expenseType || !item[column] || item[column] === 0) {
            return;
        }
        setModalRequest({
            type: 'expense',
            orderId: item.isOverhead ? null : item.orderId ?? null,
            debet: expenseType.debet,
            kredit: expenseType.kredit,
            orderLabel: item.orderLabel || (item.isOverhead ? 'Умумий харажатлар' : `#${item.orderId}`),
            columnLabel: expenseType.label,
        });
        setModalOpen(true);
    };

    const clickableClass = (value: number) =>
        value && value !== 0 ? styles.clickable : '';

    const orderRows = reportData.filter((item: any) => !item.isOverhead);
    const totalByKeyOrders = (key: string) => totalByKey(key, orderRows);

    const totalIncome = totalByKeyOrders('income');
    const totalCashExpenses = totalByKeyOrders('cashExpenses');
    const totalMaterialExpenses = totalByKeyOrders('materialExpenses');
    const totalHalfstuffExpenses = totalByKeyOrders('halfstuffExpenses');
    const totalSupplierExpenses = totalByKeyOrders('supplierExpenses');
    const totalSalaryExpenses = totalByKeyOrders('salaryExpenses');
    const totalDistributedOverheadExpenses = totalByKeyOrders('distributedOverheadExpenses');
    const totalExpenses = totalByKeyOrders('totalExpenses');
    const totalProfit = totalByKeyOrders('profit');
    const totalProfitability = totalIncome ? (totalProfit / totalIncome) * 100 : 0;

    return (
        <>
            <div className={styles.title}>
                ФОЙДА ХИСОБИ (ЗАКАЗЛАР БУЙИЧА)
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <div className={styles.tableContainer} data-report-scroll>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <td>№</td>
                            <td>Заказ</td>
                            <td>Сотув</td>
                            <td>Пуллик харажат</td>
                            <td>Хом ашё</td>
                            <td>Ярим тайёр махсулот</td>
                            <td>Таъминотчи</td>
                            <td>Иш хаки</td>
                            <td>Умум харажатлар</td>
                            <td>Жами харажатлар</td>
                            <td>Фойда</td>
                            <td>Рентабеллик</td>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((item: any, index: number) => (
                            <tr
                                key={
                                    item.isUnallocatedIncome
                                        ? `unallocated-income-${index}`
                                        : item.orderId ?? `overhead-${index}`
                                }
                                className={item.isOverhead || item.isUnallocatedIncome ? styles.overheadRow : ''}
                            >
                                <td>{index + 1}</td>
                                <td className={styles.orderName}>{item.orderLabel || 'Не указано'}</td>
                                <td
                                    className={clickableClass(item.income || 0)}
                                    onClick={() => openIncomeDetails(item)}
                                    title={item.income ? 'Детализация' : undefined}
                                >
                                    {numberValue(item.income || 0)}
                                </td>
                                {EXPENSE_COLUMNS.map((column) => (
                                    <td
                                        key={column}
                                        className={`${clickableClass(item[column] || 0)} ${EXPENSE_TYPE_MAPPING[column] ? styles.expenseCell : ''}`}
                                        onClick={() => openExpenseDetails(column, item)}
                                        title={item[column] ? 'Детализация' : undefined}
                                    >
                                        {numberValue(item[column] || 0)}
                                    </td>
                                ))}
                                <td>{numberValue(item.distributedOverheadExpenses || 0)}</td>
                                <td>{numberValue(item.totalExpenses || 0)}</td>
                                <td className={!item.isOverhead && (item.profit || 0) >= 0 ? styles.profitPositive : !item.isOverhead ? styles.profitNegative : ''}>
                                    {item.isOverhead ? '-' : numberValue(item.profit || 0)}
                                </td>
                                <td className={!item.isOverhead && (item.profit || 0) >= 0 ? styles.profitPositive : !item.isOverhead ? styles.profitNegative : ''}>
                                    {item.isOverhead ? '-' : formatPercent(item.profitability || 0)}
                                </td>
                            </tr>
                        ))}
                        <tr className={styles.totalRow}>
                            <td></td>
                            <td>ЖАМИ</td>
                            <td>{numberValue(totalIncome)}</td>
                            <td>{numberValue(totalCashExpenses)}</td>
                            <td>{numberValue(totalMaterialExpenses)}</td>
                            <td>{numberValue(totalHalfstuffExpenses)}</td>
                            <td>{numberValue(totalSupplierExpenses)}</td>
                            <td>{numberValue(totalSalaryExpenses)}</td>
                            <td>{numberValue(totalDistributedOverheadExpenses)}</td>
                            <td>{numberValue(totalExpenses)}</td>
                            <td>{numberValue(totalProfit)}</td>
                            <td>{formatPercent(totalProfitability)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <OrderEntriesDetailsModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setModalRequest(null);
                }}
                request={modalRequest}
                startDate={dateStart}
                endDate={dateEnd}
            />
        </>
    );
};
