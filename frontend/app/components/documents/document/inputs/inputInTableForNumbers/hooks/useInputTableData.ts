import React, { useMemo, useCallback } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { DocumentType, DocTableItem, isReceiveToolsDocument, getSchetForDocumentType } from '@/app/interfaces/document.interface';
import { NUMERIC_CONTROLS, CALCULATION_CONTROLS, CALCULATION_PRECISION } from '../constants/inputTableForNumbers.constants';
import { roundToTwoDecimals } from '@/app/service/common/converters';
import { useGlobalStockManagement, useGlobalWebSocket } from '@/app/context/websocket.context';
import { getDocumentTypeByComeOut } from '@/app/components/documents/document/docValues/components/helpers/getDocumentTypeByComeOut';
import { getStorageIdForDocument } from '@/app/service/documents/getStorageIdForDocument';
import { UserRoles } from '@/app/interfaces/user.interface';
import {
  clampRentHours,
  getReceiveToolsReturnDateTime,
  isReceiveToolsReturnRow,
  MIN_RENT_HOURS,
  recalcReceiveToolsReturnRow,
} from '@/app/service/documents/receiveToolsRent';

interface UseInputTableForNumbersDataProps {
  nameControl: keyof DocTableItem;
  itemIndexInTable: number;
}

export const useInputTableForNumbersData = ({ nameControl, itemIndexInTable }: UseInputTableForNumbersDataProps) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const { getStock } = useGlobalStockManagement();
  
  // Состояние для ошибок валидации
  const [validationError, setValidationError] = React.useState<{ hasError: boolean; message?: string }>({ hasError: false });

  // Мемоизируем текущее значение
  const currentValue = useMemo(() => {
    if (!currentDocument?.docTableItems) return '';
    
    const item = currentDocument.docTableItems[itemIndexInTable];
    if (!item) return '';
    
    const value = item[nameControl];

    const isReceiveToolsReturn =
      isReceiveToolsDocument(currentDocument?.documentType) &&
      isReceiveToolsReturnRow(item);

    if (isReceiveToolsReturn && nameControl === 'price' && (value === 0 || value === undefined || value === null)) {
      return '';
    }
    
    // Convert bigint to number for input compatibility
    if (typeof value === 'bigint') {
      return Number(value);
    }
    
    if (value === 0 || typeof value === 'number') return value;
    return value ?? '';
  }, [currentDocument, itemIndexInTable, nameControl]);


  // Функция для проверки остатков (live stock, иначе item.balance со строки)
  const checkStockAvailability = useCallback((
    analiticId: number,
    requestedQuantity: number,
    rowBalance?: number,
  ): { isValid: boolean; availableQuantity: number; errorMessage?: string; skipHardClamp?: boolean } => {
    if (!currentDocument) {
      return { isValid: false, availableQuantity: 0, errorMessage: 'Документ не загружен' };
    }

    const storageId = getStorageIdForDocument(
      currentDocument.documentType, 
      currentDocument?.docValues?.senderId, 
      currentDocument?.docValues?.receiverId
    );
    const warehouseId = storageId || 20125;
    
    // Определяем счет на основе типа документа
    const documentType = currentDocument.documentType;
    const schet = documentType ? getSchetForDocumentType(documentType as DocumentType) : 'S29';
    const stockData = getStock(schet, `${warehouseId}:${analiticId}`);

    const liveQty =
      stockData?.totalQuantity != null && Number.isFinite(Number(stockData.totalQuantity))
        ? Number(stockData.totalQuantity)
        : null;
    const fromRow = Number(rowBalance) || 0;
    // Не затираем fill-balance нулём из WS; без данных — не клампим к 0
    const totalQuantity =
      liveQty != null && liveQty > 0
        ? liveQty
        : fromRow > 0
          ? fromRow
          : liveQty;

    if (totalQuantity == null) {
      return {
        isValid: true,
        availableQuantity: 0,
        skipHardClamp: true,
        errorMessage: 'Остатки не загружены',
      };
    }
    
    // Для проверки используем общее количество товара, а не только доступное
    if (requestedQuantity > totalQuantity) {
      return { 
        isValid: false, 
        availableQuantity: totalQuantity, 
        errorMessage: `Недостаточно товара на складе. Всего: ${totalQuantity.toFixed(2)}` 
      };
    }

    return { isValid: true, availableQuantity: totalQuantity };
  }, [currentDocument, getStock]);

  // Мемоизируем обработчик изменений
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    const rawValue = (target.value || '').toString().trim().replace(/[\s\u00A0]/g, '').replace(/,/g, '.');
    
    // Обрабатываем пустые значения и нечисловые символы
    let value = 0;
    if (rawValue !== '' && !isNaN(parseFloat(rawValue))) {
      value = parseFloat(rawValue);
    }

    if (!currentDocument?.docTableItems) return;

    const currentItem = { ...currentDocument.docTableItems[itemIndexInTable] };
    if (!currentItem) return;

    const isReceiveToolsReturn =
      isReceiveToolsDocument(currentDocument.documentType) &&
      isReceiveToolsReturnRow(currentItem);

    if (isReceiveToolsReturn && nameControl === 'total') {
      return;
    }

    const storageId = currentDocument.documentType == DocumentType.SaleProd ? currentDocument?.docValues?.senderId : currentDocument?.docValues?.receiverId;
	const warehouseId = storageId || 20125;
    const oldQuantity = currentItem.count || 0;

    // Обработка числовых полей (кроме price, count, countByBox и total, которые обрабатываются отдельно)
    if (NUMERIC_CONTROLS.includes(nameControl) && nameControl !== 'price' && nameControl !== 'count' && nameControl !== 'countByBox' && nameControl !== 'total') {
      if (isReceiveToolsReturn && nameControl === 'rentHours') {
        if (value > 0 && value < MIN_RENT_HOURS) {
          setValidationError({
            hasError: true,
            message: 'Ижара вақти камида 24 соат бўлиши керак',
          });
        } else {
          setValidationError({ hasError: false });
        }
        currentItem.rentHours = clampRentHours(value);
      } else {
        (currentItem as any)[nameControl] = value;
      }
    }

    // Обратный пересчёт: сумма → цена
    if (nameControl === 'total') {
      let newTotal = roundToTwoDecimals(value);
      const count = currentItem.count || 0;
      const isReceiveToolsSale =
        isReceiveToolsDocument(currentDocument.documentType) &&
        currentItem.tableType === 'sale';

      if (isReceiveToolsSale) {
        const costTotal = roundToTwoDecimals(
          (currentItem.costPrice || 0) * count,
        );
        if (newTotal < costTotal - 0.0001) {
          newTotal = costTotal;
          setValidationError({
            hasError: true,
            message: 'Сотиш суммаси себестоимостьдан паст бўлмаслиги керак',
          });
        } else {
          setValidationError({ hasError: false });
        }
      }

      currentItem.total = newTotal;
      if (count > 0) {
        currentItem.price = roundToTwoDecimals(newTotal / count);
        if (!isReceiveToolsSale) {
          setValidationError({ hasError: false });
        }
      } else if (value > 0) {
        setValidationError({ hasError: true, message: 'Аввал миқдорни киритинг' });
      }
    }

    // Специальная обработка для поля price
    if (nameControl === 'price') {
      let priceValue = roundToTwoDecimals(value);
      const isReceiveToolsSale =
        isReceiveToolsDocument(currentDocument.documentType) &&
        currentItem.tableType === 'sale';

      if (isReceiveToolsSale) {
        const costPrice = roundToTwoDecimals(currentItem.costPrice || 0);
        if (priceValue < costPrice - 0.0001) {
          priceValue = costPrice;
          setValidationError({
            hasError: true,
            message: 'Нарх себестоимостьдан паст бўлмаслиги керак',
          });
        } else {
          setValidationError({ hasError: false });
        }
      }

      currentItem.price = priceValue;

      if (isReceiveToolsReturn) {
        const returnDateTime = getReceiveToolsReturnDateTime(currentDocument);
        Object.assign(currentItem, recalcReceiveToolsReturnRow(currentItem, returnDateTime));
      } else {
        // Пересчитываем total и costTotal при изменении цены
        const count = currentItem.count || 0;
        currentItem.total = roundToTwoDecimals(count * priceValue);
        currentItem.costTotal = roundToTwoDecimals(count * (currentItem.costPrice || 0));
      }
    }

    
    // Обработка изменения количества товара - обновляем резерв и пересчитываем коробки
    if (nameControl === 'count') {
      // Проверяем остатки только для расходных документов
      const typeDocumentByComeOut = currentDocument.documentType ? getDocumentTypeByComeOut(currentDocument.documentType as DocumentType) : 'out';
      
      if (typeDocumentByComeOut === 'out' && value > 0 && currentDocument.documentType !== DocumentType.OrderToolsToClient) {
        const stockCheck = checkStockAvailability(
          currentItem.analiticId,
          value,
          currentItem.balance,
        );
        
        if (!stockCheck.isValid && !stockCheck.skipHardClamp) {
          setValidationError({ hasError: true, message: stockCheck.errorMessage });
          const maxAvailable = Math.floor(stockCheck.availableQuantity * 100) / 100;
          currentItem.count = maxAvailable;
          console.warn(`⚠️ Количество ограничено остатками: ${maxAvailable} (запрошено: ${value})`);
        } else {
          currentItem.count = value;
          if (stockCheck.skipHardClamp && stockCheck.errorMessage) {
            setValidationError({ hasError: true, message: stockCheck.errorMessage });
          } else {
            setValidationError({ hasError: false });
          }
        }
      } else {
        currentItem.count = value;
      }
      
      const newQuantity = currentItem.count || 0;
      const quantityDiff = newQuantity - oldQuantity;
      
      // Синхронизируем количество коробок
      const refCountInBox = currentItem.refCountInBox || 1;
      
      if (refCountInBox && refCountInBox > 0) {
        // currentItem.countByBox = Math.ceil(newQuantity / refCountInBox);
        currentItem.countByBox = newQuantity / refCountInBox;
      }
      
      if (quantityDiff !== 0) {
        // Логика резервов удалена - работаем только с доступностью
      }
    }

    // Синхронизация количества и коробок
    if (nameControl === 'countByBox') {
      // Получаем информацию о товаре для определения countInBox
      const refCountInBox = currentItem.refCountInBox || 1;
      // Пересчитываем общее количество используя НОВОЕ значение коробок
      const newBoxCount = value;
      const newTotalQuantity = newBoxCount * refCountInBox;
      
      // Проверяем остатки только для расходных документов
      const typeDocumentByComeOut = currentDocument.documentType ? getDocumentTypeByComeOut(currentDocument.documentType as DocumentType) : 'out';
      
      if (typeDocumentByComeOut === 'out' && newTotalQuantity > 0 && currentDocument.documentType !== DocumentType.OrderToolsToClient) {
        const stockCheck = checkStockAvailability(
          currentItem.analiticId,
          newTotalQuantity,
          currentItem.balance,
        );
        
        if (!stockCheck.isValid && !stockCheck.skipHardClamp) {
          setValidationError({ hasError: true, message: stockCheck.errorMessage });
          const maxAvailableBoxes = Math.floor((stockCheck.availableQuantity / refCountInBox) * 100) / 100;
          currentItem.countByBox = maxAvailableBoxes;
          currentItem.count = maxAvailableBoxes * refCountInBox;
          console.warn(`⚠️ Количество коробок ограничено остатками: ${maxAvailableBoxes} (запрошено: ${newBoxCount})`);
        } else {
          currentItem.countByBox = newBoxCount;
          currentItem.count = newTotalQuantity;
          if (stockCheck.skipHardClamp && stockCheck.errorMessage) {
            setValidationError({ hasError: true, message: stockCheck.errorMessage });
          } else {
            setValidationError({ hasError: false });
          }
        }
      } else {
        currentItem.countByBox = newBoxCount;
        currentItem.count = newTotalQuantity;
      }
      
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

      if (isReceiveToolsReturn) {
        const returnDateTime = getReceiveToolsReturnDateTime(currentDocument);
        Object.assign(currentItem, recalcReceiveToolsReturnRow(currentItem, returnDateTime));
      } else {
        currentItem.total = roundToTwoDecimals(count * price);
        currentItem.costTotal = roundToTwoDecimals(count * costPrice);
      }

      if (
        currentDocument.documentType === DocumentType.TransferToolsToClient ||
        currentDocument.documentType === DocumentType.OrderToolsToClient ||
        currentDocument.documentType === DocumentType.TransferSubleaseToolsToClient
      ) {
        const tariff = currentItem.hourlyTariff || 0;
        currentItem.dailyRent = roundToTwoDecimals(tariff * count * 24);
      }
      
      console.log(`🧮 Пересчет: ${count} × ${price} = ${currentItem.total} (${nameControl})`);
    }

    if (
      isReceiveToolsReturn &&
      (nameControl === 'rentHours' || nameControl === 'hourlyTariff')
    ) {
      const returnDateTime = getReceiveToolsReturnDateTime(currentDocument);
      Object.assign(currentItem, recalcReceiveToolsReturnRow(currentItem, returnDateTime));
    }

    if (
      (currentDocument.documentType === DocumentType.TransferToolsToClient ||
        currentDocument.documentType === DocumentType.OrderToolsToClient ||
        currentDocument.documentType === DocumentType.TransferSubleaseToolsToClient) &&
      (nameControl === 'hourlyTariff' || nameControl === 'count')
    ) {
      const count = currentItem.count || 0;
      const tariff = currentItem.hourlyTariff || 0;
      currentItem.dailyRent = roundToTwoDecimals(tariff * count * 24);
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
  }, [currentDocument, itemIndexInTable, nameControl, setMainData, checkStockAvailability, user?.role]);

  return {
    currentValue,
    handleChange,
    hasError: validationError.hasError,
    errorMessage: validationError.message
  };
}; 