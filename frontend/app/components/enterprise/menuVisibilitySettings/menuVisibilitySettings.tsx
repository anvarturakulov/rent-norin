'use client'
import { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './menuVisibilitySettings.module.css';
import { MenuData } from '@/app/data/menu';
import { MenuVisibilitySettings, RoleMenuVisibility } from '@/app/interfaces/enterprise.interface';
import { UserRoles } from '@/app/interfaces/user.interface';
import { DocumentType } from '@/app/interfaces/document.interface';
import { ReportType } from '@/app/interfaces/report.interface';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { ServiceType, GateType, FurnitureType } from '@/app/interfaces/general.interface';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import { useAppContext } from '@/app/context/app.context';
import { groupItemsByType, flattenMenuStructure, getInformReportsFromDashboard } from '@/app/utils/menuRegistry';
import { DashboardReportData } from '@/app/data/report';

interface MenuVisibilitySettingsProps {
    menuVisibility: MenuVisibilitySettings | undefined;
    onChange: (menuVisibility: MenuVisibilitySettings) => void;
}

export const MenuVisibilitySettingsComponent = ({ menuVisibility, onChange }: MenuVisibilitySettingsProps): JSX.Element => {
    const { mainData } = useAppContext();

    // Получаем элементы меню из MenuData
    const menuItems = useMemo(() => {
        return flattenMenuStructure(MenuData);
    }, []);

    // Получаем inform отчеты из DashboardReportData
    const informReports = useMemo(() => {
        return getInformReportsFromDashboard(DashboardReportData);
    }, []);

    // Объединяем все элементы
    const allMenuItems = useMemo(() => {
        return [...menuItems, ...informReports];
    }, [menuItems, informReports]);

    // Группируем элементы по типам
    const itemsByType = useMemo(() => {
        return groupItemsByType(allMenuItems);
    }, [allMenuItems]);

    // Все роли, исключая GLOBAL роли (для них настройки глобальные, не на уровне предприятия)
    const allRoles = Object.values(UserRoles).filter(role => !isGlobalRole(role));

    // Инициализируем настройки для каждой роли
    const [settings, setSettings] = useState<MenuVisibilitySettings>(() => {
        if (menuVisibility) {
            return menuVisibility;
        }
        // Создаем пустые настройки для каждой роли
        const initial: MenuVisibilitySettings = {};
        allRoles.forEach(role => {
            initial[role] = {
                visibleDocuments: [],
                visibleReports: [],
                visibleInformReports: [],
                visibleReferences: [],
                visibleServices: [],
                visibleGates: [],
                visibleFurniture: [],
            };
        });
        return initial;
    });

    useEffect(() => {
        if (menuVisibility) {
            // Фильтруем удаленные элементы (которых нет в registry)
            const filteredSettings: MenuVisibilitySettings = {};
            const allValues = new Set(allMenuItems.map(item => item.value));
            
            Object.keys(menuVisibility).forEach((role) => {
                const roleSettings = menuVisibility[role as UserRoles];
                if (roleSettings) {
                    filteredSettings[role as UserRoles] = {
                        visibleDocuments: (roleSettings.visibleDocuments || []).filter((v: any) => 
                            allValues.has(v)
                        ),
                        visibleReports: (roleSettings.visibleReports || []).filter((v: any) => 
                            allValues.has(v)
                        ),
                        visibleInformReports: (roleSettings.visibleInformReports || []).filter((v: any) => 
                            allValues.has(v)
                        ),
                        visibleReferences: (roleSettings.visibleReferences || []).filter((v: any) => 
                            allValues.has(v)
                        ),
                        visibleServices: (roleSettings.visibleServices || []).filter((v: any) => 
                            allValues.has(v)
                        ),
                        visibleGates: (roleSettings.visibleGates || []).filter((v: any) => 
                            allValues.has(v)
                        ),
                        visibleFurniture: (roleSettings.visibleFurniture || []).filter((v: any) =>
                            allValues.has(v)
                        ),
                    };
                }
            });
            
            setSettings(filteredSettings);
        }
    }, [menuVisibility, allMenuItems]);

    // Обновляем настройки
    const updateRoleVisibility = useCallback((role: UserRoles, field: keyof RoleMenuVisibility, value: any, checked: boolean) => {
        setSettings(prev => {
            const newSettings = { ...prev };
            if (!newSettings[role]) {
                newSettings[role] = {
                    visibleDocuments: [],
                    visibleReports: [],
                    visibleInformReports: [],
                    visibleReferences: [],
                    visibleServices: [],
                    visibleGates: [],
                    visibleFurniture: [],
                };
            }

            const roleSettings = { ...newSettings[role] };
            const currentValue = roleSettings[field];
            
            // Ensure we're working with an array (not a boolean field)
            const currentArray = Array.isArray(currentValue) ? currentValue : [];
            
            if (checked) {
                // Добавляем элемент
                if (!currentArray.includes(value)) {
                    roleSettings[field] = [...currentArray, value] as any;
                }
            } else {
                // Удаляем элемент
                roleSettings[field] = currentArray.filter(item => item !== value) as any;
            }

            newSettings[role] = roleSettings;
            
            // Вызываем onChange после обновления состояния
            setTimeout(() => onChange(newSettings), 0);
            
            return newSettings;
        });
    }, [onChange]);

    // Проверяем, отмечен ли элемент
    const isChecked = (role: UserRoles, field: keyof RoleMenuVisibility, value: any): boolean => {
        const roleSettings = settings[role];
        if (!roleSettings || !roleSettings[field]) {
            return false;
        }
        return (roleSettings[field] as any[]).includes(value);
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Настройки видимости меню</h3>
            <p className={styles.description}>
                Выберите элементы, которые должны быть видны для каждой роли. По умолчанию ничего не видно (whitelist подход).
                <br />
                <strong>Примечание:</strong> Для ролей с суффиксом GLOBAL (например, HEADGLOBAL, KASSIRGLOBAL) настройки настраиваются глобально, а не на уровне предприятия.
            </p>

            {allRoles.map(role => (
                <div key={role} className={styles.roleSection}>
                    <h4 className={styles.roleTitle}>{role}</h4>

                    {/* Документы */}
                    {itemsByType.documents.length > 0 && (
                        <div className={styles.typeSection}>
                            <h5 className={styles.typeTitle}>Документы</h5>
                            <div className={styles.itemsGrid}>
                                {itemsByType.documents.map(item => (
                                    <label key={item.value} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked(role, 'visibleDocuments', item.value)}
                                            onChange={(e) => updateRoleVisibility(role, 'visibleDocuments', item.value, e.target.checked)}
                                        />
                                        <span>{item.description || item.value}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Отчеты */}
                    {itemsByType.reports.length > 0 && (
                        <div className={styles.typeSection}>
                            <h5 className={styles.typeTitle}>Отчеты</h5>
                            <div className={styles.itemsGrid}>
                                {itemsByType.reports.map(item => (
                                    <label key={item.value} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked(role, 'visibleReports', item.value)}
                                            onChange={(e) => updateRoleVisibility(role, 'visibleReports', item.value, e.target.checked)}
                                        />
                                        <span>{item.description || item.value}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Inform отчеты */}
                    {itemsByType.informReports.length > 0 && (
                        <div className={styles.typeSection}>
                            <h5 className={styles.typeTitle}>Inform отчеты</h5>
                            <div className={styles.itemsGrid}>
                                {itemsByType.informReports.map(item => (
                                    <label key={item.value} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked(role, 'visibleInformReports', item.value)}
                                            onChange={(e) => updateRoleVisibility(role, 'visibleInformReports', item.value, e.target.checked)}
                                        />
                                        <span>{item.description || item.value}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Справочники */}
                    {itemsByType.references.length > 0 && (
                        <div className={styles.typeSection}>
                            <h5 className={styles.typeTitle}>Справочники</h5>
                            <div className={styles.itemsGrid}>
                                {itemsByType.references.map(item => (
                                    <label key={item.value} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked(role, 'visibleReferences', item.value)}
                                            onChange={(e) => updateRoleVisibility(role, 'visibleReferences', item.value, e.target.checked)}
                                        />
                                        <span>{item.description || item.value}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Сервисы */}
                    {itemsByType.services.length > 0 && (
                        <div className={styles.typeSection}>
                            <h5 className={styles.typeTitle}>Сервисы</h5>
                            <div className={styles.itemsGrid}>
                                {itemsByType.services.map(item => (
                                    <label key={item.value} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked(role, 'visibleServices', item.value)}
                                            onChange={(e) => updateRoleVisibility(role, 'visibleServices', item.value, e.target.checked)}
                                        />
                                        <span>{item.description || item.value}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* КПП (Gates) */}
                    {itemsByType.gates.length > 0 && (
                        <div className={styles.typeSection}>
                            <h5 className={styles.typeTitle}>КПП</h5>
                            <div className={styles.itemsGrid}>
                                {itemsByType.gates.map(item => (
                                    <label key={item.value} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked(role, 'visibleGates', item.value)}
                                            onChange={(e) => updateRoleVisibility(role, 'visibleGates', item.value, e.target.checked)}
                                        />
                                        <span>{item.description || item.value}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Мебель ишлаб чиқариш */}
                    {itemsByType.furniture.length > 0 && (
                        <div className={styles.typeSection}>
                            <h5 className={styles.typeTitle}>Мебель ишлаб чиқариш</h5>
                            <div className={styles.itemsGrid}>
                                {itemsByType.furniture.map(item => (
                                    <label key={item.value} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked(role, 'visibleFurniture', item.value)}
                                            onChange={(e) => updateRoleVisibility(role, 'visibleFurniture', item.value, e.target.checked)}
                                        />
                                        <span>{item.description || item.value}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

