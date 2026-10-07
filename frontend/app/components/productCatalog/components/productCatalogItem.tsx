import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import cn from 'classnames';
import { Product, StockData } from '@/app/interfaces/product.interface';
import IcoFolderPlus from '../../lists/referencesList/ico/folderPlus.svg';
import IcoFolderOpen from '../../lists/referencesList/ico/folderOpen.svg';
import { ImageModal } from '../../common/imageModal/ImageModal';
import styles from '../productCatalog.module.css';
import { DocumentType, TypeDocumentByComeOut } from '@/app/interfaces/document.interface';
import { getDocumentTypeByComeOut } from '@/app/components/documents/document/docValues/components/helpers/getDocumentTypeByComeOut';
import { TypeTMZ } from '@/app/interfaces/reference.interface';
import { numberValue } from '@/app/service/common/converters';


interface ProductCatalogItemProps {
  product: Product;
  stockData: StockData | null;
  level: number;
  isFolder: boolean;
  hasChildren: boolean;
  isOpen: boolean;
  viewMode: 'list' | 'grid';
  onToggleFolder: () => void;
  onSelectProduct: (product: Product, quantity: number) => void;
  onOpenProductModal: (product: Product) => void;
  onDoubleClickProduct?: (product: Product) => void;
  onDuplicate?: (product: Product) => void;
  canDuplicate?: boolean;
  isConnected: boolean;
  typeDocumentByComeOut: TypeDocumentByComeOut; 
  documentType?: DocumentType | string; // Добавляем documentType для определения документов прихода
  allowNegativeStock?: boolean; // Разрешить выбор товаров даже при нулевом/отрицательном остатке
  catalogMode?: 'add' | 'replace' | 'pick';
  isFocused?: boolean;
} 

export const ProductCatalogItem = memo<ProductCatalogItemProps>(({
  product,
  stockData,
  level,
  isFolder,
  hasChildren,
  isOpen,
  viewMode,
  onToggleFolder,
  onSelectProduct,
  onOpenProductModal,
  onDoubleClickProduct,
  onDuplicate,
  canDuplicate = false,
  isConnected,
  typeDocumentByComeOut,
  documentType,
  allowNegativeStock = false,
  catalogMode = 'add',
  isFocused = false,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFocused || !itemRef.current) return;
    itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isFocused]);
  
  // Очистим все отладочные логи
  // const componentId = React.useMemo(() => `${product.id}-${Math.random().toString(36).substr(2, 9)}`, [product.id]);

  const handleItemClick = (e: React.MouseEvent) => {
    if (isFolder) {
      onToggleFolder();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isFolder) return;
    e.stopPropagation();
    if (catalogMode === 'pick') {
      onSelectProduct(product, 1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && canDuplicate && onDuplicate) {
      onDuplicate(product);
      return;
    }
    if (onDoubleClickProduct) onDoubleClickProduct(product);
  };

  const handleAddToCart = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Предотвращаем всплытие события
    
    if (isFolder) return;
    
    // Определяем, является ли документ документом прихода
    const isIncomeDocument = documentType && getDocumentTypeByComeOut(documentType as DocumentType) === 'come';
    
    // Теперь остатки получаются через REST API при выборе товара в productCatalogIntegration
    // Поэтому здесь просто вызываем onSelectProduct, остатки будут получены и проверены там
    if (quantity > 0) {
      onSelectProduct(product, quantity);
      setQuantity(1); // Сбрасываем количество после добавления
    }
  };

  const handleOpenProductModal = (e: React.MouseEvent) => {
    e.preventDefault(); // Предотвращаем действие по умолчанию
    e.stopPropagation(); // Предотвращаем всплытие события
    e.nativeEvent.stopImmediatePropagation(); // Останавливаем все обработчики событий
    
    console.log('🔵 ProductCatalogItem - открываем модальное окно:', {
      productName: product.name,
      productId: product.id,
      isFolder,
      documentType
    });
    
    if (!isFolder) {
      onOpenProductModal(product);
    }
  };



  const productImages = [
    product.refValues?.imagePath,
    product.refValues?.imagePath2,
    product.refValues?.imagePath3,
  ]
    .filter(Boolean)
    .map(p => `${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/image/${p}`);

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (productImages.length > 0) {
      setIsImageModalOpen(true);
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Предотвращаем всплытие события
    const inputValue = e.target.value;
    
    // Разрешаем пустое поле для промежуточного ввода
    if (inputValue === '') {
      setQuantity(0);
      return;
    }
    
    const value = Number(inputValue);
    // Проверяем, что это положительное число
    if (!isNaN(value) && value >= 0) {
      setQuantity(value);
    }
  };

  const unitLabel = product.refValues?.unit?.trim() || 'шт';

  const renderProductMeta = () => {
    if (isFolder) return null;
    const article = product.article?.trim();
    return (
      <div className={styles.itemMeta}>
        <span>Арт.: {article || '—'}</span>
        <span className={styles.itemMetaSep}>·</span>
        <span>Ед. изм.: {unitLabel}</span>
      </div>
    );
  };

  const renderStockInfo = () => {
    if (isFolder) return null;

    // УБРАНО: Проверка WebSocket соединения
    // Теперь остатки получаются через REST API при выборе товара
    // if (!isConnected) {
    //   return <div className={styles.stockInfo}>WebSocket отключен</div>;
    // }

    if (!stockData) {
      // Показываем индикатор загрузки для товаров (не папок)
      return (
        <div className={styles.stockInfo}>
          <span className={styles.loadingStock}>
            <span className={styles.loadingDot}>●</span>
            Колдик юкланмокда...
          </span>
        </div>
      );
    }

    return (
      <div className={styles.stockInfo}>
        <div className={styles.availableQuantity}>
          Колдик: <span>{numberValue(stockData.availableQuantity)} {unitLabel}</span>
        </div>
        <div className={styles.availableQuantity}>
          сумма:<span>{numberValue(stockData.availableSum)} сум</span>
        </div>
        
      </div>
    );
  };

  const renderPrice = () => {
    if (isFolder) return null;
    if (product.refValues?.typeTMZ != TypeTMZ.PRODUCT) return null;
    // Используем firstPrice из refValues как основную цену
    const price = product.refValues?.firstPrice || product.price || 0;
    
    // if (!price) return null;

    return (
      <div className={styles.price}>
        {numberValue(price)} сум
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
            className={styles.productImage}
            onClick={handleImageClick}
            style={{ cursor: 'zoom-in' }}
            title={productImages.length > 1 ? `Клик для просмотра (${productImages.length} фото)` : 'Клик для увеличения'}
            onError={(e) => {
              // Если изображение не загрузилось, показываем заглушку
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const placeholder = parent.querySelector('.placeholder') as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }
            }}
          />
        ) : null}
        <div className={cn(styles.imagePlaceholder, 'placeholder')} 
             style={{ display: imageUrl ? 'none' : 'flex' }}>
          {isFolder ? '📁' : '📦'}
        </div>
      </>
    );
  };

  const renderAddToCart = (typeDocumentByComeOut: TypeDocumentByComeOut) => {
    if (isFolder) return null;

    if (catalogMode === 'pick') {
      return (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectProduct(product, 1);
            }}
            className={styles.addToOrderButton}
          >
            Танлаш
          </button>
        </div>
      );
    }
    
    // Для шаблонов (OTHER) - всегда показываем кнопку "Танлаш"
    if (documentType === 'OTHER') {
      return (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%' }}
        >
          <button
            onClick={handleOpenProductModal}
            className={styles.addToOrderButton}
          >
            Танлаш
          </button>
        </div>
      );
    }
    
    // Определяем, является ли документ документом прихода
    const isIncomeDocument = documentType && getDocumentTypeByComeOut(documentType as DocumentType) === 'come';
    
    // Для документов прихода — всегда показываем кнопку
    if (isIncomeDocument) {
      const title = catalogMode === 'replace' ? 'Алмаштириш' : 'Киримга кушиш';
      return (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%' }}
        >
          <button
            onClick={handleOpenProductModal}
            className={styles.addToOrderButton}
          >
            {title}
          </button>
        </div>
      );
    }
    
    // Для документов расхода - показываем кнопку только если есть остаток
    // ИСКЛЮЧЕНИЕ: для LeaveMaterial (списание материалов) всегда показываем кнопку, так как это может быть шаблон норм
    // ИСКЛЮЧЕНИЕ: если allowNegativeStock = true, показываем кнопку даже при нулевом остатке
    if (typeDocumentByComeOut === 'out') {
      // Для LeaveMaterial всегда показываем кнопку (для шаблонов норм остатки не нужны)
      if (documentType === 'LeaveMaterial' || documentType === 'LeaveTools' || documentType === 'LeaveTovar') {
        return (
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%' }}
          >
            <button
              onClick={handleOpenProductModal}
              className={styles.addToOrderButton}
            >
              Танлаш
            </button>
          </div>
        );
      }
      
      // Если allowNegativeStock включен, показываем кнопку даже при нулевом/отрицательном остатке
      if (allowNegativeStock) {
        return (
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%' }}
          >
            <button
              onClick={handleOpenProductModal}
              className={styles.addToOrderButton}
            >
              Танлаш
            </button>
          </div>
        );
      }
      
      // Если остаток еще не загружен (null) - не показываем кнопку
      if (!stockData) {
        return null;
      }
      
      // Если остаток есть и он больше 0 - показываем кнопку
      if (stockData.availableQuantity > 0) {
        return (
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%' }}
          >
            <button
              onClick={handleOpenProductModal}
              className={styles.addToOrderButton}
            >
              Танлаш
            </button>
          </div>
        );
      }
      
      // Если остаток = 0 - не показываем кнопку
      return null;
    }
    
    // Для других случаев (не определен тип) - не показываем кнопку
    return null;
  };

  if (viewMode === 'grid') {
    return (
      <>
      <div 
        ref={itemRef}
        className={cn(styles.gridItem, {
          [styles.folderItem]: isFolder,
          [styles.focusedItem]: isFocused,
        })}
        onClick={handleItemClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Изображение занимает верхнюю часть для всех элементов */}
        <div className={styles.productImageContainer}>
          {isFolder ? (
            // Для папок показываем изображение или иконку папки
            product.refValues?.imagePath ? (
              renderProductImage()
            ) : (
              <div className={styles.imagePlaceholder}>
                📁
              </div>
            )
          ) : (
            // Для товаров как обычно
            renderProductImage()
          )}
        </div>
        
        <div className={styles.itemContent}>
          <div className={styles.itemName}>{product.name}</div>
          {renderProductMeta()}
          {renderPrice()}
          {renderStockInfo()}
          
          
          {product.comment && (
            <p className={styles.itemComment}>{product.comment}</p>
          )}
          
          <div className={styles.addToCart}>
            {renderAddToCart(typeDocumentByComeOut)} {/* Добавляем кнопку добавления в корзину */}     
          </div>
        </div>
      </div>
      
      {/* Модальное окно для просмотра изображения */}
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

  // List view с отступами и правильными иконками папок
  return (
    <>
    <div 
      ref={itemRef}
      className={cn(styles.listItem, {
        [styles.folderItem]: isFolder,
        [styles.focusedItem]: isFocused,
      })}
      onClick={handleItemClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Изображение в первой колонке с отступом для иерархии */}
      <div className={styles.productImageContainer} style={{ paddingLeft: `${level * 20}px` }}>
        {isFolder ? (
          // Для папок показываем изображение или иконку папки
          product.refValues?.imagePath ? (
            renderProductImage()
          ) : (
            <div className={styles.imagePlaceholder}>
              📁
            </div>
          )
        ) : (
          // Для товаров как обычно
          renderProductImage()
        )}
      </div>
      
      {/* Название */}
      <div className={styles.itemName}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isFolder && (
            hasChildren ? (
              isOpen ? (
                <IcoFolderOpen className={styles.folderOpenIcon} />
              ) : (
                <IcoFolderPlus className={styles.folderPlusIcon} />
              )
            ) : (
              <IcoFolderPlus className={cn(styles.folderIcon, styles.noChildren)} />
            )
          )}
          <span>{product.name}</span>
        </div>
        {renderProductMeta()}
      </div>
      
      <div className={styles.itemComment}>
        {product.comment || product.refValues?.comment || ''}
      </div>
      
      <div className={styles.price}>
        {renderPrice() || <span style={{ color: '#9ca3af' }}>—</span>}
      </div>
      
      <div className={styles.stockInfo}>
        {renderStockInfo() || <span style={{ color: '#9ca3af' }}>—</span>}
      </div>
      
      <div className={styles.addToCart}>
        {renderAddToCart(typeDocumentByComeOut)} {/* Добавляем кнопку добавления в корзину */}     
      </div>
      
    </div>
    
    {/* Модальное окно для просмотра изображения */}
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

ProductCatalogItem.displayName = 'ProductCatalogItem';