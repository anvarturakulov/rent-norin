import React, { memo, useState, useCallback } from 'react';
import cn from 'classnames';
import { DocTableItem } from '@/app/interfaces/document.interface';
import styles from '../inputInTable.module.css';
import { formatNumberForDisplay, numberValue } from '@/app/service/common/converters';
import {
  isPartialDecimalValid,
  parseDecimalInput,
  formatDecimalInput,
  cleanNumericInput,
} from '@/app/service/common/decimalInput';

const TRIAD_FORMAT_CONTROLS: (keyof DocTableItem)[] = ['price', 'total'];
const DECIMAL_CONTROLS: (keyof DocTableItem)[] = ['count', 'countByBox'];
const NUMERIC_CONTROLS_WITH_SPACE_STRIP: (keyof DocTableItem)[] = ['count', 'price', 'total', 'countByBox'];

interface TableInputProps {
  className?: string;
  nameControl: keyof DocTableItem;
  itemIndexInTable: number;
  currentValue: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  [key: string]: any;
}

const TableInput = memo<TableInputProps>(({
  className,
  nameControl,
  itemIndexInTable,
  currentValue,
  onChange,
  type: typeProp,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    const cleanValue = NUMERIC_CONTROLS_WITH_SPACE_STRIP.includes(nameControl)
      ? value.replace(/\s/g, '')
      : value;

    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: cleanValue
      },
      currentTarget: {
        ...e.currentTarget,
        value: cleanValue
      }
    } as React.ChangeEvent<HTMLInputElement>;

    onChange(syntheticEvent);
  };

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
      if (!Number.isNaN(num)) return formatNumberForDisplay(num);
      return String(currentValue);
    }

    if (isTriadFormatControl) {
      if (isFocused) {
        return currentValue ?? '';
      }
      if (currentValue === '' || currentValue === null || currentValue === undefined) {
        return '';
      }
      const num = Number(currentValue);
      if (!Number.isNaN(num)) {
        return numberValue(num);
      }
      return currentValue || '';
    }

    return currentValue ?? '';
  };

  const getInputType = () => {
    if (isDecimalControl) return 'text';
    if (isTriadFormatControl) {
      return isFocused ? 'number' : 'text';
    }
    return typeProp ?? 'text';
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
        className={cn(className, styles.input)}
        onChange={isDecimalControl ? handleDecimalChange : handleInputChange}
        onFocus={isDecimalControl ? handleDecimalFocus : () => setIsFocused(true)}
        onBlur={isDecimalControl ? handleDecimalBlur : () => setIsFocused(false)}
        onWheel={handleWheel}
        value={getDisplayValue()}
        type={getInputType()}
        inputMode={getInputMode()}
      />
    </div>
  );
});

TableInput.displayName = 'TableInput';

export default TableInput;
