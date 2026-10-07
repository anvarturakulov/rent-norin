import React, { memo } from 'react';
import cn from 'classnames';
import styles from './Button.module.css';

interface BtnOpenCatalogProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const BtnOpenCatalog = memo<BtnOpenCatalogProps>(({
  onClick,
  className,
  disabled = false,
  children = 'Каталогни очиш'
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(styles.button, styles.primary, className)}
    >
      {children}
    </button>
  );
});

BtnOpenCatalog.displayName = 'BtnOpenCatalog';
