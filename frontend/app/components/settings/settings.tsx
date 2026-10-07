'use client'
import { useEffect, useMemo, useState } from 'react';
import { SettingsProps } from './settings.props';
import styles from './settings.module.css';
import cn from 'classnames';
import { Button, Input} from '@/app/components';
import { Setting, SettingType } from '../../interfaces/settings.interface';
import { useAppContext } from '@/app/context/app.context';
import { UserRoles } from '@/app/interfaces/user.interface';
import { cancelSubmit, onSubmit } from './helpers/settings.functions';
import { RoleSelector } from './helpers/roleSelector';
import { WindowControls } from '@/app/components/common/windowControls/windowControls';
import { minimizeSettings } from '@/app/service/common/minimizeWindow';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { formatDateForInput, parseDateInputValue } from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';
import { Enterprise } from '@/app/interfaces/enterprise.interface';

export const Settings = ({ className, ...props }: SettingsProps) :JSX.Element => {

    const {mainData, setMainData} = useAppContext();
    const {isNewSetting, showSettingsWindow} = mainData.window
    const { user } = mainData.users
    const { currentSetting } = mainData.settings

    const defaultBody: Setting = {
        id: 0,
        key: '',
        type: SettingType.STRING,
        value: '',
        description: '',
        markToDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        allowedRoles: [],
        enterpriseId: null,
        isPereodic: false,
    }

    const [body, setBody] = useState<Setting>(defaultBody) 

    const token = user?.token;
    const isAdminGlobal = user?.role === UserRoles.ADMINGLOBAL;
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    const enterprisesUrl = isAdminGlobal ? `${domain}/api/enterprises/` : null;
    const { data: enterprisesData } = useSWR<Enterprise[]>(enterprisesUrl, (url: string) => getDataForSwr(url, token));
    const enterprises = useMemo(() => enterprisesData || [], [enterprisesData]);

    const changeElements = (e: React.FormEvent<HTMLInputElement>) => {
        let target = e.currentTarget
        let value = target.value
        let id = target.id

        setBody((state: Setting) => {
            if (id === 'key' || id === 'description' || id === 'minRoleForEdit') {
                return {
                    ...state,
                    [id]: value
                }
            } else if (id === 'value') {
                // Преобразуем значение в зависимости от типа
                let convertedValue: any = value;
                if (state.type === SettingType.NUMBER) {
                    convertedValue = parseFloat(value) || 0;
                } else if (state.type === SettingType.BOOLEAN) {
                    convertedValue = value === 'true';
                } else if (state.type === SettingType.DATE) {
                    const parsed = parseDateInputValue(value);
                    convertedValue = parsed != null ? new Date(parsed) : new Date(nowMs());
                }
                return {
                    ...state,
                    [id]: convertedValue
                }
            } 
            return state;
        })
    }

    const changeType = (type: SettingType) => {
        setBody((state: Setting) => {
            let defaultValue: any = '';
            if (type === SettingType.NUMBER) {
                defaultValue = 0;
            } else if (type === SettingType.BOOLEAN) {
                defaultValue = false;
            } else if (type === SettingType.JSON || type === SettingType.ARRAY) {
                defaultValue = {};
            } else if (type === SettingType.DATE) {
                defaultValue = new Date(nowMs());
            }
            
            return {
                ...state,
                type,
                value: defaultValue
            }
        })
    }

    const setAllowedRoles = (roles: string[]) => {
        setBody((state: Setting) => ({
            ...state,
            allowedRoles: roles
        }))
    }

    const changeEnterprise = (value: string) => {
        setBody((state: Setting) => ({
            ...state,
            enterpriseId: value === '' ? null : Number(value)
        }));
    };

    useEffect(() => {
        if (currentSetting && !isNewSetting) {
            // Обрабатываем значение даты при загрузке с сервера
            const processedSetting = { ...currentSetting };
            if (currentSetting.type === SettingType.DATE && typeof currentSetting.value === 'string') {
                processedSetting.value = new Date(currentSetting.value);
            }
            setBody(processedSetting)
        } else {
            setBody(defaultBody)
        }
    }, [currentSetting, isNewSetting])

    // Обработка клавиши Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showSettingsWindow) {
                cancelSubmit(setMainData);
            }
        };

        if (showSettingsWindow) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showSettingsWindow, setMainData]);

    const handleMinimize = () => {
        if (!setMainData) return;
        minimizeSettings(mainData, setMainData);
    };

    return (
        <div className={cn(styles.settingsBox, 
            {[styles.newSetting] : isNewSetting},
            {[styles.boxClose] : !showSettingsWindow})}>
            
            <div className={styles.header}>
                <h3 className={styles.title}>
                    {isNewSetting ? 'Янги хусусият тузиш' : 'Хусусиятни таҳрирлаш'}
                </h3>
                <WindowControls
                    onMinimize={handleMinimize}
                    onClose={() => cancelSubmit(setMainData)}
                    className={styles.windowControls}
                />
            </div>

            <Input 
                label={'Калит'} 
                value={body.key} 
                type="text" 
                id='key' 
                className={styles.input} 
                onChange={(e)=>changeElements(e)}
            />

            <div className={styles.typeSelector}>
                <label className={styles.label}>Тип:</label>
                <select 
                    value={body.type} 
                    onChange={(e) => changeType(e.target.value as SettingType)}
                    className={styles.select}
                >
                    <option value={SettingType.STRING}>Строка</option>
                    <option value={SettingType.NUMBER}>Число</option>
                    <option value={SettingType.BOOLEAN}>Логический</option>
                    <option value={SettingType.JSON}>JSON</option>
                    <option value={SettingType.ARRAY}>Массив</option>
                    <option value={SettingType.DATE}>Дата</option>
                </select>
            </div>

            <Input 
                label={'Киймат'} 
                value={
                    body.type === SettingType.DATE 
                        ? (() => {
                            if (body.value instanceof Date) {
                                return formatDateForInput(body.value.getTime());
                            } else if (typeof body.value === 'number' && Number.isFinite(body.value)) {
                                return formatDateForInput(body.value);
                            } else if (typeof body.value === 'string' && body.value) {
                                if (/^\d{4}-\d{2}-\d{2}/.test(body.value)) {
                                    return body.value.slice(0, 10);
                                }
                                const date = new Date(body.value);
                                return isNaN(date.getTime()) ? '' : formatDateForInput(date.getTime());
                            }
                            return '';
                        })()
                        : body.value?.toString() || ''
                } 
                type={
                    body.type === SettingType.NUMBER 
                        ? "number" 
                        : body.type === SettingType.DATE 
                            ? "date" 
                            : "text"
                } 
                id='value' 
                className={styles.input} 
                onChange={(e)=>changeElements(e)}
            />

            <Input 
                label={'Изох'} 
                value={body.description} 
                type="text" 
                id='description' 
                className={styles.input} 
                onChange={(e)=>changeElements(e)}
            />

            {isAdminGlobal && (
                <div className={styles.typeSelector}>
                    <label className={styles.label}>Организация:</label>
                    <select
                        value={(body.enterpriseId ?? '').toString()}
                        onChange={(e) => changeEnterprise(e.target.value)}
                        className={styles.select}
                    >
                        <option value=''>Глобальная настройка</option>
                        {enterprises.map((enterprise) => (
                            <option key={enterprise.id} value={enterprise.id}>
                                {enterprise.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {isAdminGlobal && (
                <div className={styles.typeSelector}>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={body.isPereodic || false}
                            onChange={(e) => setBody((state) => ({
                                ...state,
                                isPereodic: e.target.checked,
                            }))}
                        />
                        Даврий (сана бўйича қийматлар)
                    </label>
                </div>
            )}

            {user?.role === UserRoles.ADMINGLOBAL && (
                <RoleSelector 
                    selectedRoles={body.allowedRoles || []}
                    onRolesChange={setAllowedRoles}
                />
            )}

            <div className={styles.buttons}>
                <Button 
                    appearance='primary' 
                    onClick={() => onSubmit(
                        body, 
                        setMainData, 
                        user?.token, 
                        user?.enterpriseId ?? null
                    )}
                >
                    Сақлаш
                </Button>
                <Button 
                    appearance='ghost' 
                    onClick={() => cancelSubmit(setMainData)}
                >
                    Бекор қилиш
                </Button>
            </div>
        </div>
    )
}
