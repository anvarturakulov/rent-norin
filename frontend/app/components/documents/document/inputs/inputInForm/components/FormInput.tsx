import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import cn from 'classnames';
import styles from '../inputInForm.module.css';
import { NUMERIC_CONTROLS } from '../constants/inputForm.constants';
import {
  cleanNumericInput,
  formatPartialNumberWithTriads,
  countSignificantNumericChars,
  caretPosAfterTriadFormat,
} from '@/app/service/common/decimalInput';

interface FormInputProps {
  className?: string;
  label: string;
  nameControl: string;
  currentValue: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  visible?: boolean;
  labelPosition?: 'left' | 'top';
  [key: string]: any; // Для остальных пропсов
}

function cleanNumber(str: string): string {
  // Удаляем все типы пробелов, затем нормализуем десятичный разделитель
  return cleanNumericInput(
    str.replace(/[\s\u00A0\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, ''),
  );
}

function withCleanedValue(
  e: React.ChangeEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>,
  cleanValue: string,
): React.ChangeEvent<HTMLInputElement> {
  const valueHolder = { value: cleanValue };
  return {
    ...e,
    target: valueHolder as HTMLInputElement,
    currentTarget: valueHolder as HTMLInputElement,
  } as React.ChangeEvent<HTMLInputElement>;
}

const FormInput = memo<FormInputProps>(({
  className,
  label,
  nameControl,
  currentValue,
  onChange,
  visible = true,
  labelPosition,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  // Проверяем, является ли поле числовым
  const isNumericField = NUMERIC_CONTROLS.includes(nameControl as any);

  // Функция форматирования числа с разделением триады
  const formatNumber = (num: number): string => {
    if (isNaN(num)) return '';
    // Используем обычный пробел вместо неразрывного
    return num.toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
  };

  // Restore caret after React re-renders formatted value
  useEffect(() => {
    if (pendingCaretRef.current === null || !inputRef.current) return;
    const pos = pendingCaretRef.current;
    pendingCaretRef.current = null;
    inputRef.current.setSelectionRange(pos, pos);
  }, [displayValue]);

  // Инициализация при изменении внешнего значения
  useEffect(() => {
    if (isNumericField && currentValue !== undefined && currentValue !== null && !isFocused) {
      const numValue = parseFloat(currentValue.toString());

      if (!isNaN(numValue)) {
        // Отображаем все числа включая отрицательные и ноль
        const formatted = formatNumber(numValue);
        setDisplayValue(formatted);
      } else {
        setDisplayValue('');
      }
    } else if (currentValue === null || currentValue === undefined) {
      setDisplayValue('');
    } else if (!isNumericField) {
      // Для текстовых полей просто отображаем значение как есть
      const textValue = currentValue.toString() || '';
      setDisplayValue(textValue);
    }
  }, [currentValue, isFocused, isNumericField, nameControl]);

  // Обработчик изменения значения
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (isNumericField) {
      // Если поле пустое, разрешаем
      if (inputValue === '') {
        setDisplayValue('');
        onChange(withCleanedValue(e, ''));
        return;
      }

      // Очищаем от форматирования для проверки
      const cleanValue = cleanNumber(inputValue);

      // Проверяем, что это число (включая отрицательные и незавершённые формы)
      if (/^-?\d*\.?\d*$/.test(cleanValue)) {
        const caret = e.target.selectionStart ?? inputValue.length;
        const significantBefore = countSignificantNumericChars(inputValue.slice(0, caret));
        const formatted = formatPartialNumberWithTriads(cleanValue);
        pendingCaretRef.current = caretPosAfterTriadFormat(formatted, significantBefore);
        setDisplayValue(formatted);
        onChange(withCleanedValue(e, cleanValue));
      }
    } else {
      // Для нечисловых полей (например, comment)
      setDisplayValue(inputValue);
      onChange(e);
    }
  };

  // Обработчик потери фокуса
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (!isNumericField) return;

    const cleanValue = cleanNumber(displayValue);
    const numValue = parseFloat(cleanValue);

    if (!isNaN(numValue)) {
      setDisplayValue(formatNumber(numValue));
      onChange(withCleanedValue(e, String(numValue)));
    } else if (cleanValue === '' || cleanValue === '.' || cleanValue === '-') {
      setDisplayValue('');
      onChange(withCleanedValue(e, ''));
    } else {
      setDisplayValue('0');
      onChange(withCleanedValue(e, '0'));
    }
  }, [displayValue, isNumericField, onChange]);

  // Обработчик получения фокуса — триады оставляем (live-формат)
  const handleFocus = () => {
    setIsFocused(true);
  };

  if (!visible) return <></>;

  return (
    <div className={cn(className, styles.box, {
      [styles.boxWithLabel]: label !== '',
      [styles.labelTop]: labelPosition === 'top'
    })}>
      {label !== '' && <div className={styles.label}>{label}</div>}
      <input
        className={cn(className, styles.input, {
          [styles.comment]: nameControl === 'comment',
        })}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        value={displayValue || ''}
        inputMode={isNumericField ? "decimal" : "text"}
        {...props}
        ref={inputRef}
        type="text"
      />
    </div>
  );
});

FormInput.displayName = 'FormInput';

export default FormInput;
