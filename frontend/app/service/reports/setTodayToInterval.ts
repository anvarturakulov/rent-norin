import { getTodayRange } from '../common/dateRanges';

export const setTodayToInterval = (setMainData: Function | undefined) => {
  const { start, end } = getTodayRange();

  const newInterval = {
    dateStart: start,
    dateEnd: end,
  };

  setMainData && setMainData('interval', { ...newInterval });
}