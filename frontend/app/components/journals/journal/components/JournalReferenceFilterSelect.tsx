'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { useSelectReferenceData } from '@/app/components/documents/document/selects/selectReferenceInForm/hooks/useSelectReferenceData';
import { matchTmzNameSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';
import { sortByName } from '@/app/service/references/sortByName';
import styles from './JournalReferenceFilterSelect.module.css';

export type JournalReferenceFilterField = 'sender' | 'receiver' | 'analitic';

export interface JournalReferenceFilterSelectProps {
    fieldType: JournalReferenceFilterField;
    value: number | null;
    onChange: (id: number | null) => void;
    placeholder?: string;
    /** When set (and options not provided), loads via useSelectReferenceData. */
    typeReference?: TypeReference;
    /** Prebuilt options (e.g. ALL_DOCUMENTS). Skips API hook when provided. */
    options?: ReferenceModel[];
    autoFocus?: boolean;
    className?: string;
    /** Keep dropdown open after mount (classic journal header popover). */
    defaultOpen?: boolean;
}

const formatDisplayName = (item: ReferenceModel, typeReference?: TypeReference): string => {
    if (item.isFolder) return `📁 ${item.name}`;
    if (typeReference === TypeReference.STORAGES && item.refValues?.isMainWarehouse) {
        return `${item.name} (основной)`;
    }
    return item.name;
};

type InnerProps = Omit<JournalReferenceFilterSelectProps, 'options' | 'typeReference'> & {
    data: ReferenceModel[];
    typeReference?: TypeReference;
    isLoading?: boolean;
    error?: unknown;
};

const JournalReferenceFilterSelectInner = ({
    value,
    onChange,
    placeholder = 'Танланмаган',
    typeReference,
    autoFocus = false,
    className,
    defaultOpen = false,
    data: rawData,
    isLoading = false,
    error = null,
}: InnerProps): JSX.Element => {
    const data = useMemo(
        () => [...(rawData || [])].sort(sortByName) as ReferenceModel[],
        [rawData],
    );

    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const wasOpenRef = useRef(false);

    const selectedItem = useMemo(
        () => (value != null ? data.find((item) => item.id === value) ?? null : null),
        [data, value],
    );

    const selectedLabel = useMemo(() => {
        if (!selectedItem) return placeholder;
        return formatDisplayName(selectedItem, typeReference ?? selectedItem.typeReference);
    }, [selectedItem, placeholder, typeReference]);

    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return data;
        return data.filter((item) => matchTmzNameSearch(item, searchTerm));
    }, [data, searchTerm]);

    const handleClear = useCallback(() => {
        setSearchTerm('');
        setIsOpen(false);
        inputRef.current?.blur();
        onChange(null);
    }, [onChange]);

    const handleItemSelect = useCallback(
        (item: ReferenceModel) => {
            setSearchTerm('');
            setIsOpen(false);
            inputRef.current?.blur();
            onChange(item.id ?? null);
        },
        [onChange],
    );

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
                inputRef.current?.blur();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            return;
        }
        if (!wasOpenRef.current) {
            wasOpenRef.current = true;
            if (selectedItem === null) {
                setHighlightIndex(-1);
            } else {
                const idx = filteredData.findIndex((item) => item.id === selectedItem.id);
                setHighlightIndex(idx >= 0 ? idx : filteredData.length > 0 ? 0 : -1);
            }
            return;
        }
        setHighlightIndex((prev) => {
            const max = filteredData.length - 1;
            if (max < 0) return -1;
            return Math.min(Math.max(prev, -1), max);
        });
    }, [isOpen, filteredData, selectedItem]);

    useEffect(() => {
        if (!isOpen || !dropdownRef.current) return;
        const el = dropdownRef.current.querySelector('[data-highlight-active="true"]');
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlightIndex, isOpen, filteredData]);

    useEffect(() => {
        if (autoFocus || defaultOpen) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [autoFocus, defaultOpen]);

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
                    return prev < max ? prev + 1 : max;
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
                    handleClear();
                } else if (highlightIndex >= 0 && highlightIndex < filteredData.length) {
                    handleItemSelect(filteredData[highlightIndex]);
                }
            }
        },
        [isOpen, filteredData, highlightIndex, handleClear, handleItemSelect],
    );

    if (isLoading) {
        return <div className={styles.loading}>Загрузка...</div>;
    }
    if (error) {
        return <div className={styles.error}>Ошибка загрузки</div>;
    }

    const hasValue = value != null;

    return (
        <div
            className={cn(styles.container, className)}
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <div
                className={cn(styles.customSelect, {
                    [styles.customSelectActive]: hasValue,
                })}
                onClick={() => {
                    setIsOpen((prev) => !prev);
                    setTimeout(() => inputRef.current?.focus(), 0);
                }}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className={cn(styles.searchInput, {
                        [styles.defaultSelected]: !hasValue,
                    })}
                    placeholder={selectedLabel}
                    value={isOpen ? searchTerm : selectedLabel}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    readOnly={!isOpen}
                />
            </div>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.optionsList}>
                        <div
                            data-highlight-active={highlightIndex === -1 ? true : undefined}
                            className={cn(styles.option, styles.defaultOption, {
                                [styles.selected]: !hasValue,
                                [styles.highlighted]: highlightIndex === -1,
                            })}
                            onClick={handleClear}
                        >
                            Танланмаган
                        </div>

                        {filteredData.length === 0 ? (
                            <div className={styles.noResults}>Ничего не найдено</div>
                        ) : (
                            filteredData.map((item, index) => {
                                const displayText = formatDisplayName(
                                    item,
                                    typeReference ?? item.typeReference,
                                );
                                return (
                                    <div
                                        key={item.id}
                                        data-highlight-active={
                                            highlightIndex === index ? true : undefined
                                        }
                                        className={cn(styles.option, {
                                            [styles.selected]: value === item.id,
                                            [styles.highlighted]: highlightIndex === index,
                                        })}
                                        onClick={() => handleItemSelect(item)}
                                        title={displayText}
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
    );
};

const JournalReferenceFilterSelectFromApi = ({
    fieldType,
    typeReference,
    ...rest
}: JournalReferenceFilterSelectProps & { typeReference: TypeReference }): JSX.Element => {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const { contentName } = mainData.document;
    const token = user?.token;

    const { data, error, isLoading } = useSelectReferenceData({
        typeReference,
        type: fieldType,
        contentName: contentName || '',
        mainData,
        token,
    });

    return (
        <JournalReferenceFilterSelectInner
            {...rest}
            fieldType={fieldType}
            typeReference={typeReference}
            data={(data || []) as ReferenceModel[]}
            isLoading={isLoading}
            error={error}
        />
    );
};

export const JournalReferenceFilterSelect = (
    props: JournalReferenceFilterSelectProps,
): JSX.Element => {
    if (Array.isArray(props.options)) {
        return (
            <JournalReferenceFilterSelectInner
                fieldType={props.fieldType}
                value={props.value}
                onChange={props.onChange}
                placeholder={props.placeholder}
                typeReference={props.typeReference}
                autoFocus={props.autoFocus}
                className={props.className}
                defaultOpen={props.defaultOpen}
                data={props.options}
            />
        );
    }

    if (!props.typeReference) {
        return <div className={styles.error}>Тип справочника не задан</div>;
    }

    return (
        <JournalReferenceFilterSelectFromApi
            {...props}
            typeReference={props.typeReference}
        />
    );
};
