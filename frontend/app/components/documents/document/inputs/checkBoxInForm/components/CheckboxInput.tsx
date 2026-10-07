import React, { memo } from 'react';
import cn from 'classnames';
import styles from '../checkBoxInForm.module.css';

interface CheckboxInputProps {
  className?: string;
  id: string;
  label: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  [key: string]: any; // Для остальных пропсов
}

const CheckboxInput = memo<CheckboxInputProps>(({
  className,
  id,
  label,
  checked,
  onChange,
  ...props
}) => {
  return (
    <div className={styles.box}>
      <input
        className={cn(className, styles.input)}
        onChange={onChange}
        type='checkbox'
        checked={checked}
        id={id}
        {...props}
      />
      {label !== '' && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
    </div>
  );
});

CheckboxInput.displayName = 'CheckboxInput';

export default CheckboxInput; 