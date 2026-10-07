import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { DocSTATUS } from '@/app/interfaces/document.interface';

interface GetInitialValueParams {
  data: ReferenceModel[];
  definedItemId: number | undefined | null;
  currentItemId: number | undefined | null;
  contentName: string;
  type: string;
  isNewDocument: boolean;
}

export const getInitialValue = ({
  data,
  definedItemId,
  currentItemId,
  contentName,
  type,
  isNewDocument
}: GetInitialValueParams): string => {
  if (!data || data.length === 0) return 'Танланмаган';


  // Поиск элемента по ID
  const foundItem = data.find((elem: ReferenceModel) => {
    if (isNewDocument) {
      return ( elem?.id === definedItemId || elem?.id === currentItemId)
    } else {
      return elem?.id === currentItemId
    }
  });

  if (!foundItem) return 'Танланмаган';

  // Для автомобилей показываем название, модель и тип
  if (type === 'car' && foundItem.refValues?.carModel) {
    const carType = foundItem.refValues.carType || 'STRANGER';
    const carTypeLabel = carType === 'VIP' ? 'VIP' : carType === 'OWN' ? 'Своя' : 'Чужая';
    return `${foundItem.name} - ${foundItem.refValues.carModel} (${carTypeLabel})`;
  }

  return foundItem.name;
};

export const isDisabled = (
  definedItemId: number | undefined | null,
  userRole: string | undefined,
  documentType: string | undefined,
  docStatus: string | undefined
): boolean => {
  // Если статус документа не OPEN, компонент должен быть недоступен для редактирования
  if (docStatus && docStatus !== DocSTATUS.OPEN) {
    return true;
  }

  // Базовая логика
  let flagDisabled = Boolean(definedItemId);

  // Специальная логика для GLAVBUX роли
  if (userRole === 'GLAVBUX' && documentType === 'ComeProduct') {
    flagDisabled = false;
  }

  return flagDisabled;
}; 