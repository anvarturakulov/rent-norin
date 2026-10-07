import { useState, type ChangeEvent } from 'react';
import cellStyles from './workTableCells.module.css';

const worksNumberDisplay = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const worksQtyNumberDisplay = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
});

const worksNormNumberDisplay = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
});

export type WorksNumericFractionDigits = 2 | 3 | 4;

function getFractionMultiplier(fractionDigits: WorksNumericFractionDigits): number {
    if (fractionDigits === 4) return 10000;
    if (fractionDigits === 3) return 1000;
    return 100;
}

function getDisplayFormat(fractionDigits: WorksNumericFractionDigits): Intl.NumberFormat {
    if (fractionDigits === 4) return worksNormNumberDisplay;
    if (fractionDigits === 3) return worksQtyNumberDisplay;
    return worksNumberDisplay;
}

/** Отображение числа: триады, до 2, 3 или 4 знаков после запятой */
export function formatWorksNumberDisplay(raw: string, fractionDigits: WorksNumericFractionDigits = 2): string {
    const t = raw?.trim() ?? '';
    if (t === '') return '';
    const n = Number(t.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return t;
    return getDisplayFormat(fractionDigits).format(n);
}

/** Разбор ввода: пробелы, запятая/точка, округление для хранения в draft */
function parseWorksNumberInput(edited: string, fractionDigits: WorksNumericFractionDigits = 2): string {
    const t = edited.replace(/\s/g, '').replace(',', '.').trim();
    if (t === '' || t === '-') return '';
    const n = Number(t);
    if (!Number.isFinite(n)) return '';
    const mul = getFractionMultiplier(fractionDigits);
    const rounded = Math.round(n * mul) / mul;
    if (Object.is(rounded, -0)) return '0';
    return String(rounded);
}

/** Строка для правки без группировки */
function plainWorksNumberForEdit(raw: string, fractionDigits: WorksNumericFractionDigits = 2): string {
    const t = raw?.trim() ?? '';
    if (t === '') return '';
    const n = Number(t.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return t;
    const mul = getFractionMultiplier(fractionDigits);
    const rounded = Math.round(n * mul) / mul;
    return String(rounded);
}

function mergeInputClass(className?: string): string {
    return [cellStyles.workTableCellInput, className].filter(Boolean).join(' ');
}

function partialDecimalPattern(fractionDigits: WorksNumericFractionDigits): RegExp {
    const maxFrac = fractionDigits === 4 ? 4 : fractionDigits === 3 ? 3 : 2;
    return new RegExp(`^-?\\d*\\.?\\d{0,${maxFrac}}$`);
}

function isPartialDecimalInput(raw: string, fractionDigits: WorksNumericFractionDigits): boolean {
    const t = raw.replace(/\s/g, '').replace(',', '.');
    if (t === '' || t === '-') return true;
    return partialDecimalPattern(fractionDigits).test(t);
}

/** Числовая ячейка: вне фокуса — форматированное число, в фокусе — строка без группировки */
export function WorkNumericCell({
    value,
    onChange,
    className,
    title,
    fractionDigits = 2,
    disabled = false,
}: {
    value: string;
    onChange: (next: string) => void;
    className?: string;
    title?: string;
    fractionDigits?: WorksNumericFractionDigits;
    disabled?: boolean;
}) {
    const [focused, setFocused] = useState(false);
    const [editBuffer, setEditBuffer] = useState('');

    const inputValue = focused
        ? editBuffer
        : formatWorksNumberDisplay(value, fractionDigits);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const raw = e.target.value;
        if (!isPartialDecimalInput(raw, fractionDigits)) return;
        setEditBuffer(raw.replace(/\s/g, '').replace(',', '.'));
    };

    const handleBlur = (e: ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const parsed = parseWorksNumberInput(e.target.value, fractionDigits);
        onChange(parsed);
        setEditBuffer('');
        setFocused(false);
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            title={title}
            disabled={disabled}
            className={mergeInputClass(className)}
            value={inputValue}
            onFocus={() => {
                if (disabled) return;
                setEditBuffer(plainWorksNumberForEdit(value, fractionDigits));
                setFocused(true);
            }}
            onChange={handleChange}
            onBlur={handleBlur}
        />
    );
}

/** Текстовая ячейка (например ед. изм.) */
export function WorkEditableCell({
    value,
    onChange,
    className,
    title,
    placeholder,
    disabled = false,
}: {
    value: string;
    onChange: (next: string) => void;
    className?: string;
    title?: string;
    placeholder?: string;
    disabled?: boolean;
}) {
    return (
        <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            title={title}
            placeholder={placeholder}
            disabled={disabled}
            className={mergeInputClass(className)}
            value={value ?? ''}
            onChange={(e) => {
                if (disabled) return;
                const t = e.target.value.replace(/\r/g, '').replace(/\n/g, '');
                onChange(t);
            }}
            onBlur={(e) => {
                if (disabled) return;
                onChange(e.target.value.trim());
            }}
        />
    );
}
