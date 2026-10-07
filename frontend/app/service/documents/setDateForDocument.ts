import { Maindata } from '@/app/context/app.context.interfaces';

export const setDateForDocument = ( value: string, setMainData: Function | undefined, mainData: Maindata) => {
  let { currentDocument } = mainData.document;
  let newObj = {
    ...currentDocument,
    date: Date.parse(value),
  }

  if (setMainData) {
    setMainData('currentDocument', { ...newObj })
  }
}