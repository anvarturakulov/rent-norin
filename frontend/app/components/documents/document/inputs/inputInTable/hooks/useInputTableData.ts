import { useMemo, useCallback } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { DocTableItem } from '@/app/interfaces/document.interface';
import { NUMERIC_CONTROLS, CALCULATION_CONTROLS, CALCULATION_PRECISION } from '../constants/inputTable.constants';
import { roundToTwoDecimals } from '@/app/service/common/converters';
import { DocumentType, getSchetForDocumentType } from '@/app/interfaces/document.interface';
import { getDocumentTypeByComeOut } from '@/app/components/documents/document/docValues/components/helpers/getDocumentTypeByComeOut';
import { useGlobalStockManagement } from '@/app/context/websocket.context';

interface UseInputTableDataProps {
  nameControl: keyof DocTableItem;
  itemIndexInTable: number;
}

export const useInputTableData = ({ nameControl, itemIndexInTable }: UseInputTableDataProps) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;

  // Мемоизируем текущее значение
  const currentValue = useMemo(() => {
    if (!currentDocument?.docTableItems) return '';
    
    const item = currentDocument.docTableItems[itemIndexInTable];
    if (!item) return '';
    
    const value = item[nameControl];
    
    // Convert bigint to number or string for input compatibility
    if (typeof value === 'bigint') {
      return Number(value);
    }
    
    if (value === 0 || typeof value === 'number') return value;
    return value ?? '';
  }, [currentDocument, itemIndexInTable, nameControl]);

  // Функция для парсинга числовых значений с очисткой пробелов
  const parseNumericValue = (val: any): number => {
    if (val === '' || val === null || val === undefined) return 0;
    const cleanValue = String(val).replace(/[\s\u00A0]/g, '').replace(/,/g, '.');
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  // Мемоизируем обработчик изменений
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    const value = target.value;

    if (!currentDocument?.docTableItems) return;

    const currentItem = { ...currentDocument.docTableItems[itemIndexInTable] };
    if (!currentItem) return;

    const storageId =
      currentDocument.documentType === DocumentType.SaleProd ||
      currentDocument.documentType === DocumentType.SaleTovar ||
      currentDocument.documentType === DocumentType.SaleTools
        ? currentDocument?.docValues?.senderId
        : currentDocument?.docValues?.receiverId;
	const warehouseId = storageId || 20125;
    const oldQuantity = currentItem.count || 0;

    // Обработка числовых полей (кроме price, count и countByBox, которые обрабатываются отдельно)
    if (NUMERIC_CONTROLS.includes(nameControl) && nameControl !== 'price' && nameControl !== 'count' && nameControl !== 'countByBox') {
      (currentItem as any)[nameControl] = parseNumericValue(value);
    }

    // Специальная обработка для поля price
    if (nameControl === 'price') {
      const newPrice = parseNumericValue(value);
      currentItem.price = newPrice;
      
      // Пересчитываем total при изменении цены
      const count = currentItem.count || 0;
      currentItem.total = roundToTwoDecimals(count * newPrice);
      currentItem.costTotal = roundToTwoDecimals(count * currentItem.costPrice);
    }

    // Специальная обработка для поля count
    if (nameControl === 'count') {
      const newCount = parseNumericValue(value);
      currentItem.count = newCount;
    }

    // Обработка изменения количества товара - обновляем резерв и пересчитываем коробки
    if (nameControl === 'count' && currentItem.analiticId) {
      const newQuantity = currentItem.count || 0;
      const quantityDiff = newQuantity - oldQuantity;
      
      // Синхронизируем количество коробок
      const allReferences = mainData.reference?.allReferences || [];
      const product = allReferences.find((ref: any) => ref.id === currentItem.analiticId);
      const productCountInBox = product?.refValues?.countInBox;
      
      if (productCountInBox && productCountInBox > 0) {
        currentItem.countByBox = Math.ceil(newQuantity / productCountInBox);
      }
      
      if (quantityDiff !== 0) {
        const itemId = `${warehouseId}:${currentItem.analiticId}`;
        
        // Определяем счет на основе типа документа
        const documentType = currentDocument?.documentType;
        const schet = documentType ? getSchetForDocumentType(documentType as DocumentType) : 'S29';
        
        // Определяем тип документа (приходный/расходный)
        const typeDocumentByComeOut = documentType ? getDocumentTypeByComeOut(documentType as DocumentType) : 'out';
        
        // Логика резервирования удалена
      }
    }

    // Синхронизация количества и коробок
    if (nameControl === 'countByBox') {
      // Получаем информацию о товаре для определения countInBox
      const allReferences = mainData.reference?.allReferences || [];
      const product = allReferences.find((ref: any) => ref.id === currentItem.analiticId);
      const productCountInBox = product?.refValues?.countInBox || 1;
      
      // Пересчитываем общее количество используя НОВОЕ значение коробок
      const newBoxCount = parseNumericValue(value);
      
      currentItem.countByBox = newBoxCount;
      currentItem.count = newBoxCount * productCountInBox;
      
      // Обновляем резерв для нового количества
      const newQuantity = currentItem.count;
      const quantityDiff = newQuantity - oldQuantity;
      
      if (quantityDiff !== 0 && currentItem.analiticId) {
        const itemId = `${warehouseId}:${currentItem.analiticId}`;
        
        // Определяем счет на основе типа документа
        const documentType = currentDocument?.documentType;
        const schet = documentType ? getSchetForDocumentType(documentType as DocumentType) : 'S29';
        
        // Логика резервирования удалена
      }
      
      // Пересчитываем total после изменения количества
      const count = currentItem.count || 0;
      const price = currentItem.price || 0;
      const costPrice = currentItem.costPrice || 0;
      
      currentItem.total = roundToTwoDecimals(count * price);
      currentItem.costTotal = roundToTwoDecimals(count * costPrice);
    }

    // Автоматический расчет total и costTotal для count (countByBox обрабатывается отдельно)
    if (nameControl === 'count' && value != null) {
      const count = currentItem.count || 0;
      const price = currentItem.price || 0;
      const costPrice = currentItem.costPrice || 0;
      
      currentItem.total = roundToTwoDecimals(count * price);
      currentItem.costTotal = roundToTwoDecimals(count * costPrice);
      
      console.log(`🧮 Пересчет: ${count} × ${price} = ${currentItem.total} (${nameControl})`);
    }

    // Обновление состояния
    const newItems = [...currentDocument.docTableItems];
    newItems[itemIndexInTable] = { ...currentItem };
    
    const newObj = {
      ...currentDocument,
      docTableItems: [...newItems]
    };

    if (setMainData) {
      setMainData('currentDocument', { ...newObj });
    }
  }, [currentDocument, itemIndexInTable, nameControl, setMainData, mainData]);

  return {
    currentValue,
    handleChange
  };
}; 