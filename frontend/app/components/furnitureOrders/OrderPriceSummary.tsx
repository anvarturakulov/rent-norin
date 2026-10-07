'use client';

import { useState } from 'react';
import styles from './OrderPriceSummary.module.css';
import {
    computeOrderTotal,
    formatOrderAmount,
    formatOrderMoney,
    normalizeOrderPrice,
} from '@/app/components/furnitureOrders/helpers/orderPrice';

type Props = {
    count: string;
    price: string;
    onCountChange?: (value: string) => void;
    onPriceChange?: (value: string) => void;
    countReadOnly?: boolean;
    priceReadOnly?: boolean;
    compact?: boolean;
    className?: string;
};

function PriceInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [focused, setFocused] = useState(false);

    const displayValue = focused
        ? value
        : value.trim()
          ? formatOrderAmount(Number(value))
          : '';

    return (
        <input
            className={`${styles.input} ${styles.inputRight}`}
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={(e) => {
                const raw = e.target.value.replace(/\s/g, '').replace(/[^\d]/g, '');
                onChange(raw);
            }}
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
                setFocused(false);
                const v = e.target.value.trim();
                if (v) {
                    onChange(String(normalizeOrderPrice(v)));
                }
            }}
            aria-label="Нарх"
        />
    );
}

export function OrderPriceSummary({
    count,
    price,
    onCountChange,
    onPriceChange,
    countReadOnly,
    priceReadOnly,
    compact,
    className,
}: Props) {
    const total = computeOrderTotal(count, price);

    return (
        <div className={`${styles.wrap} ${compact ? styles.wrapCompact : ''} ${className ?? ''}`}>
            <table className={styles.table} aria-label="Миқдор, нарх ва жами">
                <thead>
                    <tr>
                        <th>Миқдор</th>
                        <th className={styles.colMoney}>Нарх</th>
                        <th className={styles.colMoney}>Жами</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            {countReadOnly || !onCountChange ? (
                                <span className={styles.value}>{count.trim() || '—'}</span>
                            ) : (
                                <input
                                    className={styles.input}
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={count}
                                    onChange={(e) => onCountChange(e.target.value)}
                                    aria-label="Миқдор"
                                />
                            )}
                        </td>
                        <td className={styles.colMoney}>
                            {priceReadOnly || !onPriceChange ? (
                                <span className={`${styles.value} ${styles.valueRight}`}>
                                    {price.trim() ? formatOrderAmount(Number(price)) : '—'}
                                </span>
                            ) : (
                                <PriceInput value={price} onChange={onPriceChange} />
                            )}
                        </td>
                        <td className={styles.colMoney}>
                            <span className={`${styles.totalValue} ${styles.valueRight}`}>
                                {total > 0 ? formatOrderMoney(total) : '—'}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
