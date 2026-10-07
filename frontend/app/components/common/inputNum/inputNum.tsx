import { InputNumProps } from './inputNum.props';
import styles from './inputNum.module.css';
import cn from 'classnames';
import { useState, useEffect, forwardRef, useMemo } from 'react';

function cleanNumber(str: string): string {
    return str.replace(/\s/g, '').replace(/,/g, '.');
}

function partialDecimalPattern(maxFrac: number): RegExp {
    return new RegExp(`^-?\\d*\\.?\\d{0,${maxFrac}}$`);
}

function isPartialDecimalInput(raw: string, maxFrac: number): boolean {
    const t = cleanNumber(raw);
    if (t === '' || t === '-') return true;
    return partialDecimalPattern(maxFrac).test(t);
}

function parseNumericInput(edited: string, maxFrac: number): string {
    const t = cleanNumber(edited).trim();
    if (t === '' || t === '-') return '';
    const n = Number(t);
    if (!Number.isFinite(n)) return '';
    const mul = 10 ** maxFrac;
    const rounded = Math.round(n * mul) / mul;
    if (Object.is(rounded, -0)) return '0';
    return String(rounded);
}

function plainNumberForEdit(raw: string, maxFrac: number): string {
    const t = raw?.trim() ?? '';
    if (t === '') return '';
    const n = Number(cleanNumber(t));
    if (!Number.isFinite(n)) return t;
    const mul = 10 ** maxFrac;
    const rounded = Math.round(n * mul) / mul;
    return String(rounded);
}

export const InputNum = forwardRef<HTMLInputElement, InputNumProps>(({
    label,
    visible = true,
    className,
    value: externalValue,
    onChange: externalOnChange,
    onFocus: externalOnFocus,
    maximumFractionDigits = 3,
    ...props
}: InputNumProps, ref): JSX.Element => {

    const [displayValue, setDisplayValue] = useState<string>('');
    const [isFocused, setIsFocused] = useState(false);
    const [editBuffer, setEditBuffer] = useState('');

    const numberFormat = useMemo(
        () => new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits,
        }),
        [maximumFractionDigits],
    );

    const formatNumber = (num: number): string => {
        if (isNaN(num)) return '';
        return numberFormat.format(num);
    };

    useEffect(() => {
        if (isFocused) return;
        if (externalValue !== undefined && externalValue !== null && externalValue !== '') {
            const numValue = Number(cleanNumber(externalValue.toString()));
            if (!Number.isFinite(numValue)) {
                setDisplayValue(externalValue.toString());
            } else {
                setDisplayValue(formatNumber(numValue));
            }
        } else {
            setDisplayValue('');
        }
    }, [externalValue, isFocused, numberFormat]);

    if (visible == false) return <></>;

    const inputValue = isFocused ? editBuffer : displayValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (!isPartialDecimalInput(raw, maximumFractionDigits)) return;
        setEditBuffer(cleanNumber(raw));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const parsed = parseNumericInput(e.target.value, maximumFractionDigits);
        setIsFocused(false);
        setEditBuffer('');

        if (parsed === '') {
            setDisplayValue('');
            if (externalOnChange) {
                const syntheticEvent = {
                    ...e,
                    target: { ...e.target, value: '', id: e.target.id },
                    currentTarget: { ...e.currentTarget, value: '', id: e.currentTarget.id },
                } as React.ChangeEvent<HTMLInputElement>;
                externalOnChange(syntheticEvent);
            }
            return;
        }

        const numValue = Number(parsed);
        setDisplayValue(formatNumber(numValue));

        if (externalOnChange) {
            const syntheticEvent = {
                ...e,
                target: { ...e.target, value: parsed, id: e.target.id },
                currentTarget: { ...e.currentTarget, value: parsed, id: e.currentTarget.id },
            } as React.ChangeEvent<HTMLInputElement>;
            externalOnChange(syntheticEvent);
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        const raw = externalValue != null && externalValue !== ''
            ? String(externalValue)
            : displayValue;
        setEditBuffer(plainNumberForEdit(raw, maximumFractionDigits));
        externalOnFocus?.(e);
    };

    return (
        <div className={styles.box}>
            {label != '' && <div className={styles.label}>{label}</div>}
            <input
                ref={ref}
                className={cn(className, styles.input)}
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                inputMode="decimal"
                {...props}
            />
        </div>
    );
});

InputNum.displayName = 'InputNum';
