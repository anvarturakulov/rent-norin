'use client';

import { useCallback } from 'react';
import { InputForDateProps } from './inputForDate.props';
import styles from './inputForDate.module.css';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { useControlledDateInput } from '@/app/hooks/useControlledDateInput';
import { nowMs } from '@/app/utils/serverNow';

export const InputForDate = ({ label, id, className, ...props }: InputForDateProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;

  const canEditDate = true;
  const dateDoc = currentDocument.date > 0 ? +currentDocument.date : nowMs();

  const onCommit = useCallback(
    (parsed: number) => {
      if (id === 'orderTakingDate' && parsed < nowMs()) {
        alert('Сана хато киритилди');
        return;
      }

      if (setMainData && id === 'date') {
        setMainData('currentDocument', {
          ...currentDocument,
          date: parsed,
        });
      }
    },
    [currentDocument, id, setMainData],
  );

  const { inputRef, defaultValue, handleChange, handleBlur, min, max } =
    useControlledDateInput(dateDoc, onCommit, { keepTime: true });

  return (
    <div className={styles.box}>
      {label !== '' && <div className={styles.label}>{label}</div>}
      <input
        ref={inputRef}
        className={cn(className, styles.input)}
        onChange={handleChange}
        onBlur={handleBlur}
        type="date"
        defaultValue={defaultValue}
        disabled={!canEditDate}
        id={id}
        {...props}
        min={min}
        max={max}
      />
    </div>
  );
};
