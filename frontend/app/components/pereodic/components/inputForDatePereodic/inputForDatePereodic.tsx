'use client';

import { useCallback } from 'react';
import { InputForDatePereodicProps } from './inputForDatePereodic.props';
import styles from './inputForDatePereodic.module.css';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { adminAndHeadCompany } from '@/app/interfaces/user.interface';
import { useControlledDateInput } from '@/app/hooks/useControlledDateInput';
import { nowMs } from '@/app/utils/serverNow';

export const InputForDatePereodic = ({
  label,
  id,
  className,
  ...props
}: InputForDatePereodicProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { currentPereodic } = mainData.pereodic;
  const { user } = mainData.users;
  const role = user?.role;
  const isAdminOrHeadCompany = role && adminAndHeadCompany.includes(role);

  const dateDoc =
    currentPereodic && currentPereodic.date > 0 ? currentPereodic.date : nowMs();

  const onCommit = useCallback(
    (parsed: number) => {
      if (setMainData && id === 'date' && currentPereodic) {
        setMainData('currentPereodic', {
          ...currentPereodic,
          date: parsed,
        });
      }
    },
    [currentPereodic, id, setMainData],
  );

  const { inputRef, defaultValue, handleChange, handleBlur, min, max } =
    useControlledDateInput(dateDoc, onCommit);

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
        disabled={!isAdminOrHeadCompany}
        id={id}
        {...props}
        min={min}
        max={max}
      />
    </div>
  );
};
