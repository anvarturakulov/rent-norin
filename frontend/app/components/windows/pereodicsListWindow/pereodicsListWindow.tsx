'use client'
import styles from './pereodicsListWindow.module.css';
import { useAppContext } from '@/app/context/app.context';
import AddIco from './ico/add.svg';
import CloseIco from './ico/close.svg';
import { Maindata } from "@/app/context/app.context.interfaces";
import { PereodicsListWindowProps } from './pereodicsListWindow.props';
import PereodicsList from '../../lists/pereodicsList/pereodicsList';
import { defaultPereodic } from '@/app/context/app.context.helpers.constants';
import { getDefaultDocumentDateMs } from '@/app/utils/dateInput';

export const PereodicsListWindow = (_props: PereodicsListWindowProps): JSX.Element | null => {
  
  const {mainData, setMainData} = useAppContext();
  const {referenceNameForPereodicsList, valueNameTranslateForPereodicsList} = mainData.pereodic;

  const closeWindow = (setMainData: Function | undefined) => {
    if (setMainData) {
      setMainData('showPereodicsListWindow', false);
      setMainData('showPereodicWindow', false);
      setMainData('isNewPereodic', false);
      setMainData('currentPereodic', undefined);
      setMainData('referenceIdForPereodicsList', 0);
      setMainData('referenceNameForPereodicsList', '');
      setMainData('valueNameForPereodicsList', '');
      setMainData('valueNameTranslateForPereodicsList', '');
    }
  }

  const addNewElement = (setMainData: Function | undefined, mainData: Maindata) => {
      const { referenceIdForPereodicsList, valueNameForPereodicsList } = mainData.pereodic;
      let defValue = { ...defaultPereodic }
      defValue.date = getDefaultDocumentDateMs();
      defValue.referenceId = referenceIdForPereodicsList
      defValue.name = valueNameForPereodicsList

      if (setMainData) {
          // setMainData('clearControlElements', false);
          setMainData('showPereodicWindow', true);
          setMainData('isNewPereodic', true);
          setMainData('currentPereodic', { ...defValue });
      }
  }

  if (!mainData.pereodic.showPereodicsListWindow) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={() => {
        if (!mainData.pereodic.showPereodicWindow) {
          closeWindow(setMainData);
        }
      }}
    >
      <div
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pereodics-list-window-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Тарих бўйича нархлар</p>
            <h2 id="pereodics-list-window-title" className={styles.title}>
              <span className={styles.refName}>{referenceNameForPereodicsList}</span>
              <span className={styles.titleMuted}>учун</span>
              <span className={styles.priceLabel}>{valueNameTranslateForPereodicsList}</span>
            </h2>
            <p className={styles.hint}>Қаторга икки марта босиб — таҳрир; ➕ — янги сана учун қиймат.</p>
          </div>
          <div className={styles.btnsBox}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Янги қиймат қўшиш"
              onClick={() => addNewElement(setMainData, mainData)}
            >
              <AddIco className={styles.icoSvg} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Ёпиш"
              onClick={() => closeWindow(setMainData)}
            >
              <CloseIco className={styles.icoSvg} />
            </button>
          </div>
        </div>
        <div className={styles.body}>
          <PereodicsList />
        </div>
      </div>
    </div>
  )
}