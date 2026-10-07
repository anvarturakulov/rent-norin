'use client';

import { forwardRef } from 'react';
import styles from './contractPrintDocument.module.css';

export type ContractPrintOrderLine = {
    index: number;
    orderLabel: string;
    count: number;
    orderPrice: number;
    additionalExpenses: number;
    lineTotal: number;
};

export type ContractPrintItemLine = {
    index: number;
    kind: string;
    name: string;
    count: number;
    price: number;
    amount: number;
};

export type ContractPrintDocumentProps = {
    contractNumber: string;
    contractDateMs: number;
    clientName: string;
    orders: ContractPrintOrderLine[];
    items?: ContractPrintItemLine[];
    expenseTotal: number;
    sumOrderPrices: number;
    grandTotal: number;
};

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString('ru-RU');
}

function formatSum(n: number): string {
    return n.toLocaleString('ru-RU');
}

const ContractPrintDocument = forwardRef<HTMLDivElement, ContractPrintDocumentProps>(
    (
        {
            contractNumber,
            contractDateMs,
            clientName,
            orders,
            items = [],
            expenseTotal,
            sumOrderPrices,
            grandTotal,
        },
        ref,
    ) => {
        const numLabel = contractNumber.trim() || '___________';
        return (
            <div ref={ref} className={styles.root}>
                <h1 className={styles.title}>Мижоз билан шартнома</h1>
                <p className={styles.sub}>
                    <strong>Шартнома №</strong> {numLabel} &nbsp;&nbsp; <strong>сана:</strong>{' '}
                    {formatDate(contractDateMs)}
                </p>

                <div className={styles.block}>
                    <p className={styles.blockTitle}>1. Томонлар</p>
                    <p className={styles.p}>
                        <strong>Бажарувчи:</strong> _________________________________
                    </p>
                    <p className={styles.p}>
                        <strong>Буюртмачи (мижоз):</strong> {clientName || '—'}
                    </p>
                </div>

                <div className={styles.block}>
                    <p className={styles.blockTitle}>2. Буюртмалар</p>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '8%' }}>№</th>
                                <th>Буюртма (ариза)</th>
                                <th style={{ width: '12%' }}>Сони</th>
                                <th style={{ width: '16%' }}>Нарх</th>
                                <th style={{ width: '16%' }}>Жами</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center' }}>
                                        —
                                    </td>
                                </tr>
                            ) : (
                                orders.map((r) => (
                                    <tr key={r.index}>
                                        <td style={{ textAlign: 'center' }}>{r.index}</td>
                                        <td>{r.orderLabel || '—'}</td>
                                        <td style={{ textAlign: 'right' }}>{formatSum(r.count)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatSum(r.orderPrice)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatSum(r.lineTotal)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className={styles.block}>
                    <p className={styles.blockTitle}>3. ТМЦ ва хизматлар</p>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '8%' }}>№</th>
                                <th style={{ width: '16%' }}>Тури</th>
                                <th>Номи</th>
                                <th style={{ width: '12%' }}>Сони</th>
                                <th style={{ width: '16%' }}>Нарх</th>
                                <th style={{ width: '16%' }}>Жами</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center' }}>
                                        —
                                    </td>
                                </tr>
                            ) : (
                                items.map((e) => (
                                    <tr key={e.index}>
                                        <td style={{ textAlign: 'center' }}>{e.index}</td>
                                        <td>{e.kind}</td>
                                        <td>{e.name}</td>
                                        <td style={{ textAlign: 'right' }}>{formatSum(e.count)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatSum(e.price)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatSum(e.amount)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <p className={styles.p}>
                        <strong>Буюртмалар жами:</strong> {formatSum(sumOrderPrices)} сўм
                    </p>
                    <p className={styles.p}>
                        <strong>ТМЦ / хизматлар жами:</strong> {formatSum(expenseTotal)} сўм
                    </p>
                    <p className={styles.p}>
                        <strong>Умумий тўлов суммаси:</strong> {formatSum(grandTotal)} сўм
                    </p>
                </div>

                <div className={styles.signRow}>
                    <div className={styles.signCol}>Бажарувчи / имзо</div>
                    <div className={styles.signCol}>Буюртмачи / имзо</div>
                </div>
            </div>
        );
    },
);

ContractPrintDocument.displayName = 'ContractPrintDocument';

export default ContractPrintDocument;
