"use client"
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { defaultMainData } from './app.context.constants';
import { IAppContext, Maindata } from './app.context.interfaces';
import { set} from 'lodash'
import { AUTH_LOGOUT_EVENT, clearStoredUser, getStoredUser, setStoredUser } from '@/app/service/common/authStorage';
import { loadEnterpriseMenuConfig } from '@/app/service/enterprises/loadEnterpriseMenuConfig';
import { User } from '@/app/interfaces/user.interface';
import { ensureServerNowSynced } from '@/app/utils/serverNow';

const appContextDefaultValues: IAppContext = {
  mainData: {...defaultMainData},
  setMainData: () => {},
};

const AppContext = createContext<IAppContext>(appContextDefaultValues);

export function useAppContext() {
    return useContext(AppContext);
}

type Props = {
    children: ReactNode;
};

const keyWithParent = (key: string, obj: Maindata): string => {
    if (key in obj.document) return `document.${key}`
    if (key in obj.document.currentDocument) return `document.currentDocument.${key}`
    if (key in obj.journal) return `journal.${key}`
    if (key in obj.reference) return `reference.${key}`
    if (key in obj.settings) return `settings.${key}`
    if (key in obj.report) return `report.${key}`
    if (key in obj.users) return `users.${key}`
    if (key in obj.window) return `window.${key}`
    if (key in obj.platform) return `platform.${key}`
    if (key in obj.pereodic) return `pereodic.${key}`
    if (key in obj.settingPereodic) return `settingPereodic.${key}`
    if (key in obj.enterprises) return `enterprises.${key}`
    if (key in obj.enterpriseSettings) return `enterpriseSettings.${key}`
    if (key in obj) return key
    return ''
}

const isUserKey = (key: string, resolvedKey: string) =>
    key === 'user' || key === 'users.user' || resolvedKey === 'users.user';

export function AppProvider({ children }: Props) {
    
    const [data, setData] = useState<Maindata>(defaultMainData);
    const setMainData = useCallback((key: string, value: any) => {
        setData(currentData => {
            let newObj = {...currentData}
            // null/undefined: typeof null === 'object', и {...null} даёт {} — ломает очистку полей (inlineCreation и т.д.) и циклы в эффектах.
            let newValue =
                value === null || value === undefined
                    ? value
                    : typeof value != 'object'
                      ? value
                      : Array.isArray(value)
                        ? [...value]
                        : {...value}
            
            if (key.includes('.')) {
                set(newObj, key, newValue)
                if (isUserKey(key, key)) {
                    if (newValue === undefined || newValue === null) {
                        clearStoredUser(currentData.users.user);
                    } else {
                        setStoredUser(newValue as User);
                    }
                }
                return newObj
            } else {
                let newKey = keyWithParent(key, currentData)
                
                if (newKey) {
                    set(newObj, newKey, newValue)
                    if (isUserKey(key, newKey)) {
                        if (newValue === undefined || newValue === null) {
                            clearStoredUser(currentData.users.user);
                        } else {
                            setStoredUser(newValue as User);
                        }
                    }
                    return newObj
                } else {
                    if (key in currentData) {
                        (newObj as any)[key] = newValue;
                        return newObj;
                    }
                }
            }
            return currentData;
        });
    }, []);

    // Восстановление после mount из sessionStorage этой вкладки (не в useState — иначе рассинхрон SSR/hydration).
    // Не подписываемся на storage: чужой вход в другой вкладке не должен менять эту сессию.
    useEffect(() => {
        ensureServerNowSynced();
        const storedUser = getStoredUser();
        if (storedUser) {
            setMainData('user', storedUser);
        }
    }, [setMainData]);

    useEffect(() => {
        const onLogout = () => {
            setMainData('user', undefined);
        };
        window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
        return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
    }, [setMainData]);

    // После восстановления сессии из storage подтягиваем меню предприятия (как при логине).
    useEffect(() => {
        const user = data.users.user;
        if (!user?.enterpriseId || !user?.token) return;
        if (data.enterpriseSettings.menuVisibility) return;

        let cancelled = false;
        loadEnterpriseMenuConfig(user.enterpriseId, user.token)
            .then((menuVisibility) => {
                if (cancelled || !menuVisibility) return;
                setMainData('enterpriseSettings', { menuVisibility });
            })
            .catch(() => {
                // ignore — меню останется без ограничений видимости
            });

        return () => {
            cancelled = true;
        };
    }, [
        data.users.user?.id,
        data.users.user?.enterpriseId,
        data.users.user?.token,
        data.enterpriseSettings.menuVisibility,
        setMainData,
    ]);

    const value = {
        mainData: data,
        setMainData,
    };

    return (
        <>
            <AppContext.Provider value={value}>
                {children}
            </AppContext.Provider>
        </>
    );
}
