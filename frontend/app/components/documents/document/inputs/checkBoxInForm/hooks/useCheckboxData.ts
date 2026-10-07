import { useMemo, useCallback } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { CheckboxIdTypes } from '../checkBoxInForm.props';
import { CHECKBOX_PROPERTIES, MUTUALLY_EXCLUSIVE_GROUPS } from '../constants/checkbox.constants';
import { DocumentType } from '@/app/interfaces/document.interface';

interface UseCheckboxDataProps {
  id: CheckboxIdTypes;
}

export const useCheckboxData = ({ id }: UseCheckboxDataProps) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument, contentName } = mainData.document;

  // Мемоизируем текущее значение чекбокса
  const currentValue = useMemo(() => {
    if (!currentDocument?.docValues) return false;
    
    const propertyName = CHECKBOX_PROPERTIES[id as keyof typeof CHECKBOX_PROPERTIES];
    if (!propertyName) return false;
    
    const value = currentDocument.docValues[propertyName as keyof typeof currentDocument.docValues];
    return Boolean(value);
  }, [currentDocument, id]);

  // Мемоизируем обработчик изменений
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    const isChecked = target.checked;

    if (!currentDocument?.docValues) return;

    const currentValues = { ...currentDocument };
    const propertyName = CHECKBOX_PROPERTIES[id as keyof typeof CHECKBOX_PROPERTIES];
    
    if (!propertyName) return;

    // Устанавливаем значение для текущего чекбокса
    (currentValues.docValues as any)[propertyName] = isChecked;

    // Если чекбокс включен, отключаем взаимно исключающие
    if (isChecked) {
      const exclusiveGroup = MUTUALLY_EXCLUSIVE_GROUPS[id as keyof typeof MUTUALLY_EXCLUSIVE_GROUPS];
      if (exclusiveGroup) {
        exclusiveGroup.forEach(exclusiveId => {
          const exclusiveProperty = CHECKBOX_PROPERTIES[exclusiveId as keyof typeof CHECKBOX_PROPERTIES];
          if (exclusiveProperty) {
            (currentValues.docValues as any)[exclusiveProperty] = false;
          }
        });
      }
    }

    // SaleMaterial: смена клиент/сотрудник/поставщик — сбрасываем receiver (разные справочники)
    if (
      contentName === DocumentType.SaleMaterial &&
      (propertyName === 'isClient' || propertyName === 'isWorker' || propertyName === 'isPartner')
    ) {
      (currentValues.docValues as any).receiverId = 0;
    }

    if (setMainData) {
      setMainData('currentDocument', { ...currentValues });
    }
  }, [currentDocument, contentName, id, setMainData]);

  return {
    currentValue,
    handleChange
  };
}; 