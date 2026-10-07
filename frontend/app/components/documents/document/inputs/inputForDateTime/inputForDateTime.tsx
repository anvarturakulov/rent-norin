'use client';

import { useCallback, useEffect } from 'react';
import { InputForDateTimeProps } from './inputForDateTime.props';
import styles from './inputForDateTime.module.css';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { isReceiveToolsDocument } from '@/app/interfaces/document.interface';
import { useControlledDateTimeInput } from '@/app/hooks/useControlledDateTimeInput';
import { recalcReceiveToolsReturnTable } from '@/app/service/documents/receiveToolsRent';
import { nowMs } from '@/app/utils/serverNow';

export const InputForDateTime = ({
  label,
  id,
  className,
  ...props
}: InputForDateTimeProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;

  const committedMs =
    id === 'date'
      ? currentDocument.date > 0
        ? +currentDocument.date
        : nowMs()
      : (() => {
          const value = currentDocument.docValues[id];
          return value && value > 0 ? Number(value) : nowMs();
        })();

  const onCommit = useCallback(
    (parsed: number) => {
      if (!setMainData) return;

      if (id === 'date') {
        setMainData('currentDocument', {
          ...currentDocument,
          date: parsed,
        });
        return;
      }

      const previousReturnDateTime = Number(currentDocument.docValues?.returnDateTime) || 0;
      const docValues = {
        ...currentDocument.docValues,
        [id]: parsed,
      };

      const shouldRecalcReturnTable =
        id === 'returnDateTime' &&
        isReceiveToolsDocument(currentDocument.documentType) &&
        parsed !== previousReturnDateTime &&
        (currentDocument.docTableItems || []).some(
          (item) =>
            (!item.tableType || item.tableType === 'return') && Number(item.analiticId) > 0,
        );

      setMainData('currentDocument', {
        ...currentDocument,
        docValues,
        ...(shouldRecalcReturnTable
          ? {
              docTableItems: recalcReceiveToolsReturnTable(
                currentDocument.docTableItems,
                parsed,
              ),
            }
          : {}),
      });
    },
    [currentDocument, id, setMainData],
  );

  useEffect(() => {
    if (id === 'date') return;
    const stored = currentDocument.docValues[id];
    if (!stored || Number(stored) <= 0) {
      onCommit(nowMs());
    }
  }, [id, currentDocument.docValues, onCommit]);

  const {
    dateInputRef,
    timeInputRef,
    dateDefaultValue,
    timeDefaultValue,
    handleDateChange,
    handleTimeChange,
    handleDateBlur,
    handleTimeBlur,
    dateMin,
    dateMax,
  } = useControlledDateTimeInput(committedMs, onCommit);

  return (
    <div className={styles.box}>
      {label !== '' && <div className={styles.label}>{label}</div>}
      <div className={styles.row}>
        <input
          ref={dateInputRef}
          className={cn(className, styles.input, styles.inputDate)}
          onChange={handleDateChange}
          onBlur={handleDateBlur}
          type="date"
          defaultValue={dateDefaultValue}
          id={id}
          {...props}
          min={dateMin}
          max={dateMax}
        />
        <input
          ref={timeInputRef}
          className={cn(className, styles.input, styles.inputTime)}
          onChange={handleTimeChange}
          onBlur={handleTimeBlur}
          type="text"
          inputMode="numeric"
          placeholder="ЧЧ:ММ"
          maxLength={5}
          autoComplete="off"
          defaultValue={timeDefaultValue}
          aria-label={label ? `${label}, вақт` : 'Вақт'}
        />
      </div>
    </div>
  );
};
