import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import cn from 'classnames';
import styles from './productModal.module.css';
import { Product, StockData } from '@/app/interfaces/product.interface';
import { TypeDocumentByComeOut, DocumentType, documentsWithOwnPrice } from '@/app/interfaces/document.interface';
import { numberValue, formatNumberForDisplay, roundToTwoDecimals } from '@/app/service/common/converters';
import { getPereodicValueForDate } from '@/app/service/references/getPereodicValueForDate';
import {
  cleanNumericInput,
  isPartialNumericValid,
  parseDecimalInput,
  formatQuantityText,
  roundToFractionDigits,
  type DecimalFractionDigits,
} from '@/app/service/common/decimalInput';

interface ProductModalProps {
  isOpen: boolean;
  product: Product | null;
  stockData?: StockData;
  onClose: () => void;
  onAddToOrder: (product: Product, quantity: number, price?: number) => void;
  typeDocumentByComeOut: TypeDocumentByComeOut;
  documentType?: string;
  documentDate?: number;
  token?: string;
  enterpriseId?: number | null;
  allowNegativeStock?: boolean; // Разрешить ввод количества даже при нулевом/отрицательном остатке
  catalogMode?: 'add' | 'replace' | 'pick';
  /** Точность количества: 2 (документы) или 3 (нормы материалов) */
  quantityFractionDigits?: DecimalFractionDigits;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  product,
  stockData,
  onClose,
  onAddToOrder,
  typeDocumentByComeOut,
  documentType,
  documentDate,
  token,
  enterpriseId,
  allowNegativeStock = false,
  catalogMode = 'add',
  quantityFractionDigits = 2,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [quantityText, setQuantityText] = useState<string>('1');
  const [isBoxMode, setIsBoxMode] = useState<boolean>(false);
  const [boxCount, setBoxCount] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [priceText, setPriceText] = useState<string>('0');

  const quantityRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const isTemplate = documentType === 'OTHER';
  const shouldShowPriceInput = Boolean(documentType && documentsWithOwnPrice.includes(documentType));
  const showPriceField = shouldShowPriceInput && !isTemplate;

  // Сброс количества и цены при открытии модала
  useEffect(() => {
    if (!isOpen) return;

    setQuantity(1);
    setQuantityText('1');
    setBoxCount(1);
    setIsBoxMode(false);

    let cancelled = false;

    const loadInitialPrice = async () => {
      let initialPrice = 0;

      if (
        shouldShowPriceInput &&
        (documentType === DocumentType.SaleTovar ||
          documentType === DocumentType.SaleTools) &&
        product?.id
      ) {
        const periodic = await getPereodicValueForDate(
          product.id,
          'firstPrice',
          documentDate ?? Date.now(),
          token,
          enterpriseId,
        );
        initialPrice =
          periodic > 0
            ? periodic
            : product.refValues?.firstPrice || product.price || 0;
      } else if (shouldShowPriceInput) {
        initialPrice = product?.refValues?.firstPrice || product?.price || 0;
      } else if (stockData && stockData.totalQuantity > 0) {
        initialPrice = stockData.totalSum / stockData.totalQuantity;
      } else {
        initialPrice = product?.refValues?.firstPrice || product?.price || 0;
      }

      if (cancelled) return;

      const roundedPrice = roundToTwoDecimals(initialPrice);
      setCustomPrice(roundedPrice);
      setPriceText(formatQuantityText(roundedPrice, false));
    };

    void loadInitialPrice();

    return () => {
      cancelled = true;
    };
  }, [isOpen, product, shouldShowPriceInput, stockData, documentType, documentDate, token, enterpriseId]);

  // Синхронизация количества и коробок
  useEffect(() => {
    const countInBox = product?.refValues?.countInBox || 1;
    if (isBoxMode) {
      setQuantity(boxCount * countInBox);
    } else {
      setBoxCount(Math.ceil(quantity / countInBox));
    }
  }, [isBoxMode, boxCount, quantity, product?.refValues?.countInBox]);

  useEffect(() => {
    if (!isOpen || !product) return;
    const frameId = requestAnimationFrame(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    });
    return () => cancelAnimationFrame(frameId);
  }, [isOpen, product?.id]);

  // Закрытие по ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const isQuantityAllowed = useCallback((value: number) => {
    if (value < 0) return false;
    if (isTemplate || allowNegativeStock) return true;
    if (typeDocumentByComeOut === 'come') return true;
    const maxAvailable = stockData?.availableQuantity ?? 999;
    if (isBoxMode) {
      const countInBox = product?.refValues?.countInBox || 1;
      return value * countInBox <= maxAvailable;
    }
    return value <= maxAvailable;
  }, [isTemplate, allowNegativeStock, typeDocumentByComeOut, stockData?.availableQuantity, isBoxMode, product?.refValues?.countInBox]);

  const applyQuantityValue = useCallback((rawValue: number) => {
    let value = isBoxMode ? Math.floor(rawValue) : roundToFractionDigits(rawValue, quantityFractionDigits);
    if (value < 0) value = 0;

    if (!isQuantityAllowed(value)) {
      const maxAvailable = stockData?.availableQuantity ?? 999;
      if (isBoxMode) {
        const countInBox = product?.refValues?.countInBox || 1;
        value = Math.floor(maxAvailable / countInBox);
      } else {
        value = roundToFractionDigits(maxAvailable, quantityFractionDigits);
      }
    }

    if (isBoxMode) {
      setBoxCount(value);
      setQuantityText(formatQuantityText(value, true, quantityFractionDigits));
    } else {
      setQuantity(value);
      setQuantityText(formatQuantityText(value, false, quantityFractionDigits));
    }
  }, [isBoxMode, isQuantityAllowed, stockData?.availableQuantity, product?.refValues?.countInBox, quantityFractionDigits]);

  const commitQuantityInput = useCallback(() => {
    const parsed = isBoxMode
      ? Math.floor(Number(cleanNumericInput(quantityText)) || 0)
      : (parseDecimalInput(quantityText, quantityFractionDigits) ?? 0);
    applyQuantityValue(parsed);
  }, [isBoxMode, quantityText, applyQuantityValue, quantityFractionDigits]);

  const commitPriceInput = useCallback(() => {
    const parsed = parseDecimalInput(priceText) ?? 0;
    const normalized = Math.max(0, parsed);
    setCustomPrice(normalized);
    setPriceText(formatQuantityText(normalized, false));
  }, [priceText]);

  const handleQuantityInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!isPartialNumericValid(raw, isBoxMode, isBoxMode ? undefined : quantityFractionDigits)) return;
    setQuantityText(raw);

    if (isBoxMode) {
      const boxes = Math.floor(Number(cleanNumericInput(raw)) || 0);
      const countInBox = product?.refValues?.countInBox || 1;
      setBoxCount(boxes);
      setQuantity(roundToFractionDigits(boxes * countInBox, quantityFractionDigits));
      return;
    }

    const parsed = parseDecimalInput(raw, quantityFractionDigits);
    if (parsed !== null) {
      setQuantity(parsed);
    }
  }, [isBoxMode, product?.refValues?.countInBox, quantityFractionDigits]);

  const handlePriceInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!isPartialNumericValid(raw, false)) return;
    setPriceText(raw);
    const parsed = parseDecimalInput(raw);
    if (parsed !== null) {
      setCustomPrice(Math.max(0, parsed));
    }
  }, []);

  const focusAddButton = useCallback(() => {
    addButtonRef.current?.focus();
  }, []);

  const focusPriceField = useCallback(() => {
    priceRef.current?.focus();
    priceRef.current?.select();
  }, []);

  const handleQuantityKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    commitQuantityInput();
    if (showPriceField) {
      focusPriceField();
    } else {
      focusAddButton();
    }
  }, [commitQuantityInput, showPriceField, focusPriceField, focusAddButton]);

  const handlePriceKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    commitPriceInput();
    focusAddButton();
  }, [commitPriceInput, focusAddButton]);

  const handleAddToOrder = useCallback(() => {
    if (!product) return;

    let finalQuantity: number;
    if (isBoxMode) {
      const boxes = Math.floor(Number(cleanNumericInput(quantityText)) || 0);
      finalQuantity = roundToFractionDigits(boxes * (product?.refValues?.countInBox || 1), quantityFractionDigits);
    } else {
      finalQuantity = parseDecimalInput(quantityText, quantityFractionDigits) ?? 0;
    }

    const finalPrice = Math.max(0, parseDecimalInput(priceText) ?? customPrice);
    const priceRequired = Boolean(shouldShowPriceInput && !isTemplate);

    const blocked = isTemplate || allowNegativeStock
      ? finalQuantity <= 0 || (priceRequired && finalPrice <= 0)
      : finalQuantity <= 0 ||
        (priceRequired && finalPrice <= 0) ||
        (typeDocumentByComeOut === 'out' && stockData && finalQuantity > stockData.availableQuantity);

    if (blocked) return;

    onAddToOrder(product, finalQuantity, finalPrice);
    onClose();
  }, [
    product,
    isBoxMode,
    quantityText,
    priceText,
    customPrice,
    shouldShowPriceInput,
    isTemplate,
    allowNegativeStock,
    typeDocumentByComeOut,
    stockData,
    onAddToOrder,
    onClose,
    quantityFractionDigits,
  ]);

  const increaseQuantity = useCallback(() => {
    if (isBoxMode) {
      const newBoxCount = boxCount + 1;
      if (isQuantityAllowed(newBoxCount)) {
        setBoxCount(newBoxCount);
        setQuantityText(formatQuantityText(newBoxCount, true));
      }
    } else {
      const newQuantity = roundToFractionDigits(quantity + 1, quantityFractionDigits);
      if (isQuantityAllowed(newQuantity)) {
        setQuantity(newQuantity);
        setQuantityText(formatQuantityText(newQuantity, false, quantityFractionDigits));
      }
    }
  }, [isBoxMode, boxCount, quantity, isQuantityAllowed, quantityFractionDigits]);

  const decreaseQuantity = useCallback(() => {
    if (isBoxMode) {
      if (boxCount > 1) {
        const newBoxCount = boxCount - 1;
        setBoxCount(newBoxCount);
        setQuantityText(formatQuantityText(newBoxCount, true));
      }
    } else if (quantity > 1) {
      const newQuantity = roundToFractionDigits(quantity - 1, quantityFractionDigits);
      setQuantity(newQuantity);
      setQuantityText(formatQuantityText(newQuantity, false, quantityFractionDigits));
    }
  }, [isBoxMode, boxCount, quantity, quantityFractionDigits]);

  const priceRequired = Boolean(shouldShowPriceInput && !isTemplate);
  const isButtonDisabled = isTemplate || allowNegativeStock
    ? quantity <= 0 || (priceRequired && customPrice <= 0)
    : quantity <= 0 ||
      (priceRequired && customPrice <= 0) ||
      (typeDocumentByComeOut === 'out' && stockData && quantity > stockData.availableQuantity);

  const handleAddButtonKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || isButtonDisabled) return;
    e.preventDefault();
    handleAddToOrder();
  }, [handleAddToOrder, isButtonDisabled]);

  if (!isOpen || !product) {
    return null;
  }

  const imageUrl = product.refValues?.imagePath 
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/image/${product.refValues.imagePath}`
    : null;

  const price = product.refValues?.firstPrice || 0;
  const displayPrice = shouldShowPriceInput ? customPrice : price;
  const totalPrice = displayPrice * quantity;

  const modalContent = (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Кнопка закрытия */}
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>

        <div className={styles.modalContent}>
          {/* Изображение товара */}
          <div className={styles.imageSection}>
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={product.name}
                className={styles.productImage}
              />
            ) : (
              <div className={styles.imagePlaceholder}>
                📦
              </div>
            )}
          </div>

          {/* Информация о товаре */}
          <div className={styles.infoSection}>
            <div className={styles.productHeader}>
              <h2 className={styles.productName}>{product.name}</h2>
              <div className={styles.productMeta}>
                <span>
                  Артикул: <strong>{product.article?.trim() || '—'}</strong>
                </span>
                <span>
                  Ед. изм.: <strong>{product.refValues?.unit?.trim() || 'шт'}</strong>
                </span>
              </div>
              {product.comment && (
                <p className={styles.productDescription}>{product.comment}</p>
              )}
            </div>

            {/* Цена - скрываем для шаблонов */}
            {!isTemplate && (
              <div className={styles.priceSection}>
                <span className={styles.price}>
                  {numberValue(displayPrice)} сум
                </span>
                {/* {quantity > 1 && (
                  <span className={styles.totalPrice}>
                    Итого: {totalPrice.toLocaleString('ru-RU')} сум
                  </span>
                )} */}
              </div>
            )}

            {/* Информация о наличии - скрываем для шаблонов */}
            {!isTemplate && stockData && (
              <div className={styles.stockInfo}>
                <div className={styles.stockItem}>
                  <span className={styles.stockLabel}>Колдикда:</span>
                  <div className={styles.stockValue}>
                    <span className={styles.stockValueQuantity}>
                      {numberValue(stockData.availableQuantity)} {product.refValues?.unit || 'шт'} &nbsp;
                    </span>
                    <span className={styles.stockValueSum}>
                      {numberValue(stockData.availableSum)} сум
                    </span>
                  </div>
                </div>
                
                {product.refValues?.countInBox && (
                  <div className={styles.stockItem}>
                    <span className={styles.stockLabel}>В коробке:</span>
                    <span className={styles.stockValue}>
                       {formatNumberForDisplay(product.refValues.countInBox)} {product.refValues?.unit || 'шт'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Переключатель режима ввода */}
            {product.refValues?.countInBox && (
              <div className={styles.modeSwitch}>
                <button 
                  className={cn(styles.modeSwitchButton, { [styles.active]: !isBoxMode })}
                  onClick={() => {
                    setIsBoxMode(false);
                    setQuantityText(formatQuantityText(quantity, false, quantityFractionDigits));
                  }}
                >
                  По {product.refValues?.unit || 'шт'}
                </button>
                <button 
                  className={cn(styles.modeSwitchButton, { [styles.active]: isBoxMode })}
                  onClick={() => {
                    setIsBoxMode(true);
                    setQuantityText(formatQuantityText(boxCount, true, quantityFractionDigits));
                  }}
                >
                  По коробкам
                </button>
              </div>
            )}

            {/* Количество и цена в одной секции */}
            <div className={styles.quantityAndPriceSection}>
              {/* Количество */}
              <div className={styles.quantitySection}>
                <label className={styles.quantityLabel}>
                  {isBoxMode ? `Количество коробок (по ${product.refValues?.countInBox || 1} ${product.refValues?.unit || 'шт'}):` : 'Количество:'}
                </label>
                <div className={styles.quantityControls}>
                  <button 
                    className={styles.quantityButton}
                    onClick={decreaseQuantity}
                    disabled={isBoxMode ? boxCount <= 1 : quantity <= 1}
                    tabIndex={-1}
                  >
                    −
                  </button>
                  <input
                    ref={quantityRef}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={quantityText}
                    onChange={handleQuantityInputChange}
                    onBlur={commitQuantityInput}
                    onKeyDown={handleQuantityKeyDown}
                    className={styles.quantityInput}
                  />
                  <button 
                    className={styles.quantityButton}
                    onClick={increaseQuantity}
                    tabIndex={-1}
                    disabled={isTemplate || allowNegativeStock ? false : (typeDocumentByComeOut === 'come' ? false : (isBoxMode ? (boxCount * (product.refValues?.countInBox || 1)) >= (stockData?.availableQuantity || 999) : quantity >= (stockData?.availableQuantity || 999)))}
                  >
                    +
                  </button>
                </div>
                {isBoxMode && (
                  <div className={styles.quantityNote}>
                    Итого: {quantity.toFixed(2)} {product.refValues?.unit || 'шт'}
                  </div>
                )}
              </div>

              {/* Поле ввода цены - показывается только для определенных документов и не для шаблонов */}
              {showPriceField && (
                <div className={styles.priceInputSection}>
                  <label className={styles.priceInputLabel}>
                    Цена за единицу:
                  </label>
                  <div className={styles.priceInputContainer}>
                    <input
                      ref={priceRef}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={priceText}
                      onChange={handlePriceInputChange}
                      onBlur={commitPriceInput}
                      onKeyDown={handlePriceKeyDown}
                      className={styles.priceInput}
                      placeholder="Введите цену"
                    />
                    <span className={styles.priceInputSuffix}>сум</span>
                  </div>
                </div>
              )}
            </div>

            {/* Кнопка добавления в заказ */}
            <button
              ref={addButtonRef}
              className={cn(styles.addToOrderButton, {
                [styles.disabled]: isButtonDisabled
              })}
              onClick={() => {
                if (!isButtonDisabled) {
                  handleAddToOrder();
                }
              }}
              onKeyDown={handleAddButtonKeyDown}
              disabled={isButtonDisabled}
            >
              <span className={styles.buttonIcon}>🛒</span>
              {isTemplate ? 'Кушиш' : catalogMode === 'replace' ? 'Алмаштириш' : 'Жадвалга кушиш'}
              {!isTemplate && (
                <span className={styles.buttonPrice}>
                  {numberValue(totalPrice)} сум
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Рендерим модальное окно через портал в body для избежания проблем с z-index
  return createPortal(modalContent, document.body);
};

