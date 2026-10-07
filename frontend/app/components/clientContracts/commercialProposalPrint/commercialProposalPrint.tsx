'use client';

import { forwardRef } from 'react';
import styles from './commercialProposalPrint.module.css';

export type CommercialProposalOrderLine = {
    index: number;
    orderLabel: string;
    productName: string;
    price: number;
};

export type CommercialProposalPrintProps = {
    clientName: string;
    contractDateMs: number;
    orders: CommercialProposalOrderLine[];
    grandTotal: number;
    /** Муддат матни (масалан, 10 кун) */
    validityNote: string;
};

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString('ru-RU');
}

function formatSum(n: number): string {
    return n.toLocaleString('ru-RU');
}

const CommercialProposalPrint = forwardRef<HTMLDivElement, CommercialProposalPrintProps>(
    ({ clientName, contractDateMs, orders, grandTotal, validityNote }, ref) => {
        return (
            <div ref={ref} className={styles.root}>
                <div className={styles.badge}>ТИЖОРИЙ ТАКЛИФ</div>
                <h1 className={styles.title}>Тижорий таклиф</h1>
                <div className={styles.meta}>
                    <div>
                        <strong>Сана:</strong> {formatDate(contractDateMs)}
                    </div>
                    <div>
                        <strong>Мижоз:</strong> {clientName || '—'}
                    </div>
                </div>
                <p className={styles.intro}>
                    Ҳурматли мижоз! Қуйида буюртмалар бўйича нархлар ва умумий сумма кўрсатилган. Танлов
                    учун қулай жадвал шаклида тайёрланган.
                </p>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '8%' }}>№</th>
                            <th style={{ width: '22%' }}>Буюртма</th>
                            <th>Маҳсулот / хизмат</th>
                            <th style={{ width: '20%', textAlign: 'right' }}>Нарх (сўм)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ textAlign: 'center', padding: '12pt' }}>
                                    Буюртмалар танланмаган
                                </td>
                            </tr>
                        ) : (
                            orders.map((r) => (
                                <tr key={r.index}>
                                    <td style={{ textAlign: 'center' }}>{r.index}</td>
                                    <td>{r.orderLabel || '—'}</td>
                                    <td>{r.productName || '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {formatSum(r.price)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <div className={styles.totalBox}>
                    <div className={styles.totalLabel}>Умумий сумма (сўм)</div>
                    <div className={styles.totalValue}>{formatSum(grandTotal)}</div>
                </div>
                <p className={styles.note}>{validityNote}</p>
                <div className={styles.footer}>
                    <div className={styles.footerBox}>
                        <strong>Масъул шахс</strong>
                        <br />
                        имзо _______________
                    </div>
                    <div className={styles.footerBox}>
                        <strong>Алоқа</strong>
                        <br />
                        тел. ___________________
                    </div>
                </div>
            </div>
        );
    },
);

CommercialProposalPrint.displayName = 'CommercialProposalPrint';

export default CommercialProposalPrint;
