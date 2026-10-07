'use client';

import React, { memo, useState } from 'react';
import cn from 'classnames';
import { Product } from '@/app/interfaces/product.interface';
import { TmzBalanceEntry } from './tmzMainWarehouseBalance.props';
import { numberValue } from '@/app/service/common/converters';
import { ImageModal } from '@/app/components/common/imageModal/ImageModal';
import IcoFolderPlus from '@/app/components/lists/referencesList/ico/folderPlus.svg';
import IcoFolderOpen from '@/app/components/lists/referencesList/ico/folderOpen.svg';
import catalogStyles from '@/app/components/productCatalog/productCatalog.module.css';
import reportStyles from './tmzMainWarehouseBalance.module.css';

interface TmzBalanceCatalogItemProps {
  product: Product;
  balance: TmzBalanceEntry | null;
  level: number;
  isFolder: boolean;
  hasChildren: boolean;
  isOpen: boolean;
  viewMode: 'list' | 'grid';
  onToggleFolder: () => void;
}

export const TmzBalanceCatalogItem = memo<TmzBalanceCatalogItemProps>(({
  product,
  balance,
  level,
  isFolder,
  hasChildren,
  isOpen,
  viewMode,
  onToggleFolder,
}) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const productImages = [
    product.refValues?.imagePath,
    product.refValues?.imagePath2,
    product.refValues?.imagePath3,
  ]
    .filter(Boolean)
    .map((p) => `${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/image/${p}`);

  const unitLabel = product.refValues?.unit?.trim() || 'шт';
  const qty = balance?.qty ?? 0;
  const sum = balance?.sum ?? 0;
  const price = qty !== 0 ? sum / qty : 0;

  const handleItemClick = () => {
    if (isFolder) onToggleFolder();
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (productImages.length > 0) setIsImageModalOpen(true);
  };

  const renderProductMeta = () => {
    if (isFolder) return null;
    const article = product.article?.trim();
    return (
      <div className={catalogStyles.itemMeta}>
        <span>Арт.: {article || '—'}</span>
        <span className={catalogStyles.itemMetaSep}>·</span>
        <span>Ед. изм.: {unitLabel}</span>
      </div>
    );
  };

  const renderBalanceInfo = (gridMode = false) => {
    if (isFolder) return null;
    return (
      <div
        className={cn(catalogStyles.stockInfo, {
          [reportStyles.balanceStockInfo]: gridMode,
        })}
      >
        <div className={catalogStyles.availableQuantity}>
          Колдик: <span>{numberValue(qty)} {unitLabel}</span>
        </div>
        <div className={catalogStyles.availableQuantity}>
          Сумма: <span>{numberValue(sum)} сум</span>
        </div>
        {qty !== 0 && (
          <div className={catalogStyles.availableQuantity}>
            Нарх: <span>{numberValue(price)} сум</span>
          </div>
        )}
      </div>
    );
  };

  const renderProductImage = () => {
    const imageUrl = productImages.length > 0 ? productImages[0] : null;
    return (
      <>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className={catalogStyles.productImage}
            onClick={handleImageClick}
            style={{ cursor: 'zoom-in' }}
            title={productImages.length > 1 ? `Клик для просмотра (${productImages.length} фото)` : 'Клик для увеличения'}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const placeholder = parent.querySelector('.placeholder') as HTMLElement;
                if (placeholder) placeholder.style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div
          className={cn(catalogStyles.imagePlaceholder, 'placeholder')}
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          {isFolder ? '📁' : '📦'}
        </div>
      </>
    );
  };

  if (viewMode === 'grid') {
    return (
      <>
        <div
          className={cn(catalogStyles.gridItem, reportStyles.balanceGridItem, {
            [catalogStyles.folderItem]: isFolder,
          })}
          onClick={handleItemClick}
        >
          <div className={catalogStyles.productImageContainer}>
            {isFolder ? (
              product.refValues?.imagePath ? renderProductImage() : (
                <div className={catalogStyles.imagePlaceholder}>📁</div>
              )
            ) : (
              renderProductImage()
            )}
          </div>
          <div className={cn(catalogStyles.itemContent, reportStyles.balanceGridItemContent)}>
            <div className={reportStyles.cardItemName}>{product.name}</div>
            {renderProductMeta()}
            {renderBalanceInfo(true)}
          </div>
        </div>
        {productImages.length > 0 && (
          <ImageModal
            isOpen={isImageModalOpen}
            images={productImages}
            imageName={product.name}
            onClose={() => setIsImageModalOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(catalogStyles.listItem, {
          [catalogStyles.folderItem]: isFolder,
        })}
        onClick={handleItemClick}
      >
        <div
          className={catalogStyles.productImageContainer}
          style={{ paddingLeft: `${level * 20}px` }}
        >
          {isFolder ? (
            product.refValues?.imagePath ? renderProductImage() : (
              <div className={catalogStyles.imagePlaceholder}>📁</div>
            )
          ) : (
            renderProductImage()
          )}
        </div>
        <div className={catalogStyles.itemName}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isFolder && (
              hasChildren ? (
                isOpen ? (
                  <IcoFolderOpen className={catalogStyles.folderOpenIcon} />
                ) : (
                  <IcoFolderPlus className={catalogStyles.folderPlusIcon} />
                )
              ) : (
                <IcoFolderPlus className={cn(catalogStyles.folderIcon, catalogStyles.noChildren)} />
              )
            )}
            <span>{product.name}</span>
          </div>
          {renderProductMeta()}
        </div>
        <div className={catalogStyles.itemComment}>
          {product.article?.trim() || '—'}
        </div>
        <div className={catalogStyles.price}>
          {isFolder ? (
            <span style={{ color: '#9ca3af' }}>—</span>
          ) : (
            <span>{qty !== 0 ? `${numberValue(price)} сум` : '—'}</span>
          )}
        </div>
        <div className={catalogStyles.stockInfo}>
          {isFolder ? (
            <span style={{ color: '#9ca3af' }}>—</span>
          ) : (
            renderBalanceInfo()
          )}
        </div>
      </div>
      {productImages.length > 0 && (
        <ImageModal
          isOpen={isImageModalOpen}
          images={productImages}
          imageName={product.name}
          onClose={() => setIsImageModalOpen(false)}
        />
      )}
    </>
  );
});

TmzBalanceCatalogItem.displayName = 'TmzBalanceCatalogItem';
