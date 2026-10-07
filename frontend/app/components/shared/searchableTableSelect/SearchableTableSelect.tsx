'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import cn from 'classnames';
import styles from './SearchableTableSelect.module.css';

export interface SearchableTableSelectOption {
    id: string | number;
    name: string;
}

interface SearchableTableSelectProps {
    options: SearchableTableSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    autoFocus?: boolean;
    onAutoFocusApplied?: () => void;
}

export const SearchableTableSelect = ({
    options,
    value,
    onChange,
    placeholder = '— Танланг —',
    disabled = false,
    className,
    autoFocus = false,
    onAutoFocusApplied,
}: SearchableTableSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [dropdownPos, setDropdownPos] = useState<{
        top: number;
        left: number;
        width: number;
        maxHeight: number;
        openUpward: boolean;
    }>({ top: 0, left: 0, width: 200, maxHeight: 220, openUpward: false });

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const wasOpenRef = useRef(false);

    const selectedOption = useMemo(
        () => options.find((o) => String(o.id) === value) ?? null,
        [options, value],
    );

    const displayText = selectedOption?.name ?? '';

    const filteredOptions = useMemo(() => {
        const terms = searchTerm
            .split('+')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
        if (terms.length === 0) return options;
        return options.filter((o) => {
            const name = o.name.toLowerCase();
            return terms.every((term) => name.includes(term));
        });
    }, [options, searchTerm]);

    const handleSelect = useCallback(
        (optionId: string) => {
            onChange(optionId);
            setIsOpen(false);
            setSearchTerm('');
            inputRef.current?.blur();
        },
        [onChange],
    );

    const handleClear = useCallback(() => {
        onChange('');
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
    }, [onChange]);

    const updateDropdownPosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const preferredMax = 220;
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        const openUpward = spaceBelow < preferredMax && spaceAbove > spaceBelow;
        const maxHeight = Math.max(80, Math.min(preferredMax, openUpward ? spaceAbove : spaceBelow));
        setDropdownPos({
            top: openUpward ? rect.top : rect.bottom,
            left: rect.left,
            width: Math.max(rect.width, 200),
            maxHeight,
            openUpward,
        });
    }, []);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current && e.target instanceof Node &&
                !containerRef.current.contains(e.target) &&
                !(dropdownRef.current && dropdownRef.current.contains(e.target))
            ) {
                setIsOpen(false);
                setSearchTerm('');
                inputRef.current?.blur();
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            return;
        }
        updateDropdownPosition();
        if (!wasOpenRef.current) {
            wasOpenRef.current = true;
            if (!selectedOption) {
                setHighlightIndex(-1);
            } else {
                const idx = filteredOptions.findIndex((o) => String(o.id) === value);
                setHighlightIndex(idx >= 0 ? idx : filteredOptions.length > 0 ? 0 : -1);
            }
            return;
        }
        setHighlightIndex((prev) => {
            const max = filteredOptions.length - 1;
            if (max < 0) return -1;
            return Math.min(Math.max(prev, -1), max);
        });
    }, [isOpen, filteredOptions, selectedOption, value, updateDropdownPosition]);

    useEffect(() => {
        if (!isOpen || !dropdownRef.current) return;
        const el = dropdownRef.current.querySelector('[data-hl="true"]');
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlightIndex, isOpen, filteredOptions]);

    useEffect(() => {
        if (!isOpen) return;
        const onScroll = () => updateDropdownPosition();
        window.addEventListener('scroll', onScroll, true);
        return () => window.removeEventListener('scroll', onScroll, true);
    }, [isOpen, updateDropdownPosition]);

    useEffect(() => {
        if (!autoFocus || disabled) return;
        setIsOpen(true);
    }, [autoFocus, disabled]);

    useEffect(() => {
        if (!autoFocus || disabled || !isOpen) return;
        const t = window.setTimeout(() => {
            containerRef.current?.scrollIntoView({ block: 'nearest' });
            inputRef.current?.focus();
            onAutoFocusApplied?.();
        }, 0);
        return () => window.clearTimeout(t);
    }, [autoFocus, disabled, isOpen, onAutoFocusApplied]);

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
                    const max = filteredOptions.length - 1;
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
                } else if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
                    handleSelect(String(filteredOptions[highlightIndex].id));
                }
            }
        },
        [isOpen, filteredOptions, highlightIndex, handleSelect, handleClear],
    );

    const dropdownContent = isOpen ? (
        <div
            ref={dropdownRef}
            className={cn(styles.dropdownFixed, {
                [styles.dropdownFixedUp]: dropdownPos.openUpward,
            })}
            style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                maxHeight: dropdownPos.maxHeight,
                transform: dropdownPos.openUpward ? 'translateY(-100%)' : undefined,
            }}
        >
            <div
                data-hl={highlightIndex === -1 ? 'true' : undefined}
                className={cn(styles.placeholder, {
                    [styles.highlighted]: highlightIndex === -1,
                })}
                onClick={handleClear}
            >
                {placeholder}
            </div>

            {filteredOptions.length === 0 ? (
                <div className={styles.noResults}>Топилмади</div>
            ) : (
                filteredOptions.map((opt, idx) => (
                    <div
                        key={opt.id}
                        data-hl={highlightIndex === idx ? 'true' : undefined}
                        className={cn(styles.option, {
                            [styles.selected]: String(opt.id) === value,
                            [styles.highlighted]: highlightIndex === idx,
                        })}
                        onClick={() => handleSelect(String(opt.id))}
                    >
                        {opt.name}
                    </div>
                ))
            )}
        </div>
    ) : null;

    return (
        <div ref={containerRef} className={cn(styles.container, className)}>
            <div
                className={cn(styles.trigger, {
                    [styles.open]: isOpen,
                    [styles.openUp]: isOpen && dropdownPos.openUpward,
                    [styles.disabled]: disabled,
                })}
                tabIndex={disabled ? undefined : 0}
                onKeyDown={(e) => {
                    if (!isOpen) {
                        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                            if (disabled) return;
                            e.preventDefault();
                            setIsOpen(true);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }
                        return;
                    }
                }}
                onClick={() => {
                    if (disabled) return;
                    setIsOpen(!isOpen);
                    if (!isOpen) {
                        setTimeout(() => inputRef.current?.focus(), 0);
                    }
                }}
            >
                {isOpen ? (
                    <input
                        ref={inputRef}
                        type="text"
                        className={styles.input}
                        placeholder={displayText || placeholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        disabled={disabled}
                    />
                ) : (
                    <div
                        className={cn(styles.displayValue, {
                            [styles.displayValuePlaceholder]: !displayText,
                        })}
                        title={displayText || undefined}
                    >
                        {displayText || placeholder}
                    </div>
                )}
                <span className={styles.arrow}>
                    <svg width="10" height="10" viewBox="0 0 10 6" fill="none">
                        <path
                            d={isOpen ? 'M9 5L5 1L1 5' : 'M1 1L5 5L9 1'}
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
            </div>

            {dropdownContent && createPortal(dropdownContent, document.body)}
        </div>
    );
};
