'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type MutableRefObject,
    type Ref,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import cn from 'classnames';
import docSelectStyles from '@/app/components/documents/document/selects/selectReferenceInForm/selectReferenceInForm.module.css';
import styles from './contractClientSelect.module.css';
import { useAppContext } from '@/app/context/app.context';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { isInlineQuickAddBlocked } from '@/app/components/reference/inlineReferenceQuickAddGuard';
import { matchTmzNameSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';

const generateInstanceId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `contract-client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
    return (value: T | null) => {
        refs.forEach((ref) => {
            if (!ref) return;
            if (typeof ref === 'function') ref(value);
            else (ref as MutableRefObject<T | null>).current = value;
        });
    };
}

interface Props {
    label: string;
    token: string;
    enterpriseId: number;
    value: string;
    /** clientName — номи (бўш қатор тозалашда ҳам юборилади) */
    onChange: (clientId: string, clientName: string) => void;
    disabled?: boolean;
    /** Реф на поле поиска (например, для фокуса после TAB с поля даты) */
    inputRef?: Ref<HTMLInputElement>;
    /** Доп. класс контейнера (например, для единого шрифта в форме) */
    className?: string;
    /** Доп. класс обёртки селекта */
    controlClassName?: string;
    /** Доп. класс поля поиска */
    searchClassName?: string;
    /** Доп. класс кнопки «+» */
    plusClassName?: string;
}

export default function ContractClientSelect({
    label,
    token,
    enterpriseId,
    value,
    onChange,
    disabled = false,
    inputRef: inputRefProp,
    className,
    controlClassName,
    searchClassName,
    plusClassName,
}: Props) {
    const { mainData, setMainData } = useAppContext();
    const instanceId = useMemo(() => generateInstanceId(), []);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRefLocal = useRef<HTMLInputElement>(null);
    const wasOpenRef = useRef(false);

    const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(-1);

    const loadClients = useCallback(() => {
        foApi.getReferences(token, 'CLIENTS', enterpriseId).then(setClients);
    }, [token, enterpriseId]);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

    useEffect(() => {
        if (!isOpen) return;
        const onDoc = (e: globalThis.MouseEvent) => {
            const el = containerRef.current;
            if (el && !el.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [isOpen]);

    useEffect(() => {
        if (!value) {
            setDisplayName('');
            return;
        }
        const id = Number(value);
        const c = clients.find((x) => x.id === id);
        if (c) setDisplayName(c.name);
    }, [value, clients]);

    const filtered = useMemo(() => {
        if (!searchTerm.trim()) return clients;
        return clients.filter((c) => matchTmzNameSearch(c, searchTerm));
    }, [clients, searchTerm]);

    useEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            return;
        }

        if (!wasOpenRef.current) {
            wasOpenRef.current = true;
            if (!value) {
                setHighlightIndex(-1);
            } else {
                const idx = filtered.findIndex((c) => String(c.id) === value);
                setHighlightIndex(idx >= 0 ? idx : filtered.length > 0 ? 0 : -1);
            }
            return;
        }

        setHighlightIndex((prev) => {
            const max = filtered.length - 1;
            if (max < 0) return -1;
            return Math.min(Math.max(prev, -1), max);
        });
    }, [isOpen, filtered, value]);

    useEffect(() => {
        if (!isOpen || !dropdownRef.current) return;
        const el = dropdownRef.current.querySelector('[data-highlight-active="true"]');
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlightIndex, isOpen, filtered]);

    const lastCreatedForInline = mainData.reference?.lastCreatedForInline;
    useEffect(() => {
        if (!lastCreatedForInline) return;
        if (lastCreatedForInline.instanceId !== instanceId) return;
        const created = lastCreatedForInline.reference;
        if (!created || typeof created.id !== 'number') {
            setMainData?.('reference.lastCreatedForInline', null);
            return;
        }
        const newId = created.id;
        const newName = created.name;
        setClients((prev) => {
            if (prev.some((p) => p.id === newId)) return prev;
            return [...prev, { id: newId, name: newName }];
        });
        onChange(String(newId), newName);
        setDisplayName(newName);
        setSearchTerm('');
        setIsOpen(false);
        setMainData?.('reference.lastCreatedForInline', null);
    }, [lastCreatedForInline, instanceId, onChange, setMainData]);

    const handlePlus = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!setMainData || disabled) return;
        if (isInlineQuickAddBlocked()) return;
        setMainData('reference.lastCreatedForInline', null);
        setMainData('showMessageWindow', false);
        setMainData('reference.inlineCreation', {
            typeReference: TypeReference.PARTNERS,
            instanceId,
        });
    };

    const pick = useCallback((c: { id: number; name: string }) => {
        onChange(String(c.id), c.name);
        setDisplayName(c.name);
        setSearchTerm('');
        setIsOpen(false);
    }, [onChange]);

    const clearSelection = useCallback(() => {
        onChange('', '');
        setDisplayName('');
        setSearchTerm('');
        setIsOpen(false);
    }, [onChange]);

    const handleKeyDown = useCallback(
        (e: ReactKeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setSearchTerm('');
                inputRefLocal.current?.blur();
                return;
            }

            if (e.key === 'ArrowDown') {
                if (!isOpen) {
                    if (!disabled) setIsOpen(true);
                    return;
                }
                e.preventDefault();
                setHighlightIndex((prev) => {
                    const max = filtered.length - 1;
                    if (max < 0) return -1;
                    if (prev < max) return prev + 1;
                    return max;
                });
                return;
            }

            if (!isOpen) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightIndex((prev) => (prev > -1 ? prev - 1 : -1));
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (highlightIndex === -1) {
                    clearSelection();
                } else if (highlightIndex >= 0 && highlightIndex < filtered.length) {
                    pick(filtered[highlightIndex]);
                }
            }
        },
        [clearSelection, disabled, filtered, highlightIndex, isOpen, pick],
    );

    const setInputMergedRef = mergeRefs(inputRefLocal, inputRefProp);

    return (
        <div className={cn(styles.box, className)} ref={containerRef}>
            {label && <div className={docSelectStyles.label}>{label}</div>}
            <div className={docSelectStyles.selectRow}>
                <div className={docSelectStyles.customSelectContainer} ref={dropdownRef}>
                    <div
                        className={cn(docSelectStyles.customSelect, controlClassName, {
                            [docSelectStyles.disabled]: disabled,
                        })}
                        onClick={() => !disabled && setIsOpen((o) => !o)}
                    >
                        <input
                            ref={setInputMergedRef}
                            type="text"
                            className={cn(docSelectStyles.searchInput, searchClassName)}
                            placeholder="Қидиринг ёки танланг…"
                            value={isOpen ? searchTerm : displayName}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (!isOpen) setIsOpen(true);
                            }}
                            onFocus={() => !disabled && setIsOpen(true)}
                            onKeyDown={handleKeyDown}
                            onClick={(ev) => ev.stopPropagation()}
                            disabled={disabled}
                        />
                    </div>
                    {isOpen && !disabled && (
                        <div className={docSelectStyles.dropdown}>
                            <div className={docSelectStyles.optionsList}>
                                <div
                                    data-highlight-active={highlightIndex === -1 ? true : undefined}
                                    className={cn(docSelectStyles.option, {
                                        [docSelectStyles.highlighted]: highlightIndex === -1,
                                    })}
                                    onClick={clearSelection}
                                >
                                    — танланмаган —
                                </div>
                                {filtered.map((c, index) => (
                                    <div
                                        key={c.id}
                                        data-highlight-active={
                                            highlightIndex === index ? true : undefined
                                        }
                                        className={cn(docSelectStyles.option, {
                                            [docSelectStyles.selected]: String(c.id) === value,
                                            [docSelectStyles.highlighted]: highlightIndex === index,
                                        })}
                                        onClick={() => pick(c)}
                                    >
                                        {c.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    className={cn(docSelectStyles.plusButton, plusClassName)}
                    onClick={handlePlus}
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={disabled}
                    title="Янги мижоз (ҳамкор)"
                    tabIndex={-1}
                >
                    +
                </button>
            </div>
        </div>
    );
}
