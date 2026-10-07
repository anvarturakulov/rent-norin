'use client'
import { useEffect, useState } from 'react';
import styles from './enterprise.module.css';
import cn from 'classnames';
import { Button } from '@/app/components';
import { useAppContext } from '@/app/context/app.context';
import { Enterprise, MenuVisibilitySettings } from '@/app/interfaces/enterprise.interface';
import { createEnterprise } from '@/app/service/enterprises/createEnterprise';
import { updateEnterprise } from '@/app/service/enterprises/updateEnterprise';
import { showMessage } from '@/app/service/common/showMessage';
import { MenuVisibilitySettingsComponent } from './menuVisibilitySettings/menuVisibilitySettings';

interface EnterpriseProps {
    className?: string;
}

export const EnterpriseForm = ({ className }: EnterpriseProps): JSX.Element => {
    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users;
    const { isNewEnterprise, showEnterpriseWindow } = mainData.enterprises || { isNewEnterprise: false, showEnterpriseWindow: false };
    const { currentEnterprise } = mainData.enterprises || { currentEnterprise: undefined };

    const defaultBody: Enterprise = {
        id: 0,
        name: '',
        code: '',
        isActive: true,
        settings: null,
    };

    const [body, setBody] = useState<Enterprise>(defaultBody);

    const changeElements = (e: React.FormEvent<HTMLInputElement>) => {
        const target = e.currentTarget;
        setBody((state: Enterprise) => {
            return {
                ...state,
                [target.id]: target.type === 'checkbox' ? target.checked : target.value
            };
        });
    };

    useEffect(() => {
        setBody(defaultBody);
    }, [mainData.window.clearControlElements]);

    useEffect(() => {
        if (currentEnterprise) {
            setBody({
                ...currentEnterprise
            });
        }
    }, [currentEnterprise]);

    const cancelSubmit = () => {
        if (setMainData) {
            setMainData('clearControlElements', true);
            setMainData('showEnterpriseWindow', false);
            setMainData('isNewEnterprise', false);
        }
    };

    const handleMenuVisibilityChange = (menuVisibility: MenuVisibilitySettings) => {
        setBody((state: Enterprise) => ({
            ...state,
            settings: {
                ...(state.settings || {}),
                menuVisibility
            }
        }));
    };

    const onSubmit = async () => {
        if (!body.name.trim()) {
            showMessage('Название предприятия обязательно', 'error', setMainData);
            return;
        }

        if (!body.code.trim()) {
            showMessage('Код предприятия обязателен', 'error', setMainData);
            return;
        }

        try {
            if (isNewEnterprise) {
                await createEnterprise(body, user?.token, setMainData);
            } else if (body.id) {
                await updateEnterprise(body.id, body, user?.token, setMainData);
                
                // Обновляем настройки меню в контексте, если изменяем предприятие текущего пользователя
                if (user?.enterpriseId === body.id && body.settings?.menuVisibility) {
                    setMainData && setMainData('enterpriseSettings', { menuVisibility: body.settings.menuVisibility });
                }
            }
            cancelSubmit();
        } catch (error) {
            // Ошибка уже обработана в сервисе
        }
    };

    return (
        <div className={cn(styles.enterpriseBox,
            { [styles.newEnterprise]: isNewEnterprise },
            { [styles.boxClose]: !showEnterpriseWindow }
        )}>
            <div className={styles.box}>
                <div className={styles.nameBox}>
                    <div>Название</div>
                    <input
                        value={body.name}
                        type="text"
                        id="name"
                        className={styles.input}
                        onChange={changeElements}
                    />
                </div>

                <div className={styles.nameBox}>
                    <div>Код</div>
                    <input
                        value={body.code}
                        type="text"
                        id="code"
                        className={styles.input}
                        onChange={changeElements}
                    />
                </div>

                <div className={styles.nameBox}>
                    <div>Активно</div>
                    <input
                        type="checkbox"
                        id="isActive"
                        checked={body.isActive ?? true}
                        className={styles.input}
                        onChange={changeElements}
                    />
                </div>
            </div>

            {/* Настройки видимости меню - только при редактировании */}
            {!isNewEnterprise && body.id && (
                <div className={styles.menuSettingsBox}>
                    <MenuVisibilitySettingsComponent
                        menuVisibility={body.settings?.menuVisibility}
                        onChange={handleMenuVisibilityChange}
                    />
                </div>
            )}

            <div className={styles.boxBtn}>
                <Button appearance="primary" onClick={onSubmit}>
                    Саклаш
                </Button>
                <Button appearance="ghost" onClick={cancelSubmit}>
                    Бекор килиш
                </Button>
            </div>
        </div>
    );
};

