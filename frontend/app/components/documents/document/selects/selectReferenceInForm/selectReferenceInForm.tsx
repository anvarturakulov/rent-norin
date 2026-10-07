import { SelectReferenceInFormProps } from './selectReferenceInForm.props';
import styles from './selectReferenceInForm.module.css';
import { useAppContext } from '@/app/context/app.context';
import cn from 'classnames';
import { useEffect, useState, useCallback, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { useSelectReferenceData } from './hooks/useSelectReferenceData';
import { useAutoSelectSingleOption } from './hooks/useAutoSelectSingleOption';
import { handleSelectChange } from './utils/changeHandlers';
import { getInitialValue, isDisabled } from './utils/initialValue';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { isInlineQuickAddBlocked } from '@/app/components/reference/inlineReferenceQuickAddGuard';
import { focusNextFocusable } from '@/app/utils/focusNextFocusable';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Product } from '@/app/interfaces/product.interface';
import { useProductCatalog } from '@/app/hooks/useProductCatalog';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { getStorageIdForDocument } from '@/app/service/documents/getStorageIdForDocument';
import { matchTmzNameSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';

const INLINE_CREATION_ALLOWED_TYPES: TypeReference[] = [
  TypeReference.PARTNERS,
  TypeReference.WORKERS,
  TypeReference.CHARGES,
  TypeReference.SERVICES,
  TypeReference.MEDIATORS,
  TypeReference.DELIVERERS,
];

const generateInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `inline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const formatReferenceDisplayName = (
  item: ReferenceModel,
  fieldType: string,
  fieldTypeReference: TypeReference,
): string => {
  if (fieldType === 'car' && item.refValues?.carModel) {
    return `${item.name} - ${item.refValues.carModel}`;
  }
  if (item.isFolder) {
    return `📁 ${item.name}`;
  }
  if (fieldTypeReference === TypeReference.STORAGES && item.refValues?.isMainWarehouse) {
    return `${item.name} (основной)`;
  }
  return item.name;
};

export const SelectReferenceInForm = ({ 
  label, 
  typeReference, 
  visibile = true, 
  definedItemId, 
  currentItemId, 
  type, 
  maydaSavdo, 
  className, 
  ...props 
}: SelectReferenceInFormProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { user } = mainData.users;
  const { contentName } = mainData.document;
  const { currentDocument, isNewDocument } = mainData.document;
  const token = user?.token;

  // Состояния для поиска
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState('');
  const [selectedItem, setSelectedItem] = useState<ReferenceModel | null>(null);
  /** -1 = «Танланмаган», 0..n-1 = строки filteredData */
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setSearchTerm('');
    setIsOpen(false);
    setHighlightIndex(-1);
  }, [typeReference, type]);

  // Используем кастомный хук для данных
  const { data, rawData, error, isLoading } = useSelectReferenceData({
    typeReference,
    type,
    contentName,
    mainData,
    token
  });

  // Фильтрация данных по поисковому запросу (+ AND, - OR, ! exclude — как в productCatalog)
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    return data.filter((item: ReferenceModel) => {
      const nameMatch = matchTmzNameSearch(item, searchTerm);
      const carModelMatch =
        type === 'car' && item.refValues?.carModel
          ? matchTmzNameSearch({ name: item.refValues.carModel }, searchTerm)
          : false;
      return nameMatch || carModelMatch;
    });
  }, [data, searchTerm, type]);

  // Обработчик выбора опции по умолчанию
  const handleDefaultOptionSelect = useCallback(() => {
    setSelected('Танланмаган');
    setSelectedItem(null);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
    
    // Создаем синтетическое событие для опции по умолчанию
    const syntheticEvent = {
      target: {
        value: 'Танланмаган',
        dataset: {
          type: null,
          id: null
        }
      }
    };
    
    handleSelectChange({
      e: syntheticEvent,
      setMainData,
      mainData,
      type,
      maydaSavdo,
      data: rawData || []
    });
  }, [setMainData, mainData, type, maydaSavdo, rawData]);

  useEffect(() => {
    const initialValue = getInitialValue({
      data: rawData || [],
      definedItemId,
      currentItemId,
      contentName,
      type,
      isNewDocument
    });
    
    // Находим выбранный элемент по ID, а не по имени
    const selectedRef = rawData?.find((item: ReferenceModel) => {
      if (isNewDocument) {
        return (item?.id === definedItemId || item?.id === currentItemId);
      } else {
        return item?.id === currentItemId;
      }
    });
    
    // Если выбранный элемент - папка, добавляем иконку
    let displayValue = initialValue;
    if (selectedRef) {
      displayValue = formatReferenceDisplayName(selectedRef, type, typeReference);
    } else if (selectedRef?.isFolder && initialValue !== 'Танланмаган') {
      displayValue = `📁 ${initialValue}`;
    }
    
    setSelected(displayValue);
    setSelectedItem(selectedRef || null);
  }, [rawData, currentItemId, definedItemId, contentName, type, typeReference, isNewDocument]);

  // Обработчик выбора элемента
  const handleItemSelect = useCallback((item: ReferenceModel) => {
    const displayValue = formatReferenceDisplayName(item, type, typeReference);
    
    setSelected(displayValue);
    setSelectedItem(item);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
    
    // Создаем синтетическое событие для совместимости с существующим кодом
    const syntheticEvent = {
      target: {
        value: item.name, // Сохраняем оригинальное имя для backend
        dataset: {
          type: item.typeReference,
          id: item.id?.toString()
        }
      }
    };
    
    handleSelectChange({
      e: syntheticEvent,
      setMainData,
      mainData,
      type,
      maydaSavdo,
      data: rawData || []
    });
  }, [setMainData, mainData, type, typeReference, maydaSavdo, rawData]);

  // Обработчик клика вне дропдауна
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target;
      if (
        dropdownRef.current &&
        target instanceof Node &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
        // Убираем фокус с input
        inputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Подсветка строки: при открытии — от выбранного значения; при смене фильтра — clamp
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      if (selectedItem === null || selected === 'Танланмаган') {
        setHighlightIndex(-1);
      } else {
        const idx = filteredData.findIndex((item: ReferenceModel) => item.id === selectedItem.id);
        setHighlightIndex(idx >= 0 ? idx : filteredData.length > 0 ? 0 : -1);
      }
      return;
    }

    setHighlightIndex((prev) => {
      const max = filteredData.length - 1;
      if (max < 0) return -1;
      return Math.min(Math.max(prev, -1), max);
    });
  }, [isOpen, filteredData, selectedItem, selected]);

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const el = dropdownRef.current.querySelector('[data-highlight-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen, filteredData]);

  // Обработчик клавиш
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
        return;
      }

      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) => {
          const max = filteredData.length - 1;
          if (max < 0) return -1;
          if (prev < max) return prev + 1;
          return max;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev > -1 ? prev - 1 : -1));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (highlightIndex === -1) {
          handleDefaultOptionSelect();
        } else if (highlightIndex >= 0 && highlightIndex < filteredData.length) {
          handleItemSelect(filteredData[highlightIndex]);
        }
        const inputEl = inputRef.current;
        const container = inputEl?.closest<HTMLElement>('[data-doc-form]');
        if (inputEl && container) {
          requestAnimationFrame(() => {
            focusNextFocusable(container, inputEl, { preferDocumentSaveInActionBar: true });
          });
        }
      }
    },
    [
      isOpen,
      filteredData,
      highlightIndex,
      handleItemSelect,
      handleDefaultOptionSelect
    ]
  );

  // Мемоизируем состояние disabled
  const disabled = useMemo(() => {
    return isDisabled(
      definedItemId,
      user?.role,
      currentDocument?.documentType,
      currentDocument?.docStatus
    ) || (
      currentDocument?.documentType === DocumentType.Advance &&
      currentDocument?.docValues?.advancePhase === 'ISSUED'
    );
  }, [definedItemId, user?.role, currentDocument?.documentType, currentDocument?.docStatus, currentDocument?.docValues?.advancePhase]);

  useAutoSelectSingleOption({
    type,
    data,
    currentItemId,
    definedItemId,
    disabled,
    isLoading,
    docStatus: currentDocument?.docStatus,
    handleItemSelect,
  });

  // Уникальный id экземпляра для координации inline-создания
  const instanceId = useMemo(() => generateInstanceId(), []);

  const canQuickAdd = useMemo(
    () => !disabled && INLINE_CREATION_ALLOWED_TYPES.includes(typeReference),
    [disabled, typeReference]
  );

  const canQuickEdit = useMemo(() => {
    if (!canQuickAdd) return false;
    const id = selectedItem?.id ?? currentItemId;
    return typeof id === 'number' && id > 0;
  }, [canQuickAdd, selectedItem?.id, currentItemId]);

  const showCatalogButton = useMemo(
    () =>
      !disabled &&
      type === 'analitic' &&
      contentName === DocumentType.ComeProduct,
    [disabled, type, contentName]
  );

  const handleOpenInlineCreate = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!setMainData) return;
      if (isInlineQuickAddBlocked()) return;
      // Сброс «зависшего» результата прошлого inline-сохранения, иначе другой селект может среагировать неверно
      setMainData('reference.lastCreatedForInline', null);
      setMainData('reference.inlineCreation', { typeReference, instanceId });
    },
    [setMainData, typeReference, instanceId]
  );

  const handleOpenInlineEdit = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!setMainData) return;
      if (isInlineQuickAddBlocked()) return;
      const referenceId = selectedItem?.id ?? currentItemId;
      if (typeof referenceId !== 'number' || referenceId <= 0) return;
      setMainData('reference.lastCreatedForInline', null);
      setMainData('reference.inlineCreation', {
        typeReference,
        instanceId,
        referenceId,
      });
    },
    [setMainData, typeReference, instanceId, selectedItem?.id, currentItemId]
  );

  const mainDataRef = useRef(mainData);
  mainDataRef.current = mainData;

  const handleCatalogProductSelected = useCallback(
    (product: Product, quantity: number) => {
      if (!setMainData) return;
      const doc = mainDataRef.current.document.currentDocument;
      if (!doc) return;

      const nextDocValues = {
        ...doc.docValues,
        analiticId: product.id,
        ...(quantity > 0 ? { count: quantity } : {}),
      };

      setMainData('currentDocument', {
        ...doc,
        docValues: nextDocValues,
      });

      setSelected(product.name);
      const fromData = (rawData || []).find((r: ReferenceModel) => r.id === product.id);
      setSelectedItem(
        fromData ||
          ({
            id: product.id,
            name: product.name,
            typeReference: TypeReference.TMZ,
          } as ReferenceModel)
      );
    },
    [setMainData, rawData]
  );

  const {
    isOpen: isCatalogOpen,
    openCatalog,
    closeCatalog,
    handleSelectProduct,
  } = useProductCatalog({
    onProductSelected: handleCatalogProductSelected,
    currentDocTableItems: [],
  });

  const catalogWarehouseId = useMemo(() => {
    if (!showCatalogButton || !currentDocument) return undefined;
    return getStorageIdForDocument(
      currentDocument.documentType as string,
      currentDocument.docValues?.senderId,
      currentDocument.docValues?.receiverId
    );
  }, [showCatalogButton, currentDocument]);

  const catalogEnterpriseId = useMemo(() => {
    if (!showCatalogButton) return undefined;
    return (
      currentDocument?.enterpriseId ??
      mainData.report?.selectedEnterpriseId ??
      user?.enterpriseId
    );
  }, [
    showCatalogButton,
    currentDocument?.enterpriseId,
    mainData.report?.selectedEnterpriseId,
    user?.enterpriseId,
  ]);

  // Авто-выбор созданного inline-элемента
  const lastCreatedForInline = mainData.reference?.lastCreatedForInline;
  useEffect(() => {
    if (!lastCreatedForInline) return;
    if (lastCreatedForInline.instanceId !== instanceId) return;

    const created = lastCreatedForInline.reference;
    if (!created || !created.id) {
      if (setMainData) setMainData('reference.lastCreatedForInline', null);
      return;
    }

    const syntheticEvent = {
      target: {
        value: created.name,
        dataset: {
          type: created.typeReference,
          id: String(created.id),
        },
      },
    };

    handleSelectChange({
      e: syntheticEvent,
      setMainData,
      mainData: mainDataRef.current,
      type,
      maydaSavdo,
      data: rawData || [],
    });

    let displayValue = created.name;
    if (created.isFolder) displayValue = `📁 ${created.name}`;
    setSelected(displayValue);
    setSelectedItem(created);

    if (setMainData) setMainData('reference.lastCreatedForInline', null);
  }, [lastCreatedForInline, instanceId, setMainData, type, maydaSavdo, rawData]);

  // Ранний возврат если не видимый
  if (!visibile) return <></>;

  // Состояния загрузки и ошибок
  if (isLoading) {
    return (
      <div className={styles.box}>
        {label !== '' && <div className={styles.label}>{label}</div>}
        <div className={styles.select}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.box}>
        {label !== '' && <div className={styles.label}>{label}</div>}
        <div className={styles.select}>Ошибка загрузки данных</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.box}>
        {label !== '' && <div className={styles.label}>{label}</div>}
        <div className={styles.selectRow}>
          <div className={styles.customSelectContainer} ref={dropdownRef}>
            <div
              className={cn(styles.customSelect, { [styles.disabled]: disabled })}
              onClick={() => {
                if (!disabled) {
                  setIsOpen(!isOpen);
                  if (!isOpen) {
                    // При открытии дропдауна фокусируемся на input
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 0);
                  }
                }
              }}
            >
              <input
                ref={inputRef}
                type="text"
                className={cn(styles.searchInput, {
                  [styles.defaultSelected]: selected === 'Танланмаган',
                })}
                placeholder={selected || 'Выберите элемент...'}
                value={isOpen ? searchTerm : selected}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                disabled={disabled}
                readOnly={!isOpen}
              />
              <div className={styles.arrow}>{isOpen ? '▲' : '▼'}</div>
            </div>

            {isOpen && (
              <div className={styles.dropdown}>
                <div className={styles.optionsList}>
                  {/* Опция по умолчанию */}
                  <div
                    data-highlight-active={highlightIndex === -1 ? true : undefined}
                    className={cn(styles.option, styles.defaultOption, {
                      [styles.selected]: selected === 'Танланмаган',
                      [styles.highlighted]: highlightIndex === -1,
                    })}
                    onClick={handleDefaultOptionSelect}
                  >
                    {'Танланмаган'}
                  </div>

                  {/* Опции данных */}
                  {filteredData.length === 0 ? (
                    <div className={styles.noResults}>Ничего не найдено</div>
                  ) : (
                    filteredData.map((item: ReferenceModel, index: number) => {
                      const displayText = formatReferenceDisplayName(item, type, typeReference);

                      return (
                        <div
                          key={item.id}
                          data-highlight-active={highlightIndex === index ? true : undefined}
                          className={cn(styles.option, {
                            [styles.selected]:
                              selected === displayText ||
                              (selected === item.name && item.isFolder),
                            [styles.highlighted]: highlightIndex === index,
                          })}
                          onClick={() => handleItemSelect(item)}
                        >
                          {displayText}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          {canQuickEdit && (
            <button
              type="button"
              className={styles.editButton}
              onClick={handleOpenInlineEdit}
              onMouseDown={(e) => e.preventDefault()}
              title="Танланганни таҳрирлаш"
              tabIndex={-1}
            >
              ✎
            </button>
          )}
          {canQuickAdd && (
            <button
              type="button"
              className={styles.plusButton}
              onClick={handleOpenInlineCreate}
              onMouseDown={(e) => e.preventDefault()}
              title="Янги элемент кушиш"
              tabIndex={-1}
            >
              +
            </button>
          )}
          {showCatalogButton && (
            <button
              type="button"
              className={styles.catalogButton}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openCatalog();
              }}
              onMouseDown={(e) => e.preventDefault()}
              title="Каталогни очиш"
              aria-label="Каталогни очиш"
              tabIndex={-1}
            >
              <Squares2X2Icon className={styles.catalogButtonIcon} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {showCatalogButton && (
        <ProductCatalog
          isOpen={isCatalogOpen}
          onClose={closeCatalog}
          onSelectProduct={handleSelectProduct}
          typeDocumentByComeOut="come"
          documentType={DocumentType.ComeProduct}
          documentDate={currentDocument?.date ?? Date.now()}
          referenceEnterpriseId={catalogEnterpriseId}
          warehouseId={catalogWarehouseId}
          catalogMode="pick"
        />
      )}
    </>
  );
};
