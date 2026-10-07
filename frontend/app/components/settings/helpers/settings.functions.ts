import { Setting } from '../../../interfaces/settings.interface';
import { Maindata } from '../../../context/app.context.interfaces';
import { formatDateForInput } from '@/app/utils/dateInput';

export const onSubmit = async (
    body: Setting, 
    setMainData: ((key: string, value: any) => void) | undefined, 
    token?: string,
    enterpriseId?: number | null
) => {
    try {
        let url = process.env.NEXT_PUBLIC_DOMAIN + '/api/settings/';
        const method = body.id === 0 ? 'POST' : 'PUT';
        
        if (body.id !== 0) {
            url = process.env.NEXT_PUBLIC_DOMAIN + `/api/settings/${body.id}`;
        }

        // Подготавливаем данные для отправки
        const dataToSend: Record<string, any> = { ...body };
        const hasEnterpriseInBody = body.enterpriseId !== undefined;
        const resolvedEnterpriseId = hasEnterpriseInBody
            ? body.enterpriseId
            : (enterpriseId !== undefined ? enterpriseId : null);
        dataToSend.enterpriseId = resolvedEnterpriseId ?? null;
        if (dataToSend.key === 'date_ban_editing') {
            dataToSend.enterpriseId = null;
        }
        
        // Если тип DATE, конвертируем Date в ISO строку для отправки
        if (body.type === 'DATE' && body.value instanceof Date) {
            dataToSend.value = formatDateForInput(body.value.getTime());
        } else if (body.type === 'DATE' && typeof body.value === 'number') {
            dataToSend.value = formatDateForInput(body.value);
        }

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dataToSend)
        });

        if (response.ok && setMainData) {
            setMainData('updateDataForSettingsJournal', true);
            setMainData('showSettingsWindow', false);
            setMainData('isNewSetting', false);
            setMainData('settings.currentSetting', undefined);
            if (dataToSend.key === 'date_ban_editing') {
                setMainData('settings.dateBanEditing', dataToSend.value ?? null);
            }
        } else {
            console.error('Ошибка при сохранении настройки');
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
};

export const cancelSubmit = (setMainData: ((key: string, value: any) => void) | undefined) => {
    if (setMainData) {
        setMainData('showSettingsWindow', false);
        setMainData('isNewSetting', false);
        setMainData('settings.currentSetting', undefined);
    }
};

export const getSetting = async (
    id: number, 
    setMainData: ((key: string, value: any) => void) | undefined, 
    token?: string
) => {
    try {
        const url = process.env.NEXT_PUBLIC_DOMAIN + `/api/settings/id/${id}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok && setMainData) {
            const setting = await response.json();
            setMainData('currentSetting', setting);
            setMainData('showSettingsWindow', true);
            setMainData('isNewSetting', false);
        }
    } catch (error) {
        console.error('Ошибка при получении настройки:', error);
    }
};

export const markToDelete = async (
    id: number, 
    name: string, 
    token?: string, 
    setMainData?: (key: string, value: any) => void
) => {
    if (confirm(`Вы уверены, что хотите удалить настройку "${name}"?`)) {
        try {
            const url = process.env.NEXT_PUBLIC_DOMAIN + `/api/settings/${id}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok && setMainData) {
                setMainData('updateDataForSettingsJournal', true);
            }
        } catch (error) {
            console.error('Ошибка при удалении настройки:', error);
        }
    }
};
