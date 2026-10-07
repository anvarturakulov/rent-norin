'use client'
import { SidebarProps } from './sidebar.props';
import styles from './sidebar.module.css';
import cn from 'classnames';
import MenuItems from '../menu/menuItems/menuItems';
import { MenuData } from '@/app/data/menu';
import ExitIcon from './ico/exit.svg';
import CloseIcon from './ico/close.svg';
import ToggleIcon from './ico/toggle.svg';
import { useAppContext } from '@/app/context/app.context';
import { useState, useEffect, useMemo, useRef } from 'react';
import { filterMenuByEnterpriseSettings } from '@/app/utils/menuFilter';
import { UserRoles } from '@/app/interfaces/user.interface';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';

export const Sidebar = ({
    className,
    onStateChange,
    autoCollapseKey,
    ...props
}: SidebarProps & {
    onStateChange?: (isCollapsed: boolean, isExpanded: boolean) => void;
    /** Непустой ключ = открыт документ: сворачиваем панель вместе с гридом лейаута; пустой = выход из документа. */
    autoCollapseKey?: string;
}) => {
    const {mainData, setMainData} = useAppContext()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const prevAutoCollapseKeyRef = useRef<string | undefined>(undefined);
    const { user } = mainData.users;
    const { menuVisibility } = mainData.enterpriseSettings;
    const token = user?.token;
    const isGlobal = user?.role && isGlobalRole(user.role);
    
    // Загружаем предприятия для отображения названия организации
    const { data: enterprises } = useSWR(
        token ? 'enterprises' : null,
        () => getEnterprises(token)
    );
    
    // Загружаем глобальные настройки для GLOBAL ролей
    const globalSettingsUrl = isGlobal && token 
        ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings/global/menuVisibility`
        : null;
    const { data: globalMenuVisibility } = useSWR(
        globalSettingsUrl,
        (url) => getDataForSwr(url, token)
    );
    
    // Получаем название организации
    const enterpriseName = useMemo(() => {
        if (isGlobal) {
            return 'Глобал корхоналар';
        }
        if (!user?.enterpriseId || !enterprises || !Array.isArray(enterprises)) {
            return '???????';
        }
        const enterprise = enterprises.find((item: any) => item.id === user.enterpriseId);
        return enterprise?.name || '??????';
    }, [isGlobal, user?.enterpriseId, enterprises]);
    
    const exit = ( setMaindata: Function | undefined ) => {
        setMainData && setMainData('user', undefined);
        setMainData && setMainData('mainPage', true);
    }

    // Синхронизация с dashboard layout: колонка грида сжимается при документе, ширина .sidebar должна совпадать.
    useEffect(() => {
        const key = autoCollapseKey ?? '';
        const prev = prevAutoCollapseKeyRef.current;
        prevAutoCollapseKeyRef.current = key;

        if (prev === undefined) {
            if (key) {
                setIsCollapsed(true);
            }
            return;
        }
        if (!key && prev) {
            setIsCollapsed(false);
            return;
        }
        if (key && prev !== key) {
            setIsCollapsed(true);
        }
    }, [autoCollapseKey]);

    // Уведомляем родительский компонент об изменении состояния
    useEffect(() => {
        if (onStateChange) {
            onStateChange(isCollapsed, false);
        }
    }, [isCollapsed, onStateChange]);

    const handleToggleCollapse = () => {
        setIsCollapsed(!isCollapsed)
    }

    // 🔍 ФИЛЬТРАЦИЯ МЕНЮ ПО НАСТРОЙКАМ ПРЕДПРИЯТИЯ ИЛИ ГЛОБАЛЬНЫМ НАСТРОЙКАМ
    const filteredMenuData = useMemo(() => {
        // ADMINGLOBAL всегда видит всё меню без фильтрации
        if (user?.role === UserRoles.ADMINGLOBAL) {
            return MenuData;
        }

        if (!user?.role) {
            // Если нет роли, используем исходное меню
            return MenuData;
        }

        // Для GLOBAL ролей используем глобальные настройки
        if (isGlobal) {
            if (globalMenuVisibility) {
                return filterMenuByEnterpriseSettings(MenuData, user.role, globalMenuVisibility);
            }
            // Если глобальные настройки не заданы, возвращаем пустой массив (whitelist подход)
            return [];
        }

        // Для обычных ролей используем настройки предприятия
        if (!user?.enterpriseId) {
            // Если нет enterpriseId, используем исходное меню
            return MenuData;
        }

        if (menuVisibility) {
            // Применяем фильтрацию на основе настроек предприятия
            return filterMenuByEnterpriseSettings(MenuData, user.role, menuVisibility);
        }

        // Если настройки не заданы, возвращаем пустой массив (whitelist подход)
        return [];
    }, [user?.role, user?.enterpriseId, menuVisibility, isGlobal, globalMenuVisibility]);

    return (
        <div 
            className={cn(styles.sidebar, className, {
                [styles.collapsed]: isCollapsed
            })} 
            {...props}
        >
            <div className={cn(styles.header, {
                [styles.collapsed]: isCollapsed
            })}>
                {!isCollapsed && (
                    <>
                        <h2>KORD ERP</h2>
                        <div className={styles.enterpriseName}>{`${enterpriseName} (${user?.name})`}</div>
                    </>
                )}
                <button 
                    className={styles.collapseButton}
                    onClick={handleToggleCollapse}
                    title={isCollapsed ? "Развернуть" : "Свернуть"}
                >
                    {isCollapsed ? <ToggleIcon data-icon="toggle" /> : <CloseIcon data-icon="close" />}
                </button>
            </div>
            <div className={styles.menu}>
                <MenuItems 
                    menuData={filteredMenuData} 
                    isCollapsed={isCollapsed}
                    isExpanded={false}
                />
            </div>
            <div className={cn(styles.footer, {
                [styles.collapsed]: isCollapsed
            })}>
                <div className={styles.itemBox} onClick={() => exit(setMainData)}>
                    <div className={styles.titleIcon}>
                        <ExitIcon/>
                    </div>
                    {!isCollapsed && (
                        <div className={styles.titleBox}>
                            Чикиш
                            <div className={styles.titleText}>
                                Дастурда ишни якунлаш
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 