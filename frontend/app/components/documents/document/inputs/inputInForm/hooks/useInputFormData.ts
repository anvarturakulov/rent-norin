import { useMemo, useCallback } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { NameControl, DocValues, DocumentType } from '@/app/interfaces/document.interface';
import { NUMERIC_CONTROLS, PRECISION, MIN_COUNT_VALUE } from '../constants/inputForm.constants';
import { showMessage } from '@/app/service/common/showMessage';
import { isOptionalPaymentFieldEmpty } from '@/app/service/documents/optionalPaymentFields';
import { cleanNumericInput } from '@/app/service/common/decimalInput';

interface UseInputFormDataProps {
  nameControl: NameControl;
}

// Type for valid DocValues keys (excludes 'balance' which is only in DocTableItem)
type DocValuesKey = Exclude<NameControl, 'balance'>;

// Type guard to check if a NameControl is a valid DocValues key
function isDocValuesKey(key: NameControl): key is DocValuesKey {
  return key !== 'balance';
}

// Helper function to safely get value from DocValues
function getDocValue(docValues: DocValues, key: NameControl): any {
  if (key === 'balance') return undefined;
  if (!isDocValuesKey(key)) return undefined;
  return docValues[key];
}

const OPTIONAL_PAYMENT_CONTROLS: NameControl[] = [
  'initialPayment',
  'cashFromPartner',
  'currency',
  'usd',
  'changeToClient',
  'debtSum',
  'deliverySum',
  'defectCost',
];

/** Normalize comma/spaces then parse; empty / lone "." → fallback. */
function parseNumericValue(value: string, emptyFallback: number = 0): number {
  const cleaned = cleanNumericInput(value);
  if (cleaned === '' || cleaned === '.' || cleaned === '-' || cleaned === '-.') {
    return emptyFallback;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : emptyFallback;
}

function parseOptionalNumber(value: string): number | undefined {
  if (value === '') return undefined;
  const cleaned = cleanNumericInput(value);
  if (cleaned === '' || cleaned === '.' || cleaned === '-' || cleaned === '-.') {
    return undefined;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export const useInputFormData = ({ nameControl }: UseInputFormDataProps) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;

  // Мемоизируем текущее значение
  const currentValue = useMemo(() => {
    if (!currentDocument?.docValues) return '';
    
    const value = getDocValue(currentDocument.docValues, nameControl);
    if (OPTIONAL_PAYMENT_CONTROLS.includes(nameControl) && isOptionalPaymentFieldEmpty(value)) {
      return '';
    }
    return value ?? '';
  }, [currentDocument, nameControl]);

  // Мемоизируем обработчик изменений
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Prefer target (FormInput sets cleaned value on both); fall back to currentTarget.
    const value = e.target?.value ?? e.currentTarget?.value ?? '';

    if (!currentDocument?.docValues) return;

    let newValues = currentDocument;
    let isHandled = false;

    // Обработка count с валидацией и автоматическим расчетом total
    if (nameControl === 'count') {
      const parsedCount = parseNumericValue(value, 0);
      if (parsedCount > MIN_COUNT_VALUE) {
        const countValue = Number(parsedCount.toFixed(PRECISION.COUNT));
        const remainCount = Number(currentDocument.docValues?.remainCount || 0);
        if (
          currentDocument.documentType === DocumentType.LeaveOnlyOneMaterial &&
          countValue > remainCount
        ) {
          showMessage(`Количество не может быть больше остатка (${remainCount})`, 'error', setMainData);
          return;
        }
        newValues = {
          ...currentDocument,
          docValues: {
            ...currentDocument.docValues,
            count: countValue,
            total: Number((countValue * (currentDocument.docValues?.price || 0)).toFixed(PRECISION.TOTAL))
          }
        };
        isHandled = true;
      }
    }

    // Обработка price с автоматическим расчетом total
    if (nameControl === 'price') {
      const priceValue = parseNumericValue(value, 0);
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          price: priceValue,
          total: Number((priceValue * (currentDocument.docValues?.count || 0)).toFixed(PRECISION.TOTAL))
        }
      };
      isHandled = true;
    }

    // Обработка currency с автоматическим расчетом total
    if (nameControl === 'currency') {
      const currencyValue = parseOptionalNumber(value);
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          currency: currencyValue,
          total: Number(((currencyValue ?? 0) * (currentDocument.docValues?.usd || 0)).toFixed(PRECISION.TOTAL))
        }
      };
      isHandled = true;
    }

    // Обработка foreignCurrency с автоматическим расчетом foreignTotal
    if (nameControl === 'usd') {
      const usdValue = parseOptionalNumber(value);
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          usd: usdValue,
          total: Number(((usdValue ?? 0) * (currentDocument.docValues?.currency || 0)).toFixed(PRECISION.TOTAL))
        }
      };
      isHandled = true;
    }

    // Обработка total
    if (nameControl === 'total') {
      if (currentDocument.documentType === DocumentType.LeaveOnlyOneMaterial) {
        return;
      }
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          total: parseNumericValue(value, 0)
        }
      };
      isHandled = true;
    }

    // Обработка cashFromPartner
    if (nameControl === 'cashFromPartner') {
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          cashFromPartner: parseOptionalNumber(value)
        }
      };
      isHandled = true;
    }

    // Обработка comment
    if (nameControl === 'comment') {
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          comment: value
        }
      };
      isHandled = true;
    }

    // Обработка finPerson
    if (nameControl === 'finPerson') {
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          finPerson: value
        }
      };
      isHandled = true;
    }

    // Обработка driver
    if (nameControl === 'driver') {
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          driver: value
        }
      };
      isHandled = true;
    }

    // Обработка initialPayment (авансовый платеж / накд)
    if (nameControl === 'initialPayment') {
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          initialPayment: parseOptionalNumber(value)
        }
      };
      isHandled = true;
    }

    // Обработка contractNumber (номер договора для продажи квартир)
    if (nameControl === 'contractNumber') {
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          contractNumber: value || ''
        }
      };
      isHandled = true;
    }

    // Обработка deadlineDate
    if (nameControl === 'deadlineDate') {
      const dateValue = value ? new Date(value).getTime() : undefined;
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          deadlineDate: dateValue
        }
      };
      isHandled = true;
    }

    // Общая обработка для остальных полей (debtSum, debtComment и др.)
    if (!isHandled) {
      const isNumeric = NUMERIC_CONTROLS.includes(nameControl);
      const processedValue = isNumeric
        ? (OPTIONAL_PAYMENT_CONTROLS.includes(nameControl)
            ? parseOptionalNumber(value)
            : parseNumericValue(value, 0))
        : value;
      
      newValues = {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          [nameControl]: processedValue
        }
      };
    }

    if (setMainData) {
      setMainData('currentDocument', { ...newValues });
    }
  }, [currentDocument, nameControl, setMainData]);

  return {
    currentValue,
    handleChange
  };
}; 