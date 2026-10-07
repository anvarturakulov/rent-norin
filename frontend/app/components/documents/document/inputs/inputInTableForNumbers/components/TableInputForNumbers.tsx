import React, { memo, useState, useCallback } from 'react';
import cn from 'classnames';
import { DocTableItem } from '@/app/interfaces/document.interface';
import styles from '../inputInTableForNumbers.module.css';
import { numberValue } from '@/app/service/common/converters';
import {
  isPartialDecimalValid,
  parseDecimalInput,
  formatDecimalInput,
  cleanNumericInput,
} from '@/app/service/common/decimalInput';

const TRIAD_FORMAT_CONTROLS: (keyof DocTableItem)[] = ['price', 'total'];
const DECIMAL_CONTROLS: (keyof DocTableItem)[] = ['count', 'countByBox', 'rentHours'];

interface TableInputProps {
  className?: string;
  nameControl: keyof DocTableItem;
  itemIndexInTable: number;
  currentValue: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  [key: string]: any;
}

const TableInputForNumbers = memo<TableInputProps>(({
  className,
  nameControl,
  itemIndexInTable,
  currentValue,
  onChange,
  disabled,
  hasError,
  errorMessage,
  type: _typeProp,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [editText, setEditText] = useState('');
  const isTriadFormatControl = TRIAD_FORMAT_CONTROLS.includes(nameControl);
  const isDecimalControl = DECIMAL_CONTROLS.includes(nameControl);

  const getValueAsText = useCallback(() => {
    if (currentValue === '' || currentValue === null || currentValue === undefined) return '';
    if (typeof currentValue === 'number') return formatDecimalInput(currentValue);
    return String(currentValue);
  }, [currentValue]);

  const fireChange = useCallback((value: string) => {
    const syntheticEvent = {
      target: { value },
      currentTarget: { value },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  }, [onChange]);

  const handleDecimalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!isPartialDecimalValid(raw)) return;
    setEditText(raw);

    if (raw === '') {
      fireChange('');
      return;
    }

    const parsed = parseDecimalInput(raw);
    if (parsed !== null) {
      fireChange(cleanNumericInput(raw));
    }
  }, [fireChange]);

  const handleDecimalBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseDecimalInput(editText);
    if (parsed !== null) {
      fireChange(String(parsed));
    } else if (editText === '') {
      fireChange('');
    }
  }, [editText, fireChange]);

  const handleDecimalFocus = useCallback(() => {
    setIsFocused(true);
    setEditText(getValueAsText());
  }, [getValueAsText]);

  const getDisplayValue = () => {
    if (isDecimalControl) {
      if (isFocused) return editText;
      if (currentValue === '' || currentValue === null || currentValue === undefined) return '';
      const num = Number(currentValue);
      if (!Number.isNaN(num)) return formatDecimalInput(num);
      return String(currentValue);
    }

    if (isTriadFormatControl && !isFocused) {
      if (currentValue === '' || currentValue === null || currentValue === undefined) {
        return '';
      }
      const num = Number(currentValue);
      if (!Number.isNaN(num)) {
        return numberValue(num);
      }
    }
    return currentValue ?? '';
  };

  const getInputType = () => {
    if (isDecimalControl) return 'text';
    if (isTriadFormatControl) {
      return isFocused ? 'number' : 'text';
    }
    return 'number';
  };

  const getInputMode = () => {
    if (isDecimalControl || isTriadFormatControl) return 'decimal';
    return undefined;
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.currentTarget as HTMLInputElement).blur();
  };

  return (
    <div className={styles.box}>
      <input
        {...props}
        className={cn(className, styles.input, hasError && styles.inputError)}
        value={getDisplayValue()}
        onChange={isDecimalControl ? handleDecimalChange : onChange}
        onFocus={isDecimalControl ? handleDecimalFocus : () => setIsFocused(true)}
        onBlur={isDecimalControl ? handleDecimalBlur : () => setIsFocused(false)}
        onWheel={handleWheel}
        type={getInputType()}
        inputMode={getInputMode()}
        disabled={disabled}
        title={hasError ? errorMessage : undefined}
      />
      {hasError && errorMessage && (
        <div className={styles.errorMessage} title={errorMessage}>
          ⚠️
        </div>
      )}
    </div>
  );
});

TableInputForNumbers.displayName = 'TableInputForNumbers';

export default TableInputForNumbers;
