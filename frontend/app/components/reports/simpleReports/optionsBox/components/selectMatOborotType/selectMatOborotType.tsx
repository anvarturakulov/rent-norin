import { SelectMatOborotTypeProps } from './selectMatOborotType.props';
import styles from '../selectOborot/selectOborot.module.css';
import { useAppContext } from '@/app/context/app.context';
import { Maindata } from '@/app/context/app.context.interfaces';
import { Schet } from '@/app/interfaces/report.interface';
import {
  isMatOborotSchet,
  MAT_OBOROT_TYPE_OPTIONS,
} from '@/app/service/reports/matOborotTypes';
import { useEffect } from 'react';

export const SelectMatOborotType = ({
  label,
  visible,
  className,
  ...props
}: SelectMatOborotTypeProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { reportOption } = mainData.report;

  useEffect(() => {
    if (!visible || !setMainData) return;
    if (!isMatOborotSchet(reportOption.schet)) {
      setMainData('reportOption', {
        ...reportOption,
        schet: Schet.S10,
      });
    }
  }, [visible, reportOption, setMainData]);

  const changeElements = (
    e: React.FormEvent<HTMLSelectElement>,
    setMainDataFn: Function | undefined,
    mainDataState: Maindata,
  ) => {
    const selectedSchet = e.currentTarget.value as Schet;
    const { reportOption: current } = mainDataState.report;

    if (setMainDataFn) {
      setMainDataFn('reportOption', {
        ...current,
        schet: selectedSchet,
        firstReferenceId: undefined,
        secondReferenceId: undefined,
      });
    }
  };

  if (visible === false) return <></>;

  const currentSchet = isMatOborotSchet(reportOption.schet)
    ? reportOption.schet
    : Schet.S10;

  return (
    <div className={styles.box}>
      {label !== '' && <div className={styles.label}>{label}</div>}
      <select
        className={styles.select}
        value={currentSchet}
        {...props}
        onChange={(e) => changeElements(e, setMainData, mainData)}
      >
        {MAT_OBOROT_TYPE_OPTIONS.map((item) => (
          <option value={item.schet} key={item.schet}>
            {item.title}
          </option>
        ))}
      </select>
    </div>
  );
};
