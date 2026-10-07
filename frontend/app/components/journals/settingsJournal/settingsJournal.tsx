'use client'
import styles from './settingsJournal.module.css'
import cn from 'classnames';
import IcoTrash from './ico/trash.svg'
import IcoView from './ico/view.svg'
import { useEffect, useState } from 'react';
import { Settings } from '../../settings/settings';
import { Setting } from '../../../interfaces/settings.interface';
import useSWR from 'swr';
import { SettingsJournalProps } from './settingsJournal.props';
import { useAppContext } from '@/app/context/app.context';
import Header from '../../common/header/header';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getSetting, markToDelete } from '../../settings/helpers/settings.functions';
import { UserRoles } from '@/app/interfaces/user.interface';
import { formatDateForInput } from '@/app/utils/dateInput';
import { GlobalMenuSettingsComponent } from '../../settings/globalMenuSettings/globalMenuSettings';
import { Button } from '@/app/components';
import { SettingPereodicsListWindow } from '../../settings/settingPereodicsListWindow/settingPereodicsListWindow';
import { exportUploadsFolder } from '@/app/service/upload/exportUploads';

export default function SettingsJournal({className, ...props}: SettingsJournalProps): JSX.Element {
    
    const {mainData, setMainData} = useAppContext();
    const { showSettingsWindow } = mainData.window;
    const { user } = mainData.users;
    const { updateDataForSettingsJournal } = mainData.journal
    const targetEnterpriseId = mainData.report?.selectedEnterpriseId ?? user?.enterpriseId ?? null;
    const singleEnterpriseMode = mainData.settings?.singleEnterpriseMode ?? false;
    const token = user?.token;
    const settingsBaseUrl = `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings`;
    // Для ADMINGLOBAL загружаем все настройки без фильтра по enterpriseId
    // Для остальных ролей используем фильтр по enterpriseId
    const url = user?.role === UserRoles.ADMINGLOBAL
        ? `${settingsBaseUrl}/`
        : (targetEnterpriseId !== null && targetEnterpriseId !== undefined
            ? `${settingsBaseUrl}?enterpriseId=${targetEnterpriseId}`
            : `${settingsBaseUrl}/`);
    const [showGlobalSettings, setShowGlobalSettings] = useState(false);
    const [isExportingUploads, setIsExportingUploads] = useState(false);
    const [exportUploadsProgress, setExportUploadsProgress] = useState('');

    const { data, mutate, error } = useSWR(url, (url) => getDataForSwr(url, token));

    useEffect(() => {
        mutate()
        setMainData && setMainData('updateDataForSettingsJournal', false);
    }, [showSettingsWindow, updateDataForSettingsJournal, targetEnterpriseId])


    // Фильтруем настройки по ролям пользователя
    // Для ADMINGLOBAL показываем все настройки независимо от allowedRoles
    const filteredData = data?.filter((setting: Setting) => {
        // ADMINGLOBAL видит все настройки
        if (user?.role === UserRoles.ADMINGLOBAL) {
            return true;
        }
        // Для остальных ролей применяем стандартную фильтрацию
        if (!setting.allowedRoles || setting.allowedRoles.length === 0) {
            return true; // Если роли не указаны, показываем всем
        }
        return !!(user?.role && setting.allowedRoles.includes(user.role));
    }) || [];

    const getTypeDisplayName = (type: string) => {
        const typeNames: { [key: string]: string } = {
            'STRING': 'Строка',
            'NUMBER': 'Число',
            'BOOLEAN': 'Логический',
            'JSON': 'JSON',
            'ARRAY': 'Массив',
            'DATE': 'Дата',
        };
        return typeNames[type] || type;
    };

    const getValueDisplay = (value: any, type: string) => {
        if (type === 'BOOLEAN') {
            return value ? 'Да' : 'Нет';
        }
        if (type === 'JSON' || type === 'ARRAY') {
            return JSON.stringify(value);
        }
        if (type === 'DATE' && value) {
            const date = value instanceof Date ? value : new Date(value);
            if (!isNaN(date.getTime())) {
                return formatDateForInput(date.getTime());
            }
        }
        return value?.toString() || '';
    };

    // Проверка прав на редактирование настройки
    const canEditSetting = (setting: Setting): boolean => {
        // ADMINGLOBAL может редактировать все настройки
        if (user?.role === UserRoles.ADMINGLOBAL) {
            return true;
        }
        
        // HEADGLOBAL может редактировать только настройки, где HEADGLOBAL в allowedRoles
        if (user?.role === UserRoles.HEADGLOBAL) {
            if (!setting.allowedRoles || setting.allowedRoles.length === 0) {
                return false; // Если роли не указаны, HEADGLOBAL не может редактировать
            }
            return setting.allowedRoles.includes(UserRoles.HEADGLOBAL);
        }
        
        // HEADCOMPANY может редактировать настройки, где HEADCOMPANY в allowedRoles или роли не указаны
        if (user?.role === UserRoles.HEADCOMPANY) {
            if (!setting.allowedRoles || setting.allowedRoles.length === 0) {
                return true; // Если роли не указаны, разрешаем для обратной совместимости
            }
            return setting.allowedRoles.includes(UserRoles.HEADCOMPANY);
        }
        
        // Для других ролей проверяем наличие роли в allowedRoles
        if (!setting.allowedRoles || setting.allowedRoles.length === 0) {
            return true; // Если роли не указаны, разрешаем для обратной совместимости
        }
        return !!(user?.role && setting.allowedRoles.includes(user.role));
    };

    const openPereodicsList = (setting: Setting) => {
        if (setMainData) {
            setMainData('settingIdForPereodicsList', setting.id);
            setMainData('settingKeyForPereodicsList', setting.key);
            const scopeEnt =
                setting.enterpriseId != null && Number(setting.enterpriseId) > 0
                    ? Number(setting.enterpriseId)
                    : null;
            setMainData('pereodicScopeEnterpriseId', scopeEnt);
            setMainData('showSettingPereodicsListWindow', true);
        }
    };

    const handleExportUploads = async () => {
        if (!token || user?.role !== UserRoles.ADMINGLOBAL) {
            return;
        }

        setIsExportingUploads(true);
        setExportUploadsProgress('');

        try {
            await exportUploadsFolder(
                token,
                setMainData,
                (message, partNumber, totalParts) => {
                    if (partNumber && totalParts) {
                        const percent = Math.round((partNumber / totalParts) * 100);
                        setExportUploadsProgress(`${message} (${percent}%)`);
                    } else {
                        setExportUploadsProgress(message);
                    }
                },
            );
        } catch (error: any) {
            console.error('Ошибка экспорта uploads:', error);
        } finally {
            setIsExportingUploads(false);
            setExportUploadsProgress('');
        }
    };

    return (
        <>  
            <Header windowFor='settings' />
            <SettingPereodicsListWindow />
            {user?.role === UserRoles.ADMINGLOBAL && (
                <div style={{ padding: '10px', textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button
                        appearance='ghost'
                        onClick={handleExportUploads}
                        disabled={isExportingUploads}
                        title='Скачать всю папку uploads в виде ZIP архива (кроме uploads/exports)'
                    >
                        {isExportingUploads
                            ? (exportUploadsProgress || 'Экспорт uploads...')
                            : 'Скачать uploads'}
                    </Button>
                    {!singleEnterpriseMode && (
                        <Button 
                            appearance='primary' 
                            onClick={() => setShowGlobalSettings(true)}
                        >
                            Глобальные настройки интерфейса
                        </Button>
                    )}
                </div>
            )}
            {showGlobalSettings && (
                <div 
                    className={styles.newElement}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowGlobalSettings(false);
                        }
                    }}
                >
                    <div style={{ maxWidth: '90%', maxHeight: '90%', overflow: 'auto', background: 'white', padding: '20px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2>Глобальные настройки интерфейса</h2>
                            <Button appearance='ghost' onClick={() => setShowGlobalSettings(false)}>Закрыть</Button>
                        </div>
                        <GlobalMenuSettingsComponent onClose={() => setShowGlobalSettings(false)} />
                    </div>
                </div>
            )}
            {showSettingsWindow && (
                <div 
                    className={styles.newElement}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setMainData && setMainData('showSettingsWindow', false);
                        }
                    }}
                >
                    <Settings/>
                </div>
            )}
            <div className={styles.container} >
                {error && (
                    <div style={{ color: 'red', padding: '20px', textAlign: 'center' }}>
                        Ошибка загрузки данных: {error.message}
                    </div>
                )}
                {!data && !error && (
                    <div style={{ color: 'blue', padding: '20px', textAlign: 'center' }}>
                        Загрузка данных...
                    </div>
                )}
                {data && data.length === 0 && (
                    <div style={{ color: 'orange', padding: '20px', textAlign: 'center' }}>
                        Настройки не найдены. Создайте первую настройку.
                    </div>
                )}
                {filteredData && filteredData.length === 0 && data && data.length > 0 && (
                    <div style={{ color: 'orange', padding: '20px', textAlign: 'center' }}>
                        Нет настроек, доступных для вашей роли.
                    </div>
                )}
                {filteredData && filteredData.length > 0 && (
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr key = {-1}>
                                <th className={styles.rowId}>№</th>
                                <th className={styles.key}>Калит</th>
                                <th className={styles.type}>Тип</th>
                                <th className={styles.value}>Значение</th>
                                <th className={styles.description}>Описание</th>
                                <th className={styles.enterprise}>Организация</th>
                                <th className={styles.roles}>Роли</th>
                                <th className={styles.rowAction}>Амал</th>
                            </tr>
                        </thead>
                        <tbody className={styles.tbody}>
                            {filteredData
                            .filter((item: Setting) => !item.markToDeleted)
                            .map((item: Setting, key: number) => {
                                return (
                                <tr 
                                    key={item.id} 
                                    onDoubleClick={() => {
                                        if (canEditSetting(item) && setMainData) {
                                            getSetting(item.id, setMainData, token);
                                        }
                                    }} 
                                    className={cn(className, {
                                            [styles.deleted]: item.markToDeleted,
                                            [styles.trRow]: 1,
                                        })}   
                                >
                                    <td className={styles.rowId}>{item.id}</td>
                                    <td className={styles.key}>{item.key}</td>
                                    <td className={styles.type}>{getTypeDisplayName(item.type)}</td>
                                    <td className={styles.value}>{getValueDisplay(item.value, item.type)}</td>
                                    <td className={styles.description}>{item.description}</td>
                                    <td className={styles.enterprise}>
                                        {item.enterprise?.name || 'Глобальная'}
                                    </td>
                                    <td className={styles.roles}>
                                        {item.allowedRoles?.join(', ') || 'Все'}
                                    </td>
                                    <td className={styles.rowAction}>
                                        <IcoView 
                                            className={cn(className, styles.icoView)}  
                                            onClick={() => {
                                                if (canEditSetting(item) && setMainData) {
                                                    getSetting(item.id, setMainData, token);
                                                }
                                            }}
                                        />
                                        {item.isPereodic && (
                                            <button
                                                className={styles.pereodicBtn}
                                                title="Даврий қийматлар"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openPereodicsList(item);
                                                }}
                                            >
                                                Тарих
                                            </button>
                                        )}
                                        {user?.role === UserRoles.ADMINGLOBAL && (
                                            <IcoTrash 
                                                className={cn(className, styles.icoTrash, {
                                                    [styles.deleted]: item.markToDeleted,
                                                })}  
                                                onClick={() => markToDelete(item.id, item.key, token, setMainData)}
                                            />
                                        )}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    )
}
