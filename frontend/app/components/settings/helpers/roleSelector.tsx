'use client'
import { useState } from 'react';
import { UserRoles } from '@/app/interfaces/user.interface';
import styles from './roleSelector.module.css';
import cn from 'classnames';

interface RoleSelectorProps {
    selectedRoles: string[];
    onRolesChange: (roles: string[]) => void;
}

export const RoleSelector = ({ selectedRoles, onRolesChange }: RoleSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const allRoles = Object.values(UserRoles);

    const toggleRole = (role: string) => {
        const newRoles = selectedRoles.includes(role)
            ? selectedRoles.filter(r => r !== role)
            : [...selectedRoles, role];
        onRolesChange(newRoles);
    };

    const getRoleDisplayName = (role: string) => {
        const roleNames: { [key: string]: string } = {
            [UserRoles.ADMINGLOBAL]: 'ADMINGLOBAL',
            [UserRoles.HEADGLOBAL]: 'HEADGLOBAL',
            [UserRoles.HEADCOMPANY]: 'HEADCOMPANY',
            [UserRoles.GLAVBUX]: 'GLAVBUX',
            [UserRoles.GUEST]: 'GUEST',
            [UserRoles.KASSIR]: 'KASSIR',
            [UserRoles.KASSIRGLOBAL]: 'KASSIRGLOBAL',
            [UserRoles.ZAVSKLAD]: 'ZAVSKLAD',
            [UserRoles.SCALING]: 'SCALING',
            [UserRoles.DRAWING]: 'DRAWING',
            [UserRoles.DELIVERY]: 'DELIVERY',
            [UserRoles.MARKETING]: 'MARKETING',
            [UserRoles.PRODUCTION]: 'PRODUCTION',
        };
        return roleNames[role] || role;
    };

    return (
        <div className={styles.roleSelector}>
            <label className={styles.label}>Разрешенные роли:</label>
            <div 
                className={cn(styles.dropdown, { [styles.open]: isOpen })}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={styles.selected}>
                    {selectedRoles.length > 0 
                        ? `${selectedRoles.length} танланган лавозимлар`
                        : 'Лавозимларни танланг'
                    }
                </div>
                <div className={styles.arrow}>▼</div>
            </div>
            
            {isOpen && (
                <div className={styles.options}>
                    {allRoles.map(role => (
                        <div 
                            key={role}
                            className={cn(styles.option, {
                                [styles.selected]: selectedRoles.includes(role)
                            })}
                            onClick={() => toggleRole(role)}
                        >
                            <input 
                                type="checkbox" 
                                checked={selectedRoles.includes(role)}
                                onChange={() => toggleRole(role)}
                                className={styles.checkbox}
                            />
                            <span>{getRoleDisplayName(role)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
