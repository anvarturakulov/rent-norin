'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import cn from 'classnames';
import { DocumentType } from '@/app/interfaces/document.interface';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { isDocumentWithAnalitic } from '@/app/service/documents/isDocumentWithAnalitic';
import { showsOrderInJournal } from '../helpers/orderJournal';
import {
    FILTER_OP_LABELS,
    JOURNAL_FILTER_FIELD_DEFS,
    JournalFilterField,
    JournalFilterOp,
    JournalFilterRule,
    createDefaultJournalFilterRules,
    isOrgJournalFilterType,
} from '../constants';
import { JournalReferenceFilterSelect } from './JournalReferenceFilterSelect';
import styles from './JournalFilterModal.module.css';

export interface JournalFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (rules: JournalFilterRule[]) => void;
    rules: JournalFilterRule[];
    contentName: string;
    receiverType?: TypeReference | null;
    senderType?: TypeReference | null;
    analiticType?: TypeReference | null;
    allDocumentsOrgOptions?: ReferenceModel[];
    enterprises?: Array<{ id: number; name: string; markToDeleted?: boolean; isActive?: boolean }>;
}

function isFieldVisible(field: JournalFilterField, contentName: string): boolean {
    const isAll = contentName === 'ALL_DOCUMENTS';
    switch (field) {
        case 'documentType':
            return isAll;
        case 'usd':
            return (
                isAll ||
                contentName === DocumentType.LeaveCash ||
                contentName === DocumentType.MoveCash
            );
        case 'analitic':
            return isAll || isDocumentWithAnalitic(contentName);
        case 'order':
            return showsOrderInJournal(contentName);
        default:
            return true;
    }
}

function usesReferenceSelect(
    field: JournalFilterField,
    contentName: string,
    receiverType?: TypeReference | null,
    senderType?: TypeReference | null,
    analiticType?: TypeReference | null,
): boolean {
    const isAll = contentName === 'ALL_DOCUMENTS';
    if (field === 'receiver') {
        return isAll || isOrgJournalFilterType(receiverType);
    }
    if (field === 'sender') {
        return isAll || isOrgJournalFilterType(senderType);
    }
    if (field === 'analitic') {
        // ALL_DOCUMENTS: типы аналитики разные — текстовый фильтр
        return !isAll && !!analiticType;
    }
    return false;
}

export const JournalFilterModal = memo<JournalFilterModalProps>(function JournalFilterModal({
    isOpen,
    onClose,
    onApply,
    rules,
    contentName,
    receiverType,
    senderType,
    analiticType,
    allDocumentsOrgOptions = [],
    enterprises = [],
}) {
    const [draft, setDraft] = useState<JournalFilterRule[]>(() =>
        rules.length ? rules.map((r) => ({ ...r })) : createDefaultJournalFilterRules(),
    );

    useEffect(() => {
        if (!isOpen) return;
        setDraft(
            rules.length
                ? rules.map((r) => ({ ...r }))
                : createDefaultJournalFilterRules(),
        );
    }, [isOpen, rules]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const visibleFields = useMemo(
        () =>
            JOURNAL_FILTER_FIELD_DEFS.filter((def) =>
                isFieldVisible(def.field, contentName),
            ),
        [contentName],
    );

    const documentTypeOptions = useMemo(
        () =>
            Object.values(DocumentType)
                .filter((t) => t !== DocumentType.Error)
                .map((t) => ({ value: t, label: getDescriptionDocument(t) }))
                .sort((a, b) => a.label.localeCompare(b.label, 'uz')),
        [],
    );

    const enterpriseOptions = useMemo(
        () =>
            (enterprises || [])
                .filter((e) => !e.markToDeleted && e.isActive !== false)
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uz')),
        [enterprises],
    );

    const updateRule = useCallback(
        (field: JournalFilterField, patch: Partial<JournalFilterRule>) => {
            setDraft((prev) =>
                prev.map((r) => (r.field === field ? { ...r, ...patch } : r)),
            );
        },
        [],
    );

    const handleApply = useCallback(() => {
        onApply(draft.map((r) => ({ ...r })));
        onClose();
    }, [draft, onApply, onClose]);

    const handleClear = useCallback(() => {
        setDraft(createDefaultJournalFilterRules());
    }, []);

    const isAllDocuments = contentName === 'ALL_DOCUMENTS';

    if (!isOpen || typeof document === 'undefined') return null;

    const modal = (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="journal-filter-title"
            >
                <div className={styles.header}>
                    <div className={styles.title} id="journal-filter-title">
                        Фильтр
                    </div>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </div>

                <div className={styles.tabs}>
                    <div className={styles.tab}>Фильтр</div>
                </div>

                <div className={styles.body}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.colCheck} />
                                <th className={styles.colField}>Колонка</th>
                                <th className={styles.colOp}>Условие</th>
                                <th className={styles.colValue}>Значение</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleFields.map((def) => {
                                const rule =
                                    draft.find((r) => r.field === def.field) ||
                                    ({
                                        field: def.field,
                                        enabled: false,
                                        op: def.defaultOp,
                                        value: null,
                                    } as JournalFilterRule);
                                const ops = def.ops;
                                const disabled = !rule.enabled;
                                const refSelect = usesReferenceSelect(
                                    def.field,
                                    contentName,
                                    receiverType,
                                    senderType,
                                    analiticType,
                                );

                                return (
                                    <tr
                                        key={def.field}
                                        className={cn({ [styles.rowDisabled]: disabled })}
                                    >
                                        <td className={styles.colCheck}>
                                            <input
                                                type="checkbox"
                                                checked={rule.enabled}
                                                onChange={(e) =>
                                                    updateRule(def.field, {
                                                        enabled: e.target.checked,
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className={styles.colField}>
                                            <span className={styles.fieldLabel}>{def.label}</span>
                                        </td>
                                        <td className={styles.colOp}>
                                            <select
                                                className={styles.opSelect}
                                                disabled={disabled}
                                                value={rule.op}
                                                onChange={(e) =>
                                                    updateRule(def.field, {
                                                        op: e.target.value as JournalFilterOp,
                                                        // switch to text mode if contains on reference field
                                                        value:
                                                            e.target.value === 'contains' &&
                                                            typeof rule.value === 'number'
                                                                ? null
                                                                : rule.value,
                                                    })
                                                }
                                            >
                                                {ops.map((op) => (
                                                    <option key={op} value={op}>
                                                        {FILTER_OP_LABELS[op]}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className={styles.colValue}>
                                            {def.valueType === 'date' ? (
                                                <input
                                                    type="date"
                                                    className={styles.valueInput}
                                                    disabled={disabled}
                                                    value={
                                                        typeof rule.value === 'string'
                                                            ? rule.value
                                                            : ''
                                                    }
                                                    onChange={(e) =>
                                                        updateRule(def.field, {
                                                            value: e.target.value || null,
                                                        })
                                                    }
                                                />
                                            ) : def.valueType === 'number' ? (
                                                <input
                                                    type="number"
                                                    className={styles.valueInput}
                                                    disabled={disabled}
                                                    value={
                                                        rule.value === null ||
                                                        rule.value === undefined
                                                            ? ''
                                                            : String(rule.value)
                                                    }
                                                    onChange={(e) =>
                                                        updateRule(def.field, {
                                                            value:
                                                                e.target.value === ''
                                                                    ? null
                                                                    : Number(e.target.value),
                                                        })
                                                    }
                                                />
                                            ) : def.valueType === 'enterprise' ? (
                                                <select
                                                    className={styles.valueSelect}
                                                    disabled={disabled}
                                                    value={
                                                        rule.value == null
                                                            ? ''
                                                            : String(rule.value)
                                                    }
                                                    onChange={(e) =>
                                                        updateRule(def.field, {
                                                            value:
                                                                e.target.value === ''
                                                                    ? null
                                                                    : Number(e.target.value),
                                                        })
                                                    }
                                                >
                                                    <option value="">Танланмаган</option>
                                                    {enterpriseOptions.map((e) => (
                                                        <option key={e.id} value={e.id}>
                                                            {e.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : def.valueType === 'documentType' ? (
                                                <select
                                                    className={styles.valueSelect}
                                                    disabled={disabled}
                                                    value={
                                                        rule.value == null
                                                            ? ''
                                                            : String(rule.value)
                                                    }
                                                    onChange={(e) =>
                                                        updateRule(def.field, {
                                                            value: e.target.value || null,
                                                        })
                                                    }
                                                >
                                                    <option value="">Танланмаган</option>
                                                    {documentTypeOptions.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : refSelect && rule.op === 'eq' ? (
                                                <JournalReferenceFilterSelect
                                                    fieldType={
                                                        def.field === 'receiver'
                                                            ? 'receiver'
                                                            : def.field === 'sender'
                                                              ? 'sender'
                                                              : 'analitic'
                                                    }
                                                    value={
                                                        typeof rule.value === 'number'
                                                            ? rule.value
                                                            : rule.value != null &&
                                                                /^\d+$/.test(String(rule.value))
                                                              ? Number(rule.value)
                                                              : null
                                                    }
                                                    onChange={(id) =>
                                                        updateRule(def.field, { value: id })
                                                    }
                                                    typeReference={
                                                        def.field === 'receiver'
                                                            ? receiverType || undefined
                                                            : def.field === 'sender'
                                                              ? senderType || undefined
                                                              : analiticType || undefined
                                                    }
                                                    options={
                                                        isAllDocuments
                                                            ? allDocumentsOrgOptions
                                                            : undefined
                                                    }
                                                    placeholder="Танланмаган"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    className={styles.valueInput}
                                                    disabled={disabled}
                                                    value={
                                                        rule.value == null
                                                            ? ''
                                                            : String(rule.value)
                                                    }
                                                    onChange={(e) =>
                                                        updateRule(def.field, {
                                                            value: e.target.value,
                                                        })
                                                    }
                                                    placeholder={def.label}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className={styles.footer}>
                    <button
                        type="button"
                        className={cn(styles.btn, styles.clearBtn)}
                        onClick={handleClear}
                    >
                        Тозалаш
                    </button>
                    <button type="button" className={styles.btn} onClick={onClose}>
                        Отмена
                    </button>
                    <button
                        type="button"
                        className={cn(styles.btn, styles.btnPrimary)}
                        onClick={handleApply}
                    >
                        ОК
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
});
