import React, { memo } from 'react';
import cn from 'classnames';
import styles from '../productCatalog.module.css';

interface ProductCatalogHeaderProps {
  onClose: () => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  onCreateNewProduct?: () => void;
  catalogMode?: 'add' | 'replace' | 'pick';
}

export const ProductCatalogHeader = memo<ProductCatalogHeaderProps>(({
  onClose,
  viewMode,
  onViewModeChange,
  onCreateNewProduct,
  catalogMode = 'add',
}) => {
  const title =
    catalogMode === 'replace'
      ? 'Номенклатурани алмаштириш / тахрирлаш'
      : catalogMode === 'pick'
        ? 'ТМЗ танлаш'
        : 'Товарлар каталоги';

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <h2 className={styles.title}>{title}</h2>
      </div>
      
      <div className={styles.headerRight}>
        {onCreateNewProduct && (
          <button
            type="button"
            onClick={onCreateNewProduct}
            className={styles.addButton}
            title="Янги"
          >
            +
          </button>
        )}
        <div className={styles.viewModeToggle}>
          <button
            className={cn(styles.viewModeButton, {
              [styles.active]: viewMode === 'grid'
            })}
            onClick={() => onViewModeChange('grid')}
          >
            Жадвал
          </button>
          <button
            className={cn(styles.viewModeButton, {
              [styles.active]: viewMode === 'list'
            })}
            onClick={() => onViewModeChange('list')}
          >
            Руйхат
          </button>
        </div>
        
        <button onClick={onClose} className={styles.closeButton}>
          ✕
        </button>
      </div>
    </div>
  );
});

ProductCatalogHeader.displayName = 'ProductCatalogHeader';
