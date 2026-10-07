'use client';

import { useState } from 'react';
import { TypeReference } from '@/app/interfaces/reference.interface';
import {
    ReferencePermissionItem,
    ReferencePermissions,
    TmzTabPermissions,
} from '@/app/interfaces/user.interface';
import {
    REFERENCE_PERMISSION_TYPES,
    REFERENCE_TYPE_LABELS,
    TMZ_TAB_LABELS,
    TmzProductTabKey,
    createDeniedReferencePermissions,
    createFullReferencePermissions,
    ensureReferencePermissionItem,
} from '@/app/utils/referencePermissions';
import styles from './ReferencePermissionsEditor.module.css';

interface ReferencePermissionsEditorProps {
    value: ReferencePermissions | null | undefined;
    onChange: (value: ReferencePermissions | null) => void;
}

export function ReferencePermissionsEditor({
    value,
    onChange,
}: ReferencePermissionsEditorProps): JSX.Element {
    const [tmzExpanded, setTmzExpanded] = useState(true);
    const useCustom = value != null;

    const updateType = (
        type: TypeReference,
        patch: Partial<ReferencePermissionItem>,
    ) => {
        const next: ReferencePermissions = { ...(value ?? {}) };
        next[type] = { ...ensureReferencePermissionItem(value, type), ...patch };
        onChange(next);
    };

    const updateTmzTab = (tab: TmzProductTabKey, checked: boolean) => {
        const item = ensureReferencePermissionItem(value, TypeReference.TMZ);
        const tmzTabs: TmzTabPermissions = {
            works: true,
            commonWorks: true,
            materials: true,
            halfstuffs: true,
            components: true,
            pricing: true,
            techMap: true,
            files: true,
            ...item.tmzTabs,
            [tab]: checked,
        };
        updateType(TypeReference.TMZ, { tmzTabs });
    };

    const toggleTypeFlag = (
        type: TypeReference,
        key: keyof Omit<ReferencePermissionItem, 'tmzTabs'>,
        checked: boolean,
    ) => {
        updateType(type, { [key]: checked });
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <div className={styles.title}>Справочниклар буйича хукуклар</div>
                <div className={styles.headerActions}>
                    <label className={styles.customToggle}>
                        <input
                            type="checkbox"
                            checked={useCustom}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    onChange(createFullReferencePermissions());
                                } else {
                                    onChange(null);
                                }
                            }}
                        />
                        <span>Индивидуал созламалар</span>
                    </label>
                    {useCustom && (
                        <>
                            <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => onChange(createFullReferencePermissions())}
                            >
                                Барча рухсатлар
                            </button>
                            <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => onChange(createDeniedReferencePermissions())}
                            >
                                Хеч нарса йук
                            </button>
                        </>
                    )}
                </div>
            </div>

            {!useCustom && (
                <div className={styles.hint}>
                    Барча рухсатлар берилган (созлама йўқ). Индивидуал созламаларни ёқинг.
                </div>
            )}

            {useCustom && (
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Справочник</th>
                                <th>Куриш</th>
                                <th>Яратиш</th>
                                <th>Тахрирлаш</th>
                                <th>Учириш</th>
                                <th>Файл юклаш</th>
                            </tr>
                        </thead>
                        <tbody>
                            {REFERENCE_PERMISSION_TYPES.map((type) => {
                                const item = ensureReferencePermissionItem(value, type);
                                return (
                                    <tr key={type}>
                                        <td className={styles.typeCell}>
                                            {REFERENCE_TYPE_LABELS[type]}
                                            {type === TypeReference.TMZ && (
                                                <button
                                                    type="button"
                                                    className={styles.expandBtn}
                                                    onClick={() => setTmzExpanded((v) => !v)}
                                                >
                                                    {tmzExpanded ? '▼' : '▶'} Вкладкалар
                                                </button>
                                            )}
                                        </td>
                                        {(
                                            [
                                                'canView',
                                                'canCreate',
                                                'canEdit',
                                                'canDelete',
                                                'canUploadFiles',
                                            ] as const
                                        ).map((key) => (
                                            <td key={key} className={styles.checkCell}>
                                                <input
                                                    type="checkbox"
                                                    checked={item[key]}
                                                    onChange={(e) =>
                                                        toggleTypeFlag(type, key, e.target.checked)
                                                    }
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {tmzExpanded && (
                        <div className={styles.tmzTabsBox}>
                            <div className={styles.tmzTabsTitle}>ТМЗ — вкладкаларни кўриш</div>
                            <div className={styles.tmzTabsGrid}>
                                {(
                                    Object.keys(TMZ_TAB_LABELS) as TmzProductTabKey[]
                                ).map((tab) => {
                                    const tmzItem = ensureReferencePermissionItem(
                                        value,
                                        TypeReference.TMZ,
                                    );
                                    const checked = tmzItem.tmzTabs?.[tab] !== false;
                                    return (
                                        <label key={tab} className={styles.tmzTabLabel}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) =>
                                                    updateTmzTab(tab, e.target.checked)
                                                }
                                            />
                                            {TMZ_TAB_LABELS[tab]}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
