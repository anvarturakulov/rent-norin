'use client'
import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { Product, convertProductToDocTableItem } from '@/app/interfaces/product.interface';
import { DocTableItem, DocumentModel, DocumentType, TypeDocumentByComeOut } from '@/app/interfaces/document.interface';
import { useProductCatalog } from '@/app/hooks/useProductCatalog';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { BtnOpenCatalog } from '@/app/components/common/button/btnOpenCatalog';
import { getStockByItem } from '@/app/service/stocks/getStockByItem';
import { useGlobalStockManagement } from '@/app/context/websocket.context';
import { getSchetForDocumentRow } from '@/app/service/documents/getSchetForDocumentRow';
import { ReplaceRowContext, toCatalogFocusProduct } from './replaceRowContext';
import {
  enrichTransferToolsRow,
  recalcTransferToolsRowTotals,
} from '@/app/service/documents/buildTransferToolsRow';
import {
  enrichSubleaseToolsRow,
  recalcSubleaseToolsRowTotals,
} from '@/app/service/documents/buildSubleaseToolsRow';
import { getRentTariffFallbackFromRefValues } from '@/app/service/documents/rentTariffType';
import { showMessage } from '@/app/service/common/showMessage';

const getHasRequiredStorage = (
  currentDocument: DocumentModel | undefined,
  typeDocumentByComeOut: TypeDocumentByComeOut,
): boolean => {
  if (!currentDocument?.docValues) return false;
  const { senderId, receiverId } = currentDocument.docValues;
  const isComeDocument = typeDocumentByComeOut === 'come';
  const isSubleaseTransfer =
    currentDocument.documentType === DocumentType.TransferSubleaseToolsToClient;

  if (isSubleaseTransfer) {
    return !!(senderId && senderId > 0);
  }
  if (currentDocument.documentType === DocumentType.ReceiveToolsFromClient) {
    return !!(receiverId && receiverId > 0 && senderId && senderId > 0);
  }
  if (isComeDocument) {
    return !!(receiverId && receiverId > 0);
  }
  return !!(senderId && senderId > 0);
};

const getMissingStorageMessage = (
  currentDocument: DocumentModel | undefined,
  typeDocumentByComeOut: TypeDocumentByComeOut,
): string => {
  if (currentDocument?.documentType === DocumentType.TransferSubleaseToolsToClient) {
    return 'Ҳамкор омборини танланг';
  }
  if (typeDocumentByComeOut === 'come') {
    return 'Қабул қилувчи складни танланг';
  }
  return 'Жунатувчи складни танланг';
};

interface ProductCatalogIntegrationProps {
  warehouseId?: number;
  openCatalogRef?: React.MutableRefObject<(() => void) | null>;
  typeDocumentByComeOut: TypeDocumentByComeOut;
  replaceRowContext?: ReplaceRowContext | null;
  onReplaceRowContextChange?: (context: ReplaceRowContext | null) => void;
  tableTypeOverride?: 'return' | 'brak' | 'sale' | 'tovar';
}

export const ProductCatalogIntegration = memo<ProductCatalogIntegrationProps>(({
  warehouseId,
  openCatalogRef,
  typeDocumentByComeOut,
  replaceRowContext = null,
  onReplaceRowContextChange,
  tableTypeOverride,
}) => {
  const { mainData, setMainData } = useAppContext();
  const { updateStocks } = useGlobalStockManagement();
  
  
  const { currentDocument, showDocumentWindow } = mainData.document;
  
  const currentDocTableItems = currentDocument?.docTableItems || [];
  
  // Отслеживаем закрытие документа
  useEffect(() => {
    // Document window state changed
  }, [showDocumentWindow]);

  const handleProductSelected = useCallback(async (product: Product, quantity: number, customPrice?: number) => {
    // Проверяем, что currentDocument полностью инициализирован
    if (!currentDocument || !currentDocument.documentType || !currentDocument.docValues) {
      alert('Ошибка: документ не полностью инициализирован. Пожалуйста, подождите или обновите страницу.');
      return;
    }
    
    const documentType = currentDocument.documentType;

    const schet = getSchetForDocumentRow(
      documentType,
      product.refValues?.typeTMZ,
      tableTypeOverride,
    );
    
    const documentDate = currentDocument.date || Date.now();
    const enterpriseId = currentDocument.enterpriseId || mainData.users.user?.enterpriseId;
    const rentTariffType = currentDocument.docValues?.rentTariffType;
    const rentTariffFallback = getRentTariffFallbackFromRefValues(
      product.refValues,
      rentTariffType,
    );

    // Получаем остаток через REST API с учетом организации для расчета себестоимости
    // Субаренда: остаток партнёра неизвестен — не запрашиваем и не блокируем
    const isSubleaseTransfer =
      documentType === DocumentType.TransferSubleaseToolsToClient;
    let stockData = null;
    if (!isSubleaseTransfer) {
    try {
      let actualWarehouseId =
        warehouseId ||
        currentDocument.docValues.senderId ||
        currentDocument.docValues.receiverId;
      let stockSchet = schet;

      if (documentType === DocumentType.ReceiveToolsFromClient) {
        if (tableTypeOverride === 'tovar') {
          actualWarehouseId = currentDocument.docValues.receiverId;
          stockSchet = 'S29' as typeof schet;
        } else if (tableTypeOverride === 'return' || tableTypeOverride === 'sale') {
          actualWarehouseId = currentDocument.docValues.senderId;
          stockSchet = 'S12' as typeof schet;
        } else {
          actualWarehouseId = currentDocument.docValues.receiverId;
          stockSchet = 'S11' as typeof schet;
        }
      }
      
      if (actualWarehouseId) {
        stockData = await getStockByItem(
          stockSchet,
          actualWarehouseId,
          product.id,
          documentDate,
          enterpriseId ?? undefined,
          mainData.users.user?.token
        );
        
        // Сохраняем остаток в локальное состояние для отображения в таблице
        updateStocks({
          type: 'update',
          stocks: {
            [schet]: {
              [`${actualWarehouseId}:${product.id}`]: stockData
            }
          }
        });
      }
    } catch (error) {
      // Для документов расхода (out) остатки обязательны для расчета себестоимости
      if (typeDocumentByComeOut === 'out') {
        alert(`Ошибка получения остатков для товара "${product.name}". Невозможно рассчитать себестоимость.`);
        return; // Прерываем выполнение, так как себестоимость обязательна
      }
      // Для приходных документов и заказов продолжаем без остатка
    }
    }
    
    // Получаем актуальные данные из currentDocument
    const actualDocTableItems = currentDocument.docTableItems || [];

    const clearReplaceMode = () => onReplaceRowContextChange?.(null);

    const replaceRowIndex = replaceRowContext?.rowIndex ?? null;

    // Режим замены номенклатуры в существующей строке
    if (replaceRowIndex !== null && replaceRowIndex >= 0 && replaceRowIndex < actualDocTableItems.length) {
      const duplicateIndex = actualDocTableItems.findIndex(
        (item, i) => item.analiticId === product.id && i !== replaceRowIndex
      );
      if (duplicateIndex >= 0) {
        const proceed = window.confirm(
          `Товар "${product.name}" уже есть в документе (строка ${duplicateIndex + 1}). Всё равно заменить текущую позицию?`
        );
        if (!proceed) return;
      }

      const oldItem = actualDocTableItems[replaceRowIndex];
      try {
        let newDocTableItem = convertProductToDocTableItem(
          product,
          quantity,
          typeDocumentByComeOut,
          stockData ?? undefined,
          customPrice,
          currentDocument.documentType,
          mainData.users.user?.role
        );
        if (documentType === DocumentType.TransferToolsToClient || documentType === DocumentType.OrderToolsToClient) {
          newDocTableItem = await enrichTransferToolsRow(
            newDocTableItem,
            documentDate,
            mainData.users.user?.token,
            enterpriseId ?? undefined,
            rentTariffFallback,
            rentTariffType,
          );
        }
        if (documentType === DocumentType.TransferSubleaseToolsToClient) {
          newDocTableItem = await enrichSubleaseToolsRow(
            newDocTableItem,
            documentDate,
            mainData.users.user?.token,
            enterpriseId ?? undefined,
            product.refValues?.firstPrice,
            product.refValues?.secondPrice,
          );
        }
        const updatedDocTableItems = [...actualDocTableItems];
        updatedDocTableItems[replaceRowIndex] = {
          ...newDocTableItem,
          tableType: oldItem.tableType,
        };
        setMainData?.('currentDocument', {
          ...currentDocument,
          docTableItems: updatedDocTableItems,
        });
        clearReplaceMode();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        alert(`Ошибка при замене товара "${product.name}": ${errorMessage}`);
      }
      return;
    }
    
    // Проверяем, есть ли уже такой товар в документе
    const existingItemIndex = actualDocTableItems.findIndex(item => item.analiticId === product.id);
    
    let updatedDocTableItems: DocTableItem[];
    
    if (existingItemIndex >= 0) {
      // Товар уже есть - увеличиваем количество
      updatedDocTableItems = [...actualDocTableItems];
      const existingItem = updatedDocTableItems[existingItemIndex];
      const newQuantity = (existingItem.count || 0) + quantity;

      if (documentType === DocumentType.TransferToolsToClient || documentType === DocumentType.OrderToolsToClient) {
        const recalced = recalcTransferToolsRowTotals(existingItem, newQuantity);
        updatedDocTableItems[existingItemIndex] = await enrichTransferToolsRow(
          recalced,
          documentDate,
          mainData.users.user?.token,
          enterpriseId ?? undefined,
          rentTariffFallback,
          rentTariffType,
        );
      } else if (documentType === DocumentType.TransferSubleaseToolsToClient) {
        const recalced = recalcSubleaseToolsRowTotals(existingItem, newQuantity);
        updatedDocTableItems[existingItemIndex] = await enrichSubleaseToolsRow(
          recalced,
          documentDate,
          mainData.users.user?.token,
          enterpriseId ?? undefined,
          product.refValues?.firstPrice,
          product.refValues?.secondPrice,
        );
      } else {
        updatedDocTableItems[existingItemIndex] = {
          ...existingItem,
          count: newQuantity,
          total: +(newQuantity * existingItem.price).toFixed(2),
          costTotal: +(newQuantity * existingItem.costPrice).toFixed(2),
        };
      }
    } else {
      // Новый товар - добавляем с расчетом себестоимости
      try {
        let newDocTableItem = convertProductToDocTableItem(
          product,
          quantity,
          typeDocumentByComeOut,
          stockData ?? undefined,
          customPrice,
          currentDocument.documentType,
          mainData.users.user?.role,
        );

        if (documentType === DocumentType.TransferToolsToClient || documentType === DocumentType.OrderToolsToClient) {
          newDocTableItem = await enrichTransferToolsRow(
            newDocTableItem,
            documentDate,
            mainData.users.user?.token,
            enterpriseId ?? undefined,
            rentTariffFallback,
            rentTariffType,
          );
        }
        if (documentType === DocumentType.TransferSubleaseToolsToClient) {
          newDocTableItem = await enrichSubleaseToolsRow(
            newDocTableItem,
            documentDate,
            mainData.users.user?.token,
            enterpriseId ?? undefined,
            product.refValues?.firstPrice,
            product.refValues?.secondPrice,
          );
        }

        if (
          currentDocument.documentType === DocumentType.ReceiveToolsFromClient &&
          tableTypeOverride
        ) {
          newDocTableItem.tableType = tableTypeOverride;
          newDocTableItem.total = newDocTableItem.costTotal;
          newDocTableItem.price = newDocTableItem.costPrice;
        }

        updatedDocTableItems = [...actualDocTableItems, newDocTableItem];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        alert(`Ошибка при добавлении товара "${product.name}": ${errorMessage}`);
        return;
      }
    }

    // Обновляем контекст - важно обновлять весь currentDocument, а не только docTableItems
    const updatedDocument = {
      ...currentDocument,
      docTableItems: updatedDocTableItems
    };
    
    setMainData && setMainData('currentDocument', updatedDocument);
  }, [currentDocument, setMainData, warehouseId, typeDocumentByComeOut, mainData, updateStocks, replaceRowContext, onReplaceRowContextChange, tableTypeOverride]);

  const { isOpen, openCatalog, closeCatalog, handleSelectProduct } = useProductCatalog({
    onProductSelected: handleProductSelected,
    currentDocTableItems
  });

  const hasRequiredStorage = useMemo(
    () => getHasRequiredStorage(currentDocument, typeDocumentByComeOut),
    [
      currentDocument,
      typeDocumentByComeOut,
      currentDocument?.docValues?.senderId,
      currentDocument?.docValues?.receiverId,
      currentDocument?.documentType,
    ],
  );

  const missingStorageMessage = useMemo(
    () => getMissingStorageMessage(currentDocument, typeDocumentByComeOut),
    [currentDocument?.documentType, typeDocumentByComeOut],
  );

  const handleOpenCatalog = useCallback(() => {
    if (!hasRequiredStorage) {
      showMessage(missingStorageMessage, 'error', setMainData);
      return;
    }
    openCatalog();
  }, [hasRequiredStorage, missingStorageMessage, setMainData, openCatalog]);

  const handleCloseCatalog = useCallback(() => {
    onReplaceRowContextChange?.(null);
    closeCatalog();
  }, [closeCatalog, onReplaceRowContextChange]);

  const catalogMode = replaceRowContext !== null ? 'replace' as const : 'add' as const;
  const focusProduct = toCatalogFocusProduct(replaceRowContext);

  // Передаем функцию открытия каталога наверх через ref
  useEffect(() => {
    if (openCatalogRef) {
      openCatalogRef.current = handleOpenCatalog;
    }
  }, [openCatalogRef, handleOpenCatalog]);

  useEffect(() => {
    if (!hasRequiredStorage && isOpen) {
      closeCatalog();
    }
  }, [hasRequiredStorage, isOpen, closeCatalog]);

  // Разрешение отрицательного остатка: субаренда — без остатка партнёра
  const allowNegativeStock = useMemo(
    () =>
      currentDocument?.documentType ===
        DocumentType.TransferSubleaseToolsToClient ||
      currentDocument?.documentType === DocumentType.OrderToolsToClient,
    [currentDocument?.documentType],
  );

  // Проверяем, что currentDocument инициализирован и содержит необходимые поля ПОСЛЕ всех хуков
  if (!currentDocument || !currentDocument.documentType || !currentDocument.docValues) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        Ошибка: документ не полностью инициализирован. Пожалуйста, подождите или обновите страницу.
      </div>
    );
  }

  // Если склад не выбран, показываем сообщение
  if (!hasRequiredStorage) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
        {missingStorageMessage}
      </div>
    );
  }

  return (
    <>
      {currentDocTableItems.length === 0 &&
        currentDocument.documentType !== DocumentType.TransferToolsToClient &&
        currentDocument.documentType !== DocumentType.OrderToolsToClient &&
        currentDocument.documentType !==
          DocumentType.TransferSubleaseToolsToClient && (
          <BtnOpenCatalog onClick={handleOpenCatalog} />
        )}
      
      <ProductCatalog
        isOpen={isOpen}
        onClose={handleCloseCatalog}
        onSelectProduct={handleSelectProduct}
        warehouseId={warehouseId}
        typeDocumentByComeOut={typeDocumentByComeOut}  
        documentType={currentDocument.documentType}
        documentDate={currentDocument.date}
        allowNegativeStock={allowNegativeStock}
        catalogMode={catalogMode}
        focusProduct={focusProduct}
      />
    </>
  );
});

ProductCatalogIntegration.displayName = 'ProductCatalogIntegration';

export type { ReplaceRowContext } from './replaceRowContext';
