'use client'
import styles from './menuSubGroup.module.css'
import cn from 'classnames';
import { MenuSubGroup as MenuSubGroupType } from '../../../../interfaces/menu.interface';
import { ContentType } from '../../../../interfaces/general.interface';
import { UserRoles } from '../../../../interfaces/user.interface';

interface MenuSubGroupProps {
    group: MenuSubGroupType;
    isOpened: boolean;
    isCollapsed: boolean;
    isExpanded: boolean;
    role?: UserRoles;
    onSubItemClick: (contentName: string, contentTitle: string, contentType: ContentType) => void;
    activeContentName?: string;
    activeContentType?: ContentType;
    mainPage?: boolean;
}

export default function MenuSubGroup({
    group,
    isOpened,
    isCollapsed,
    isExpanded,
    role,
    onSubItemClick,
    activeContentName,
    activeContentType,
    mainPage
}: MenuSubGroupProps): JSX.Element {
    
    return (
        <div className={cn(styles.subGroup, {
            [styles.isOpened]: isOpened
        })}>
            <div className={cn(styles.groupHeader, {
                [styles.isOpened]: isOpened
            })}>
                {group.title}
            </div>
            <div className={cn(styles.groupContent, {
                [styles.isOpened]: isOpened
            })}>
                {group.items.map((item, index) => {
                    // ADMINGLOBAL видит все элементы без проверки ролей
                    if (role !== UserRoles.ADMINGLOBAL && role && item.roles && !item.roles.includes(role)) {
                        return null;
                    }

                    const isActive = !mainPage
                        && activeContentName === item.title
                        && activeContentType === item.type;

                    return (
                        <div
                            key={index}
                            className={cn(styles.groupSubItem, {
                                [styles.active]: isActive
                            })}
                            onClick={() => onSubItemClick(item.title, item.description, item.type)}
                        >
                            {item.description || item.title}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
