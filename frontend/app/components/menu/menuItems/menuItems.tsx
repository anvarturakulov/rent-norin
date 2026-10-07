'use client'
import styles from './menuItems.module.css'
import cn from 'classnames';
import {MenuItemsProps} from './menuItems.props'
import { useEffect, useState } from 'react';
import { MenuItem } from '../../../interfaces/menu.interface';
import { ContentType } from '../../../interfaces/general.interface';
import { useAppContext } from '@/app/context/app.context';
import { UserRoles } from '@/app/interfaces/user.interface';
import { getKeyEnum } from '@/app/service/common/getKeyEnum';
import { ReportOptions, ReportType, Schet } from '@/app/interfaces/report.interface';
import { setNewDocumentParams } from '@/app/service/documents/setNewDocumentParams';
import { defaultReportOptions } from '@/app/context/app.context.helpers.constants';
import Icons from '../dashboardMenu/icons/icons';
import { goToMainPage } from '@/app/service/common/goToMainPage';
import { autoMinimizeOpenEditors, resetReferenceEditorState } from '@/app/service/common/minimizeWindow';
import { useGlobalReservationCleanup } from '@/app/context/websocket.context';
import MenuSubGroup from './menuSubGroup/menuSubGroup';   
import { Maindata } from '@/app/context/app.context.interfaces';

export default function MenuItems({menuData, className, isCollapsed = false, isExpanded = false, onMenuItemClick, onSubItemClick, ...props}:MenuItemsProps):JSX.Element {
    
    const [menu, setMenu] = useState<Array<MenuItem>>([])
    
    const {mainData, setMainData} = useAppContext()
    const { user } = mainData.users
    const { contentName, contentType: activeContentType } = mainData.document
    const { mainPage } = mainData.window
    const role = user?.role;
    const { clearAllGlobalReservations } = useGlobalReservationCleanup();

    const isSubItemActive = (title: string, type: ContentType) =>
        !mainPage && contentName === title && activeContentType === type;

    const onClickItem = (e:any,currentTitle:string, itemIndex:number) => {
        
        let newMenu = [...menu]
        newMenu.map(item => {
            if (item.title == currentTitle) {
                return item.isOpened = !item.isOpened
            } else {
                return item.isOpened = false
            }
        })
        if (itemIndex == 0) {
            goToMainPage(setMainData, mainData)
            // return
        }
        setMenu(newMenu)
        
        // Вызываем callback для разворачивания sidebar при клике на menuItem
        if (onMenuItemClick) {
            onMenuItemClick();
        }
    }

    const onClickSubItem = (contentName: string, contentTitle: string, contentType: ContentType) => {
        // Схлопнуть раскрытый список субменю
        setMenu(prev => prev.map(item => ({ ...item, isOpened: false })));

        const keyItem = getKeyEnum(contentName, contentType)
        
        // Очищаем все резервы при переходе на другой документ
        clearAllGlobalReservations();
        
        if (setMainData) {
            autoMinimizeOpenEditors(mainData, setMainData);
            if (contentType == 'reference') {
                resetReferenceEditorState(setMainData);
            }
            setMainData('activeMenuKey', keyItem);
            setMainData('contentType', contentType);
            setMainData('contentTitle', contentTitle);
            setMainData('contentName', contentName);
            setMainData('mainPage', false);
            setMainData('clearControlElements', true);
            
            if (contentType == 'document') {
                setNewDocumentParams(setMainData, mainData)
            }

            if (contentType == 'report') {
                let defValue = {...defaultReportOptions};
                const newReportOptions:ReportOptions = {
                    ...defValue,
                    startReport: false,
                    ...(contentName === ReportType.MatOborot ? { schet: Schet.S10 } : {}),
                }
                setMainData('reportOption', { ...newReportOptions });
            }

                if (contentType == 'informReport') {
                console.log('📋 [menuItems] Клик на informReport:', contentName);
                // Для inform отчетов устанавливаем dashboardCurrentReportType и показываем главную страницу
                setMainData('dashboardCurrentReportType', contentName);
                setMainData('mainPage', true);
                console.log('📋 [menuItems] Установлен dashboardCurrentReportType:', contentName);
                console.log('📋 [menuItems] Установлен mainPage: true');
            }
        };
        
        // Сворачиваем sidebar после выбора subItem
        if (onSubItemClick) {
            onSubItemClick();
        }
    }

    useEffect(()=> {
       setMenu(menuData) 
    },[menuData])

    return (
    <>
        {menu.map((item, i) => {
            return (
                <ul 
                    className={styles.ul}
                    key = {i}
                >
                    <li
                        className={cn(styles.item,{
                            [styles.active]: item.isOpened
                        })}
                        onClick={(e)=>onClickItem(e,item.title, i)}
                        key={item.title+i}
                        data-type = {'firstLevel'}
                    >
                        <div className={cn(styles.itemBox, {
                            [styles.collapsed]: isCollapsed && !isExpanded
                        })}>
                            <div className={styles.titleIcon}>
                                <Icons title={item.title} />
                            </div>
                            {(!isCollapsed || isExpanded) && (
                                <div className={styles.titleBox}>
                                    {item.title}
                                    <div className={styles.titleText}>
                                        {item.titleText}
                                    </div>
                                </div>
                            )}
                        </div>
                    </li>
                    {
                        // Отображаем обычные subMenu элементы
                        item.subMenu.length>0 && (!isCollapsed || isExpanded) && (
                            item.subMenu.map((elem,k)=> {
                                // ADMINGLOBAL видит все элементы без проверки ролей
                                // Если у элемента нет roles, показываем его (нет ограничений)
                                if (role === UserRoles.ADMINGLOBAL || !elem.roles || (role && elem.roles.includes(role))) 
                                    return (
                                        <li 
                                            className={cn(styles.subItem, {
                                                [styles.isOpened]: item.isOpened,
                                                [styles.active]: isSubItemActive(elem.title, elem.type)
                                            })}
                                            onClick={() => onClickSubItem(elem.title, elem.description, elem.type)}
                                            key={k}
                                        >
                                            {elem.description? elem.description : elem.title}
                                        </li>
                                    )
                                })
                        )
                    }
                    {
                        // Отображаем группы подменю
                        item.subGroups && item.subGroups.length>0 && (!isCollapsed || isExpanded) && (
                            <div className={styles.groupsContainer}>
                                {item.subGroups.map((group, groupIndex) => (
                                    <MenuSubGroup
                                        key={groupIndex}
                                        group={group}
                                        isOpened={item.isOpened}
                                        isCollapsed={isCollapsed}
                                        isExpanded={isExpanded}
                                        role={role}
                                        onSubItemClick={onClickSubItem}
                                        activeContentName={contentName}
                                        activeContentType={activeContentType}
                                        mainPage={mainPage}
                                    />
                                ))}
                            </div>
                        )
                    }
                </ul>
                    
            )
        })
        }
    </>
    )
}
