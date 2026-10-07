'use client'
import { useCallback, useEffect, useState } from 'react';
import styles from './settingPereodic.module.css';
import cn from 'classnames';
import { Button, Input } from '@/app/components';
import { useAppContext } from '@/app/context/app.context';
import { SettingPereodicModel } from '@/app/interfaces/settings.interface';
import { updateCreateSettingPereodic } from '@/app/service/settings/updateCreateSettingPereodic';
import { showMessage } from '@/app/service/common/showMessage';
import { adminAndHeadCompany } from '@/app/interfaces/user.interface';
import { useControlledDateInput } from '@/app/hooks/useControlledDateInput';

export const SettingPereodic = (): JSX.Element => {
    const { mainData, setMainData } = useAppContext();
    const {
        isNewSettingPereodic,
        showSettingPereodicWindow,
        currentSettingPereodic,
        pereodicScopeEnterpriseId,
    } = mainData.settingPereodic;
    const { user } = mainData.users;

    const defaultBody: SettingPereodicModel = {
        id: 0,
        settingId: 0,
        date: 0,
        value: 0,
    };

    const [body, setBody] = useState<SettingPereodicModel>(defaultBody);

    const changeValue = (e: React.FormEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        setBody((state) => ({
            ...state,
            value: +value,
        }));
    };

    const onCommitDate = useCallback((parsed: number) => {
        setBody((state) => ({
            ...state,
            date: parsed,
        }));
    }, []);

    const {
        inputRef: dateInputRef,
        defaultValue: dateDefaultValue,
        handleChange: handleDateChange,
        handleBlur: handleDateBlur,
        min: dateMin,
        max: dateMax,
    } = useControlledDateInput(body.date, onCommitDate, { emptyIfZero: true });

    const onSubmit = () => {
        if (!body.date || !body.settingId) {
            showMessage('Киритишда хатолик', 'error', setMainData);
            return;
        }
        const scopeEnt =
            pereodicScopeEnterpriseId != null && Number(pereodicScopeEnterpriseId) > 0
                ? Number(pereodicScopeEnterpriseId)
                : null;
        updateCreateSettingPereodic(
            { ...body, enterpriseId: scopeEnt },
            isNewSettingPereodic,
            setMainData,
            user?.token,
            scopeEnt,
        );
    };

    const cancelSubmit = () => {
        if (setMainData) {
            setMainData('showSettingPereodicWindow', false);
            setMainData('isNewSettingPereodic', false);
        }
    };

    useEffect(() => {
        if (currentSettingPereodic) {
            setBody({ ...currentSettingPereodic });
        } else {
            setBody(defaultBody);
        }
    }, [currentSettingPereodic]);

    const role = user?.role;
    const isAdminOrHeadCompany = role && adminAndHeadCompany.includes(role);

    return (
        <div className={cn(styles.pereodicBox, {
            [styles.newPereodic]: isNewSettingPereodic,
            [styles.boxClose]: !showSettingPereodicWindow,
        })}>
            <p className={styles.formCaption}>
                {isNewSettingPereodic
                    ? 'Янги сана учун қиймат қўшиш'
                    : 'Танланган сана учун қийматни таҳрирлаш'}
            </p>
            <div className={styles.inputRow}>
                <label className={styles.label}>Сана</label>
                <input
                    ref={dateInputRef}
                    className={styles.input}
                    onChange={handleDateChange}
                    onBlur={handleDateBlur}
                    type="date"
                    defaultValue={dateDefaultValue}
                    min={dateMin}
                    max={dateMax}
                    disabled={!isAdminOrHeadCompany}
                    id="date"
                />
            </div>
            <Input
                label="Қиймат"
                value={body.value}
                type="number"
                id="value"
                className={styles.input}
                onChange={changeValue}
            />
            <div className={styles.boxBtn}>
                <Button appearance="primary" onClick={onSubmit}>
                    Сақлаш
                </Button>
                <Button appearance="ghost" onClick={cancelSubmit}>
                    Бекор қилиш
                </Button>
            </div>
        </div>
    );
};
