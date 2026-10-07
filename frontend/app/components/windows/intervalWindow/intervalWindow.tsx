import { IntervalProps } from "./intervalWindow.props";
import styles from './intervalWindow.module.css';
import { Button } from '../../common/button/Button';
import { useCallback, useState } from 'react';
import { Interval } from '@/app/interfaces/document.interface';
import { useAppContext } from '@/app/context/app.context';
import { useControlledDateInput } from '@/app/hooks/useControlledDateInput';
import { endOfZonedDay } from '@/app/utils/appTime';

export const IntervalWindow = ({className, ...props}: IntervalProps): JSX.Element => {
  
  const {mainData, setMainData} = useAppContext();
  const [interval, setInterval] = useState<Interval>({...mainData.journal.interval})

  const onCommitDateStart = useCallback(
    (parsed: number) => {
      setInterval((prev) => ({
        ...prev,
        dateStart: parsed,
      }));
    },
    [],
  );

  const onCommitDateEnd = useCallback(
    (parsed: number) => {
      setInterval((prev) => ({
        ...prev,
        dateEnd: endOfZonedDay(parsed) ?? parsed,
      }));
    },
    [],
  );

  const dateStartInput = useControlledDateInput(interval.dateStart, onCommitDateStart);
  const dateEndInput = useControlledDateInput(interval.dateEnd, onCommitDateEnd);

  const saveData = (interval: Interval, setMainData: Function | undefined) => {
    const {dateStart, dateEnd} = interval;
    const newInterval = {
      dateStart,
      dateEnd
    }

    if (dateStart <= dateEnd) {
      if (setMainData) {
        setMainData('interval', {...newInterval})
        setMainData('showIntervalWindow', false);
        setMainData('updateDataForDocumentJournal', false);  
      }
    }
    else {
      alert('Сана киритишда хатолик')
    }
  }

  const closeWindow = (setMainData: Function | undefined) => {
    setMainData && setMainData('showIntervalWindow', false);   
  }

  return (
      <>
          { mainData.journal.showIntervalWindow && 
            <div
              className={styles.backdrop}
              role="presentation"
              onClick={() => closeWindow(setMainData)}
            >
              <div
                className={styles.box}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div>Интервал саналарини киритинг</div>
                <input 
                  type='date' 
                  className={styles.input} 
                  id='dateStart' 
                  ref={dateStartInput.inputRef}
                  defaultValue={dateStartInput.defaultValue}
                  onChange={dateStartInput.handleChange}
                  onBlur={dateStartInput.handleBlur}
                  min={dateStartInput.min}
                  max={dateStartInput.max}
                />
                <input 
                  type='date' 
                  className={styles.input} 
                  id='dateEnd' 
                  ref={dateEndInput.inputRef}
                  defaultValue={dateEndInput.defaultValue}
                  onChange={dateEndInput.handleChange}
                  onBlur={dateEndInput.handleBlur}
                  min={dateEndInput.min}
                  max={dateEndInput.max}
                />
                <div className={styles.btnBox}>
                  <Button appearance='primary' onClick={() => saveData(interval, setMainData)}> Саклаш </Button>
                  <Button appearance='ghost' onClick={() => closeWindow(setMainData)}> Чикиш </Button>
                </div>
              </div>
            </div>
          }
      </>
  )
}
