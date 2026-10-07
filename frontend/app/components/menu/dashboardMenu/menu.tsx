'use client'
import styles from './menu.module.css'
import {MenuProps} from './menu.props';
import IcoHome from './icons/ico/home.svg';
import { MenuData } from '@/app/data/menu';
import MenuItems from '../menuItems/menuItems';
import { useAppContext } from '@/app/context/app.context';
import { Maindata } from '@/app/context/app.context.interfaces';
import { filterMenuByEnterpriseSettings } from '@/app/utils/menuFilter';
import { useMemo } from 'react';
import { UserRoles } from '@/app/interfaces/user.interface';

export default function Menu({className, ...props}:MenuProps):JSX.Element {
    const {mainData, setMainData} = useAppContext()
    const { user } = mainData.users;
    const { menuVisibility } = mainData.enterpriseSettings;
    
    const goToMainPage = (setMainData: Function| undefined, mainData: Maindata) => {
      setMainData && setMainData('mainPage', true)
    }

    // Фильтруем меню на основе настроек предприятия
    const filteredMenuData = useMemo(() => {
        // ADMIN всегда видит всё меню без фильтрации
        if (user?.role === UserRoles.ADMINGLOBAL) {
            return MenuData;
        }

        if (!user?.role || !user?.enterpriseId) {
            // Если нет роли или enterpriseId, используем исходное меню
            return MenuData;
        }

        // Если есть настройки видимости, применяем фильтрацию
        if (menuVisibility) {
            return filterMenuByEnterpriseSettings(MenuData, user.role, menuVisibility);
        }

        // Если настройки не заданы, возвращаем пустой массив (whitelist подход)
        return [];
    }, [user?.role, user?.enterpriseId, menuVisibility]);

    return (
        <>
           <div className={styles.menu}>
            <div className={styles.menuBtn} onClick={() => goToMainPage(setMainData, mainData)}>
              <IcoHome className={styles.icoHome}/>
              Меню
            </div>
            <div className={styles.menuItems}>
              <MenuItems menuData={filteredMenuData}/>
            </div>
          </div>
        </>
    )
}
