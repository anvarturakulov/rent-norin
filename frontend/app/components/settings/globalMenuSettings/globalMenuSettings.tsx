'use client'
import { useState, useEffect, useMemo, useCallback } from 'react';
import styles from '@/app/components/enterprise/menuVisibilitySettings/menuVisibilitySettings.module.css';
import { MenuData } from '@/app/data/menu';
import { MenuVisibilitySettings, RoleMenuVisibility } from '@/app/interfaces/enterprise.interface';
import { UserRoles } from '@/app/interfaces/user.interface';
import { DocumentType } from '@/app/interfaces/document.interface';
import { ReportType } from '@/app/interfaces/report.interface';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { ServiceType, GateType, FurnitureType } from '@/app/interfaces/general.interface';
import { getGlobalRoles, canEditGlobalSettings } from '@/app/utils/roleHelpers';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { Button } from '@/app/components';
import axios from 'axios';
import { showMessage } from '@/app/service/common/showMessage';
import { groupItemsByType, flattenMenuStructure, getInformReportsFromDashboard } from '@/app/utils/menuRegistry';
import { DashboardReportData } from '@/app/data/report';

interface GlobalMenuSettingsComponentProps {
    onClose?: () => void;
}

export const GlobalMenuSettingsComponent = ({ onClose }: GlobalMenuSettingsComponentProps): JSX.Element => {
    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users;
    const token = user?.token;
    const canEdit = canEditGlobalSettings(user?.role || UserRoles.GUEST);

    // Загружаем глобальные настройки
    const globalSettingsUrl = `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings/global/menuVisibility`;
    const { data: globalSettings, mutate } = useSWR(
        token ? globalSettingsUrl : null,
        (url) => getDataForSwr(url, token)
    );

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

    // Только GLOBAL роли, исключая ADMINGLOBAL (у него все элементы видны по умолчанию)
    const globalRoles = getGlobalRoles().filter(role => role !== UserRoles.ADMINGLOBAL);

    // Инициализируем настройки для каждой GLOBAL роли
    const [settings, setSettings] = useState<MenuVisibilitySettings>(() => {
        const initial: MenuVisibilitySettings = {};
        globalRoles.forEach(role => {
            initial[role] = {
                visibleDocuments: [],
                visibleReports: [],
                visibleInformReports: [],
                visibleReferences: [],
                visibleServices: [],
                visibleGates: [],
                visibleFurniture: [],
                canAddDocuments: false,
                canEditDocuments: false,
                canDeleteDocuments: false,
                canProcessDocuments: false
            };
        });
        return initial;
    });

    useEffect(() => {
        if (globalSettings) {
            // Фильтруем удаленные элементы (которых нет в registry)
            const filteredSettings: MenuVisibilitySettings = {};
            const allValues = new Set(allMenuItems.map(item => item.value));
            
            Object.keys(globalSettings).forEach((role) => {
                const roleSettings = globalSettings[role as UserRoles];
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
                        canAddDocuments: roleSettings.canAddDocuments || false,
                        canEditDocuments: roleSettings.canEditDocuments || false,
                        canDeleteDocuments: roleSettings.canDeleteDocuments || false,
                        canProcessDocuments: roleSettings.canProcessDocuments || false,
                    };
                }
            });
            
            setSettings(filteredSettings);
        }
    }, [globalSettings, allMenuItems]);

    // Обновляем настройки
    const updateRoleVisibility = useCallback((role: UserRoles, field: keyof RoleMenuVisibility, value: any, checked: boolean) => {
        // HEADGLOBAL может редактировать только свою роль
        if (user?.role === UserRoles.HEADGLOBAL && role !== UserRoles.HEADGLOBAL) {
            return;
        }
        // Для других ролей проверяем canEdit
        if (user?.role !== UserRoles.HEADGLOBAL && !canEdit) {
            return;
        }
        
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
                    canAddDocuments: false,
                    canEditDocuments: false,
                    canDeleteDocuments: false,
                    canProcessDocuments: false
                };
            }

            const roleSettings = { ...newSettings[role] };
            
            // Для булевых полей (права на документы)
            if (field === 'canAddDocuments' || field === 'canEditDocuments' || 
                field === 'canDeleteDocuments' || field === 'canProcessDocuments') {
                roleSettings[field] = checked as any;
            } else {
                // Для массивов (видимость элементов меню)
                const currentArray = roleSettings[field] || [];
                if (checked) {
                    if (!currentArray.includes(value)) {
                        roleSettings[field] = [...currentArray, value] as any;
                    }
                } else {
                    roleSettings[field] = (currentArray as any[]).filter(item => item !== value) as any;
                }
            }

            newSettings[role] = roleSettings;
            return newSettings;
        });
    }, [canEdit, user?.role]);

    // Сохранение настроек
    const handleSave = useCallback(async () => {
        if (!token) {
            showMessage('Отсутствует токен', 'error', setMainData);
            return;
        }
        
        // HEADGLOBAL может сохранять только свою роль
        if (user?.role === UserRoles.HEADGLOBAL) {
            // Фильтруем настройки, оставляя только HEADGLOBAL
            const headGlobalSettings: MenuVisibilitySettings = {
                [UserRoles.HEADGLOBAL]: settings[UserRoles.HEADGLOBAL]
            };
            
            try {
                const config = {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                };
                
                // Загружаем текущие настройки
                const currentSettings = await getDataForSwr(globalSettingsUrl, token);
                const mergedSettings = { ...currentSettings, ...headGlobalSettings };
                
                const response = await axios.post(globalSettingsUrl, mergedSettings, config);
                console.log('Настройки сохранены:', response.data);
                showMessage('Глобальные настройки сохранены', 'success', setMainData);
                mutate();
                // Закрываем окно после успешного сохранения
                if (onClose) {
                    onClose();
                }
            } catch (error: any) {
                console.error('Ошибка при сохранении настроек:', error);
                const errorMessage = error.response?.data?.message || error.message || 'Ошибка при сохранении настроек';
                showMessage(errorMessage, 'error', setMainData);
            }
            return;
        }
        
        // Для других ролей проверяем canEdit
        if (!canEdit) {
            showMessage('Нет прав на редактирование', 'error', setMainData);
            return;
        }

        // Проверяем наличие токена
        if (!token) {
            console.error('Токен отсутствует:', { user, token });
            showMessage('Токен авторизации отсутствует. Пожалуйста, войдите в систему заново.', 'error', setMainData);
            return;
        }

        try {
            const config = {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };
            
            console.log('Отправка запроса с токеном:', { url: globalSettingsUrl, hasToken: !!token });
            const response = await axios.post(globalSettingsUrl, settings, config);
            console.log('Настройки сохранены:', response.data);
            showMessage('Глобальные настройки сохранены', 'success', setMainData);
            mutate();
            // Закрываем окно после успешного сохранения
            if (onClose) {
                onClose();
            }
        } catch (error: any) {
            console.error('Ошибка при сохранении настроек:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Ошибка при сохранении настроек';
            showMessage(errorMessage, 'error', setMainData);
        }
    }, [settings, token, canEdit, setMainData, mutate, globalSettingsUrl, user?.role, onClose]);

    // Проверяем, отмечен ли элемент
    const isChecked = (role: UserRoles, field: keyof RoleMenuVisibility, value?: any): boolean => {
        const roleSettings = settings[role];
        if (!roleSettings || !roleSettings[field]) {
            return false;
        }
        // Для булевых полей
        if (field === 'canAddDocuments' || field === 'canEditDocuments' || 
            field === 'canDeleteDocuments' || field === 'canProcessDocuments') {
            return roleSettings[field] === true;
        }
        // Для массивов
        return (roleSettings[field] as any[]).includes(value);
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Глобальные настройки видимости меню</h3>
            <p className={styles.description}>
                Настройки видимости меню для ролей с глобальной видимостью (GLOBAL роли).
                <br />
                <strong>Примечание:</strong> ADMINGLOBAL исключен из настроек, так как у него все элементы меню видны по умолчанию и все права включены.
                <br />
                {!canEdit && <strong>Режим просмотра: у вас нет прав на редактирование.</strong>}
            </p>
            
            {globalRoles.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    Нет ролей для настройки. Все GLOBAL роли имеют полный доступ по умолчанию.
                </div>
            )}
            
            {/* Отладочная информация */}
            {process.env.NODE_ENV === 'development' && (
                <div style={{ padding: '10px', background: '#f0f0f0', marginBottom: '20px', fontSize: '12px' }}>
                    <strong>Отладка:</strong><br />
                    Всего элементов меню: {allMenuItems.length}<br />
                    Документы: {itemsByType.documents.length}, 
                    Отчеты: {itemsByType.reports.length}, 
                    Inform отчеты: {itemsByType.informReports.length}, 
                    Справочники: {itemsByType.references.length}, 
                    Сервисы: {itemsByType.services.length}, 
                    КПП: {itemsByType.gates.length},
                    Мебель: {itemsByType.furniture.length}<br />
                    Ролей для настройки: {globalRoles.length}
                </div>
            )}

            {globalRoles.map(role => {
                // HEADGLOBAL может редактировать только свою роль, другие роли только просмотр
                const isReadOnly = (user?.role === UserRoles.HEADGLOBAL && role !== UserRoles.HEADGLOBAL) || 
                                  (user?.role !== UserRoles.HEADGLOBAL && !canEdit);
                
                return (
                    <div key={role} className={styles.roleSection}>
                        <h4 className={styles.roleTitle}>
                            {role}
                            {isReadOnly && <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9em' }}>(только просмотр)</span>}
                        </h4>

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
                                            disabled={isReadOnly}
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
                                            disabled={isReadOnly}
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
                                            disabled={isReadOnly}
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
                                            disabled={isReadOnly}
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
                                            disabled={isReadOnly}
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
                                            disabled={isReadOnly}
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
                                            disabled={isReadOnly}
                                        />
                                        <span>{item.description || item.value}</span>
                                    </label>
                                ))}
                                </div>
                            </div>
                        )}

                        {/* Права на документы */}
                        <div className={styles.typeSection}>
                            <h5 className={styles.typeTitle}>Права на документы</h5>
                            <div className={styles.itemsGrid}>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={isChecked(role, 'canAddDocuments')}
                                        onChange={(e) => updateRoleVisibility(role, 'canAddDocuments', undefined, e.target.checked)}
                                        disabled={isReadOnly}
                                    />
                                    <span>Может добавлять документы</span>
                                </label>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={isChecked(role, 'canEditDocuments')}
                                        onChange={(e) => updateRoleVisibility(role, 'canEditDocuments', undefined, e.target.checked)}
                                        disabled={isReadOnly}
                                    />
                                    <span>Может редактировать документы</span>
                                </label>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={isChecked(role, 'canDeleteDocuments')}
                                        onChange={(e) => updateRoleVisibility(role, 'canDeleteDocuments', undefined, e.target.checked)}
                                        disabled={isReadOnly}
                                    />
                                    <span>Может удалять документы</span>
                                </label>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={isChecked(role, 'canProcessDocuments')}
                                        onChange={(e) => updateRoleVisibility(role, 'canProcessDocuments', undefined, e.target.checked)}
                                        disabled={isReadOnly}
                                    />
                                    <span>Может проводить документы</span>
                                </label>
                            </div>
                        </div>
                    </div>
                );
            })}

            {(canEdit || user?.role === UserRoles.HEADGLOBAL) && (
                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                    <Button appearance='primary' onClick={handleSave}>
                        Сохранить
                    </Button>
                </div>
            )}
        </div>
    );
};

