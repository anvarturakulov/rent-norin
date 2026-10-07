'use client'
import styles from './settingPereodicsListWindow.module.css';
import { useAppContext } from '@/app/context/app.context';
import AddIco from '../../windows/pereodicsListWindow/ico/add.svg';
import CloseIco from '../../windows/pereodicsListWindow/ico/close.svg';
import { defaultSettingPereodic } from '@/app/context/app.context.helpers.constants';
import { getDefaultDocumentDateMs } from '@/app/utils/dateInput';
import SettingPereodicsList from '../settingPereodicsList/settingPereodicsList';

export const SettingPereodicsListWindow = (): JSX.Element | null => {
    const { mainData, setMainData } = useAppContext();
    const {
        showSettingPereodicsListWindow,
        showSettingPereodicWindow,
        settingIdForPereodicsList,
        settingKeyForPereodicsList,
        pereodicScopeEnterpriseId,
    } = mainData.settingPereodic;

    const closeWindow = () => {
        if (setMainData) {
            setMainData('showSettingPereodicsListWindow', false);
            setMainData('showSettingPereodicWindow', false);
            setMainData('isNewSettingPereodic', false);
            setMainData('currentSettingPereodic', undefined);
            setMainData('settingIdForPereodicsList', -1);
            setMainData('settingKeyForPereodicsList', '');
            setMainData('pereodicScopeEnterpriseId', null);
        }
    };

    const addNewElement = () => {
        const defValue = { ...defaultSettingPereodic };
        defValue.date = getDefaultDocumentDateMs();
        defValue.settingId = settingIdForPereodicsList;
        defValue.enterpriseId =
            pereodicScopeEnterpriseId != null && Number(pereodicScopeEnterpriseId) > 0
                ? Number(pereodicScopeEnterpriseId)
                : null;

        if (setMainData) {
            setMainData('showSettingPereodicWindow', true);
            setMainData('isNewSettingPereodic', true);
            setMainData('currentSettingPereodic', { ...defValue });
        }
    };

    if (!showSettingPereodicsListWindow) {
        return null;
    }

    return (
        <div
            className={styles.backdrop}
            role="presentation"
            onClick={() => {
                if (!showSettingPereodicWindow) {
                    closeWindow();
                }
            }}
        >
            <div
                className={styles.box}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <div className={styles.titleBlock}>
                        <p className={styles.eyebrow}>Даврий қийматлар</p>
                        <h2 className={styles.title}>
                            <span className={styles.refName}>{settingKeyForPereodicsList}</span>
                        </h2>
                        <p className={styles.hint}>
                            Қаторга икки марта босиб — таҳрир; ➕ — янги сана учун қиймат.
                        </p>
                    </div>
                    <div className={styles.btnsBox}>
                        <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label="Янги қиймат қўшиш"
                            onClick={addNewElement}
                        >
                            <AddIco className={styles.icoSvg} />
                        </button>
                        <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label="Ёпиш"
                            onClick={closeWindow}
                        >
                            <CloseIco className={styles.icoSvg} />
                        </button>
                    </div>
                </div>
                <div className={styles.body}>
                    <SettingPereodicsList />
                </div>
            </div>
        </div>
    );
};
