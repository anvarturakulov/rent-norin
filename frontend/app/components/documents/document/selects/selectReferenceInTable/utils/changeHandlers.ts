import { Maindata } from '@/app/context/app.context.interfaces';

interface ChangeHandlerParams {
  e: React.FormEvent<HTMLSelectElement>;
  itemIndex: number;
  setMainData: Function | undefined;
  mainData: Maindata;
  setSelected: Function | undefined;
  fieldName?: 'analiticId';
}

export const handleSelectTableChange = ({
  e,
  itemIndex,
  setMainData,
  mainData,
  setSelected,
  fieldName = 'analiticId'
}: ChangeHandlerParams) => {
  const target = e.currentTarget;
  const { currentDocument } = mainData.document;

  if (!currentDocument || !currentDocument.docTableItems) return;

  const currentItem = { ...currentDocument.docTableItems[itemIndex] };
  const strId = target[target.selectedIndex].getAttribute('data-id');
  const id = strId ? +strId : 0;
  const value = target.value;

  if (id !== null && id !== 0) {
    (currentItem as any)[fieldName] = id;
    setSelected && setSelected(value);
  } else {
    (currentItem as any)[fieldName] = undefined;
  }

  const newItems = [...currentDocument.docTableItems];
  newItems[itemIndex] = { ...currentItem };
  
  const newObj = {
    ...currentDocument,
    docTableItems: [...newItems]
  };

  if (setMainData) {
    setMainData('currentDocument', { ...newObj });
  }
}; 