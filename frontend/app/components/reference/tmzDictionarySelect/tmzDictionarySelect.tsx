'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { showMessage } from '@/app/service/common/showMessage';
import { updateReferenceName } from '@/app/service/references/updateReferenceName';
import { isInlineQuickAddBlocked } from '@/app/components/reference/inlineReferenceQuickAddGuard';
import selectStyles from '@/app/components/documents/document/selects/selectReferenceInForm/selectReferenceInForm.module.css';
import { TmzDictionarySelectProps } from './tmzDictionarySelect.props';

/** Сколько опций рендерить в DOM — защита от freeze на больших словарях */
const VISIBLE_OPTIONS_LIMIT = 100;

const generateInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tmz-dict-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeTypeTmz = (value: unknown): string =>
  value == null ? '' : String(value).trim().toUpperCase();

const tmzShortNameMatchesType = (
  itemType: unknown,
  expectedType: unknown,
): boolean => {
  const expected = normalizeTypeTmz(expectedType);
  if (!expected) return true;
  const actual = normalizeTypeTmz(itemType);
  // Новый элемент из inline может прийти без typeTMZ в refValues — не отбрасываем.
  if (!actual) return true;
  return actual === expected;
};

const buildSlimByTypeUrl = (
  dictionaryType: TypeReference,
  enterpriseId?: number | null,
): string => {
  const base = `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${dictionaryType}`;
  const params = new URLSearchParams({ slim: '1' });
  if (enterpriseId != null) {
    params.set('enterpriseId', String(enterpriseId));
  }
  return `${base}?${params.toString()}`;
};

export const TmzDictionarySelect = ({
  attrField: _attrField,
  dictionaryType,
  label,
  valueId,
  valueText,
  enterpriseId,
  typeTMZ,
  disabled,
  className,
  showInlineCreateButton = true,
  onChange,
}: TmzDictionarySelectProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const token = mainData.users?.user?.token;
  const instanceId = useMemo(() => generateInstanceId(), []);

  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  const url = buildSlimByTypeUrl(dictionaryType, enterpriseId);

  // Для уже выбранного значения подгружаем словарь, чтобы работала кнопка ✎ без открытия списка.
  // На новой карточке (пусто) запросы стартуют только при первом открытии селекта.
  useEffect(() => {
    if (valueId != null || (valueText?.trim() ?? '') !== '') {
      setHasBeenOpened(true);
    }
  }, [valueId, valueText]);

  const { data, isLoading, error, mutate: mutateOptions } = useSWR(
    token && hasBeenOpened ? url : null,
    (u) => getDataForSwr(u, token),
  );

  const openSelect = useCallback(() => {
    if (disabled) return;
    setHasBeenOpened(true);
    setIsOpen(true);
  }, [disabled]);

  const options = useMemo(() => {
    if (!data?.length) return [];
    return (data as ReferenceModel[])
      .filter((item) => {
        if (item.isFolder || item.refValues?.markToDeleted) return false;
        if (
          dictionaryType === TypeReference.TMZ_SHORT_NAME &&
          typeTMZ != null &&
          !tmzShortNameMatchesType(item.refValues?.typeTMZ, typeTMZ)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }));
  }, [data, dictionaryType, typeTMZ]);

  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return options;
    return options.filter((item) => item.name.toLowerCase().includes(term));
  }, [options, searchTerm]);

  const visibleOptions = useMemo(
    () => filteredOptions.slice(0, VISIBLE_OPTIONS_LIMIT),
    [filteredOptions],
  );

  const hiddenOptionsCount = filteredOptions.length - visibleOptions.length;

  const selectedItem = useMemo(
    () => options.find((item) => item.id === valueId) ?? null,
    [options, valueId],
  );

  // Элемент справочника для редактирования: явная привязка (valueId) или подбор по тексту,
  // если у реквизита сохранён только текст без id (старые ТМЗ / готовая продукция).
  const editableElement = useMemo(() => {
    if (selectedItem) return selectedItem;
    const term = valueText?.trim().toLowerCase();
    if (!term) return null;
    return options.find((item) => (item.name ?? '').trim().toLowerCase() === term) ?? null;
  }, [selectedItem, valueText, options]);

  const displaySelected = useMemo(() => {
    if (selectedItem?.name) return selectedItem.name;
    if (valueText?.trim()) return valueText.trim();
    return 'Танланмаган';
  }, [selectedItem, valueText]);

  const handleSelect = useCallback(
    (item: ReferenceModel | null) => {
      if (item?.id) {
        onChange(item.id, item.name ?? '');
      } else {
        onChange(null, '');
      }
      setSearchTerm('');
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onChange],
  );

  const handleOpenInlineCreate = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!setMainData || disabled) return;
      if (isInlineQuickAddBlocked()) return;
      // Если этот селект уже находится внутри inline-формы (например, ТМЗ из productCatalog),
      // открываем атрибут во втором (вложенном) слоте, чтобы не размонтировать родительскую форму.
      const slotKey = mainData.reference?.inlineCreation
        ? 'reference.nestedInlineCreation'
        : 'reference.inlineCreation';
      setMainData('reference.lastCreatedForInline', null);
      setMainData(slotKey, {
        typeReference: dictionaryType,
        instanceId,
        defaultEnterpriseId: enterpriseId ?? null,
        defaultRefValues:
          dictionaryType === TypeReference.TMZ_SHORT_NAME && typeTMZ
            ? { typeTMZ }
            : undefined,
      });
    },
    [setMainData, disabled, dictionaryType, instanceId, enterpriseId, typeTMZ, mainData.reference?.inlineCreation],
  );

  const handleStartEdit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || !editableElement) return;
      setIsOpen(false);
      setEditName(editableElement.name ?? '');
      setIsEditing(true);
      requestAnimationFrame(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      });
    },
    [disabled, editableElement],
  );

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditName('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editableElement || isSaving) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      showMessage('Қийматни тулдиринг', 'error', setMainData);
      return;
    }
    if (trimmed === (editableElement.name ?? '').trim()) {
      handleCancelEdit();
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateReferenceName(editableElement, trimmed, dictionaryType, token);
      // Обновляем список этого селекта и все остальные списки справочников.
      await mutateOptions();
      globalMutate((key) => typeof key === 'string' && key.includes('/api/references/'), undefined, {
        revalidate: true,
      });
      // Прокидываем новое имя в реквизит ТМЗ — имя ТМЗ пересоберётся автоматически.
      onChange(updated?.id ?? editableElement.id ?? null, updated?.name ?? trimmed);
      setIsEditing(false);
      setEditName('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить справочник';
      showMessage(message, 'error', setMainData);
    } finally {
      setIsSaving(false);
    }
  }, [editableElement, isSaving, editName, dictionaryType, token, mutateOptions, onChange, setMainData, handleCancelEdit]);

  const lastCreatedForInline = mainData.reference?.lastCreatedForInline;
  useEffect(() => {
    if (!lastCreatedForInline || lastCreatedForInline.instanceId !== instanceId) return;
    const created = lastCreatedForInline.reference;
    if (!created?.id) {
      setMainData?.('reference.lastCreatedForInline', null);
      return;
    }
    setHasBeenOpened(true);
    handleSelect(created);
    setMainData?.('reference.lastCreatedForInline', null);
  }, [lastCreatedForInline, instanceId, handleSelect, setMainData]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      if (selectedItem === null || displaySelected === 'Танланмаган') {
        setHighlightIndex(-1);
      } else {
        const idx = visibleOptions.findIndex((item) => item.id === selectedItem.id);
        setHighlightIndex(idx >= 0 ? idx : visibleOptions.length > 0 ? 0 : -1);
      }
      return;
    }

    setHighlightIndex((prev) => {
      const max = visibleOptions.length - 1;
      if (max < 0) return -1;
      return Math.min(Math.max(prev, -1), max);
    });
  }, [isOpen, visibleOptions, selectedItem, displaySelected]);

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const el = dropdownRef.current.querySelector('[data-highlight-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen, visibleOptions]);

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
          const max = visibleOptions.length - 1;
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
          handleSelect(null);
        } else if (highlightIndex >= 0 && highlightIndex < visibleOptions.length) {
          handleSelect(visibleOptions[highlightIndex]);
        }
      }
    },
    [isOpen, visibleOptions, highlightIndex, handleSelect],
  );

  if (error && hasBeenOpened) {
    return (
      <div className={cn(selectStyles.box, className)}>
        {label !== '' && <div className={selectStyles.label}>{label}</div>}
        <div className={selectStyles.select}>Хатолик</div>
      </div>
    );
  }

  if (isEditing && editableElement) {
    return (
      <div className={cn(selectStyles.box, className)}>
        {label !== '' && <div className={selectStyles.label}>{label}</div>}
        <div className={selectStyles.inlineEditRow}>
          <input
            ref={editInputRef}
            type="text"
            className={selectStyles.inlineEditInput}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSaveEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelEdit();
              }
            }}
            disabled={isSaving}
          />
          <button
            type="button"
            className={selectStyles.inlineEditSave}
            onClick={() => void handleSaveEdit()}
            onMouseDown={(e) => e.preventDefault()}
            title="Сақлаш"
            disabled={isSaving}
            tabIndex={-1}
          >
            ✓
          </button>
          <button
            type="button"
            className={selectStyles.inlineEditCancel}
            onClick={handleCancelEdit}
            onMouseDown={(e) => e.preventDefault()}
            title="Бекор қилиш"
            disabled={isSaving}
            tabIndex={-1}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  const showEditButton = Boolean(!disabled && showInlineCreateButton && editableElement);

  return (
    <div className={cn(selectStyles.box, className)}>
      {label !== '' && <div className={selectStyles.label}>{label}</div>}
      <div className={selectStyles.selectRow}>
        <div className={selectStyles.customSelectContainer} ref={dropdownRef}>
          <div
            className={cn(selectStyles.customSelect, { [selectStyles.disabled]: disabled })}
            onClick={() => {
              if (disabled) return;
              if (isOpen) {
                setIsOpen(false);
                setSearchTerm('');
              } else {
                openSelect();
              }
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className={cn(selectStyles.searchInput, {
                [selectStyles.defaultSelected]: displaySelected === 'Танланмаган',
              })}
              placeholder={displaySelected}
              value={isOpen ? searchTerm : displaySelected}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => openSelect()}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              disabled={disabled}
              readOnly={!isOpen}
            />
            <div className={selectStyles.arrow}>{isOpen ? '▲' : '▼'}</div>
          </div>
          {isOpen && (
            <div className={selectStyles.dropdown}>
              <div className={selectStyles.optionsList}>
                {isLoading ? (
                  <div className={selectStyles.noResults}>Юкланмоқда...</div>
                ) : (
                  <>
                    <div
                      data-highlight-active={highlightIndex === -1 ? true : undefined}
                      className={cn(selectStyles.option, selectStyles.defaultOption, {
                        [selectStyles.highlighted]: highlightIndex === -1,
                      })}
                      onClick={() => handleSelect(null)}
                    >
                      Танланмаган
                    </div>
                    {filteredOptions.length === 0 ? (
                      <div className={selectStyles.noResults}>Топилмади</div>
                    ) : (
                      <>
                        {visibleOptions.map((item, index) => (
                          <div
                            key={item.id}
                            data-highlight-active={highlightIndex === index ? true : undefined}
                            className={cn(selectStyles.option, {
                              [selectStyles.highlighted]: highlightIndex === index,
                              [selectStyles.selected]: item.id === valueId,
                            })}
                            onClick={() => handleSelect(item)}
                          >
                            {item.name}
                          </div>
                        ))}
                        {hiddenOptionsCount > 0 && (
                          <div className={selectStyles.noResults}>
                            Яна {hiddenOptionsCount} та… қидирувдан фойдаланинг
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {showEditButton && (
          <button
            type="button"
            className={selectStyles.editButton}
            onClick={handleStartEdit}
            onMouseDown={(e) => e.preventDefault()}
            title="Танланганни таҳрирлаш"
            tabIndex={-1}
          >
            ✎
          </button>
        )}
        {!disabled && showInlineCreateButton && (
          <button
            type="button"
            className={selectStyles.plusButton}
            onClick={handleOpenInlineCreate}
            onMouseDown={(e) => e.preventDefault()}
            title="Янги қўшиш"
            tabIndex={-1}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
};
