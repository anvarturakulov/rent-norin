import React, { memo } from 'react';
import cn from 'classnames';
import styles from './productCatalogNavigation.module.css';

interface FolderPathItem {
  id: number | null;
  name: string;
}

interface ProductCatalogNavigationProps {
  folderPath: FolderPathItem[];
  onNavigateToFolder: (folderId: number | null) => void;
  className?: string;
}

export const ProductCatalogNavigation = memo<ProductCatalogNavigationProps>(({
  folderPath,
  onNavigateToFolder,
  className
}) => {
  const canGoUp = folderPath.length > 1;
  
  const handleGoUp = () => {
    if (canGoUp) {
      const parentFolder = folderPath[folderPath.length - 2];
      onNavigateToFolder(parentFolder.id);
    }
  };

  return (
    <div className={cn(styles.navigation, className)}>
      {/* Кнопка "Вверх" */}
      <button
        className={cn(styles.upButton, { [styles.disabled]: !canGoUp })}
        onClick={handleGoUp}
        disabled={!canGoUp}
        title={canGoUp ? 'Перейти в родительскую папку' : 'Вы находитесь в корневой папке'}
      >
        ↑ Тепага
      </button>

      {/* Breadcrumbs - путь к текущей папке */}
      <div className={styles.breadcrumbs}>
        {folderPath.map((folder, index) => (
          <React.Fragment key={folder.id || 'root'}>
            {index > 0 && <span className={styles.separator}>→</span>}
            <button
              className={cn(styles.breadcrumbItem, {
                [styles.current]: index === folderPath.length - 1
              })}
              onClick={() => onNavigateToFolder(folder.id)}
              disabled={index === folderPath.length - 1}
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
});

ProductCatalogNavigation.displayName = 'ProductCatalogNavigation';
