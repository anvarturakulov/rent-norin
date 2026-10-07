import { Maindata } from '@/app/context/app.context.interfaces';
import { parseDateInputValue } from '@/app/utils/dateInput';
import { endOfZonedDay } from '@/app/utils/appTime';

export const onChangeInputOptionsBox = (e: React.FormEvent<HTMLInputElement>, setMainData: Function | undefined, mainData: Maindata) => {
  let target = e.currentTarget
  let { reportOption } = mainData.report;
  const startMs = parseDateInputValue(target.value);
  if (startMs == null) return;
  const parsedDate = target.id == 'endDate' ? (endOfZonedDay(startMs) ?? startMs) : startMs
  
  let newObj = {
    ...reportOption,
    [target.id]: parsedDate
  }

  if (setMainData) {
    setMainData('reportOption', { ...newObj })
  }
}
