import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDocTableData } from './hooks/useDocTableData';
import TableHeader from './components/TableHeader';
import TableRow from './components/TableRow';
import TableFooter from './components/TableFooter';
import { TypeReference, ReferenceModel } from '@/app/interfaces/reference.interface';
import styles from './docTableCatalog.module.css';
import TableEmptyBox from './components/TableEmptyBox';
import { ProductCatalogIntegration } from './productCatalogIntegration';
import { useGlobalStockManagement } from '@/app/context/websocket.context';
import { useAppContext } from '@/app/context/app.context';
import {
  DocumentType,
  shouldShowMaterialsExpenseTable,
  getLeaveMaterialCatalogItems,
  getIncomeItems,
  getExpenseItems,
  getSaleItems,
  shouldShowReceiveToolsTables,
} from '@/app/interfaces/document.interface';
import { importProductsToDocument } from '@/app/service/documents/importProductsToDocument';
import { DocTableCatalogProps } from './docTableCatalog.props';
import { getStorageIdForDocument } from '@/app/service/documents/getStorageIdForDocument';
import { getSchetForDocumentRow } from '@/app/service/documents/getSchetForDocumentRow';
import MaterialsTable from './components/MaterialsTable';
import ReceiveToolsTables from './components/ReceiveToolsTables';
import TransferToolsSaleTable from './components/TransferToolsSaleTable';
import TransferToolsPickerModal from './components/transferToolsPickerModal/transferToolsPickerModal';
import FormworkPlannerModal from './components/formworkPlannerModal/formworkPlannerModal';
import { 
  calculateMaterialsForProducts, 
  convertMaterialsToDocTableItems, 
  extractProductsFromDocTableItems,
  recalculateProductCostFromMaterials,
} from '@/app/service/productCalculations/calculateMaterials';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { ReplaceRowContext } from './replaceRowContext';
import { getTransferToolsPreviewParams } from '@/app/service/documents/fetchTransferToolsPreview';
import { showMessage } from '@/app/service/common/showMessage';

export const DocTableCatalog = ({ 
  items, 
  typeDocumentByComeOut 
}: DocTableCatalogProps) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const [isCalculating, setIsCalculating] = useState(false);
  const [replaceRowContext, setReplaceRowContext] = useState<ReplaceRowContext | null>(null);
  const [transferPickerOpen, setTransferPickerOpen] = useState(false);
  const [formworkOpen, setFormworkOpen] = useState(false);
  const { data: references } = useAllReferences(user?.token);
  const enterpriseId = currentDocument?.enterpriseId || user?.enterpriseId;

  // Разделяем элементы на готовую продукцию и материалы
  const documentType = currentDocument?.documentType as DocumentType | undefined;
  const isLeaveMaterial = documentType === DocumentType.LeaveMaterial;
  const incomeItems = getIncomeItems(items || []);
  const expenseItems = getExpenseItems(items || []);
  const catalogItems = isLeaveMaterial
    ? getLeaveMaterialCatalogItems(items || [])
    : incomeItems;

  const isTransferTools = documentType === DocumentType.TransferToolsToClient;
  const isOrderTools = documentType === DocumentType.OrderToolsToClient;
  const isTransferSublease =
    documentType === DocumentType.TransferSubleaseToolsToClient;
  const isToolsTransferDoc = isTransferTools || isOrderTools || isTransferSublease;
  const saleItems = isTransferTools ? getSaleItems(items || []) : [];

  /** Реальные индексы строк в полном `docTableItems` */
  const catalogIndicesInFullDoc = useMemo(() => {
    const arr = items || [];
    const indices: number[] = [];
    arr.forEach((it, i) => {
      if (isLeaveMaterial) {
        if (
          it.tableType !== 'return' &&
          it.tableType !== 'brak' &&
          it.tableType !== 'sale' &&
          it.tableType !== 'tovar'
        ) {
          indices.push(i);
        }
      } else if (isToolsTransferDoc) {
        // Инструменты аренды / субаренды — без строк продажи товаров
        if (!it.tableType || it.tableType === 'income') {
          indices.push(i);
        }
      } else if (!it.tableType || it.tableType === 'income') {
        indices.push(i);
      }
    });
    return indices;
  }, [items, isLeaveMaterial, isToolsTransferDoc]);

  // Обработчик удаления товара
  const handleItemDeleted = useCallback((analiticId: number) => {
    console.log(`🗑️ Товар ${analiticId} удален из документа`);
  }, []);

  // Используем кастомный хук для данных
  const {
    tableState,
    handleDeleteItem,
    handleLoadBalance
  } = useDocTableData(items || [], handleItemDeleted);

  // Ref для функции открытия каталога
  const openCatalogRef = useRef<(() => void) | null>(null);

	// ------- Реалтайм остатки для строк таблицы -------
  const storageId = getStorageIdForDocument(currentDocument?.documentType as string, currentDocument?.docValues?.senderId, currentDocument?.docValues?.receiverId);
	
  const warehouseId = storageId; 
	const { updateStocks, addVisibleItem, removeVisibleItem, getVisibleSubscriptions } = useGlobalStockManagement();

	// Убираем локальное подключение WebSocket - теперь используем глобальное
	// WebSocket подключается автоматически в WebSocketProvider

	// Подписки теперь обрабатываются автоматически в WebSocketProvider
	// Локальные подписки больше не нужны

	const handleRowSubscribe = useCallback((analiticId: number, itemTableType?: 'income' | 'expense') => {
		const documentType = currentDocument?.documentType;
		const typeTMZ = references?.find((ref: ReferenceModel) => ref.id === analiticId)?.refValues?.typeTMZ;
		const schet = getSchetForDocumentRow(documentType as DocumentType, typeTMZ, itemTableType);
		
		console.log(`📡 DocTableCatalog: подписываемся на остатки для товара ${analiticId}`, {
			warehouseId,
			schet,
			itemTableType,
			itemKey: `${warehouseId}:${analiticId}`
		});
		addVisibleItem(schet, `${warehouseId}:${analiticId}`);
	}, [addVisibleItem, warehouseId, currentDocument, references]);

	const handleRowUnsubscribe = useCallback((analiticId: number, itemTableType?: 'income' | 'expense') => {
		const documentType = currentDocument?.documentType;
		const typeTMZ = references?.find((ref: ReferenceModel) => ref.id === analiticId)?.refValues?.typeTMZ;
		const schet = getSchetForDocumentRow(documentType as DocumentType, typeTMZ, itemTableType);
		
		removeVisibleItem(schet, `${warehouseId}:${analiticId}`);
	}, [removeVisibleItem, warehouseId, currentDocument, references]);

	// Отслеживание изменений в составе документа
	useEffect(() => {
		// Логика резервов удалена - работаем только с доступностью
		console.log('📋 Состав документа обновлен:', items?.length || 0, 'товаров');
	}, [items]);

  // Функция для открытия каталога из кнопки в TableHeader (добавление)
  const handleOpenCatalogFromHeader = useCallback(() => {
    setReplaceRowContext(null);
    if (openCatalogRef.current) {
      openCatalogRef.current();
    }
  }, []);

  const handleOpenTransferPicker = useCallback(() => {
    if (!currentDocument) return;
    const { error } = getTransferToolsPreviewParams(currentDocument, enterpriseId ?? null);
    if (error) {
      showMessage(error, 'error', setMainData);
      return;
    }
    setTransferPickerOpen(true);
  }, [currentDocument, enterpriseId, setMainData]);

  const handleOpenCatalogForRow = useCallback((documentRowIndex: number) => {
    const item = currentDocument?.docTableItems?.[documentRowIndex];
    if (!item) return;
    const ref = references?.find((r: { id: number }) => r.id === item.analiticId);
    setReplaceRowContext({
      rowIndex: documentRowIndex,
      analiticId: item.analiticId,
      productName: ref?.name,
      productArticle: ref?.article,
    });
    if (openCatalogRef.current) {
      openCatalogRef.current();
    }
  }, [currentDocument?.docTableItems, references]);

  // Функция импорта товаров
  const handleImportProducts = useCallback(async () => {
    console.log('handleImportProducts вызвана');
    
    if (!setMainData || !user?.token) {
      console.error('Нет доступа к setMainData или токену пользователя');
      return;
    }

    if (!currentDocument) {
      console.error('Документ не загружен');
      return;
    }

    if (!currentDocument.docTableItems) {
      console.log('docTableItems не существует, создаем пустой массив');
    }

    console.log('Текущие элементы документа:', currentDocument.docTableItems?.length || 0);

    await importProductsToDocument(
      setMainData,
      user.token,
      currentDocument.docTableItems || []
    );
  }, [setMainData, user?.token, currentDocument]);

  // Функция для расчета материалов - НОВАЯ АРХИТЕКТУРА
  const handleCalculateMaterials = useCallback(async () => {
    if (!user?.token || !currentDocument) {
      console.error('❌ [NEW ARCH] Нет токена пользователя или документа');
      return;
    }

    if (!incomeItems || incomeItems.length === 0) {
      console.warn('⚠️ [NEW ARCH] Нет готовой продукции для расчета материалов');
      alert('Сначала добавьте готовую продукцию в документ, затем нажмите "Заполнить материалы"');
      return;
    }

    // Проверяем наличие существующих материалов и предупреждаем пользователя
    const existingMaterials = currentDocument.docTableItems?.filter(item => item.tableType === 'expense') || [];
    
    if (existingMaterials.length > 0) {
      const confirmRecalculate = confirm(
        `В документе уже есть ${existingMaterials.length} материалов. ` +
        'Пересчитать материалы заново? Старые материалы будут удалены.'
      );
      
      if (!confirmRecalculate) {
        return;
      }
    }

    setIsCalculating(true);
    try {
      console.log('🧮 [NEW ARCH] Начинаем расчет материалов для продуктов:', incomeItems);
      console.log('📋 [NEW ARCH] Текущий документ:', { id: currentDocument.id, docValues: currentDocument.docValues });
      
      // Извлекаем продукты из таблицы готовой продукции
      const products = extractProductsFromDocTableItems(incomeItems);
      console.log('🔍 [NEW ARCH] Извлеченные продукты для расчета:', products);
      
      if (products.length === 0 || products.every(p => p.quantity === 0)) {
        alert('Укажите количество готовой продукции перед расчетом материалов');
        return;
      }
      
      // Получаем склад для расчета остатков 
      // Для документа ComeProduct: receiverId - склад откуда берем материалы для расчета себестоимости
      // Для документа SaleProd: senderId - склад откуда продается продукция (склад материалов и готовой продукции)
      const materialWarehouseId = currentDocument.documentType === DocumentType.SaleProd 
        ? (currentDocument.docValues?.senderId || 1)  // Для SaleProd используем senderId
        : (currentDocument.docValues?.receiverId || 1); // Для ComeProduct и других используем receiverId
      const productWarehouseId = currentDocument.documentType === DocumentType.SaleProd
        ? (currentDocument.docValues?.senderId || 1)  // Для SaleProd используем senderId
        : (currentDocument.docValues?.receiverId || 1); // Для ComeProduct и других используем receiverId
      console.log('🏪 [NEW ARCH] Тип документа:', currentDocument.documentType);
      console.log('🏪 [NEW ARCH] Склад для расчета материалов ID:', materialWarehouseId, 'Склад готовой продукции ID:', productWarehouseId);
      
      // Рассчитываем материалы через НОВУЮ клиентскую логику (передаем склад материалов)
      const calculatedMaterials = await calculateMaterialsForProducts(currentDocument.date,products, user.token, materialWarehouseId);
      
      console.log('🔍 [NEW ARCH] Рассчитанные материалы:', calculatedMaterials);
      
      if (calculatedMaterials.length === 0) {
        console.warn('⚠️ [NEW ARCH] Не найдено калькуляций для выбранных продуктов');
        alert(
          'Для выбранных продуктов не найдено калькуляций материалов.\n\n' +
          'Убедитесь, что:\n' +
          '1. Калькуляции настроены в справочнике продукции\n' +
          '2. Указаны материалы и их количество на единицу продукции\n' +
          '3. Продукция имеет тип "PRODUCT" в справочнике'
        );
        return;
      }
      
      // Преобразуем в DocTableItem (остатки будут получены через WebSocket)
      const newMaterialItems = convertMaterialsToDocTableItems(calculatedMaterials);
      
      console.log('✅ [NEW ARCH] Материалы рассчитаны и преобразованы:', newMaterialItems.map(item => ({
        analiticId: item.analiticId,
        count: item.count,
        price: item.price,
        total: item.total,
        costPrice: item.costPrice,
        costTotal: item.costTotal,
        проверка_price: `${item.price} × ${item.count} = ${item.price * item.count}`,
        проверка_costTotal: `${item.costPrice} × ${item.count} = ${item.costPrice * item.count}`,
        совпадает_total: Math.abs(item.total - (item.price * item.count)) < 0.01,
        совпадает_costTotal: Math.abs(item.costTotal - (item.costPrice * item.count)) < 0.01
      })));
      
      // Удаляем старые материалы перед добавлением новых
      if (setMainData && currentDocument?.id) {
        const currentItems = currentDocument.docTableItems || [];
        
        // Оставляем только готовую продукцию (income), удаляем все материалы (expense)
        const productsOnly = currentItems.filter(item => item.tableType !== 'expense');
        
        // Добавляем новые материалы
        const updatedDocTableItems = [
          ...productsOnly,  // ✅ Только продукция
          ...newMaterialItems  // ✅ Новые материалы
        ];
        
        // Пересчитываем себестоимость готовой продукции на основе материалов
        console.log('\n🔄 [NEW ARCH] ========== НАЧАЛО ПЕРЕСЧЕТА СЕБЕСТОИМОСТИ ==========');
        console.log('📋 [NEW ARCH] Тип документа:', currentDocument.documentType);
        console.log('📅 [NEW ARCH] Дата документа:', currentDocument.date, new Date(currentDocument.date).toLocaleString('ru-RU'));
        console.log('🏪 [NEW ARCH] Склад материалов для расчета себестоимости:', materialWarehouseId);
        console.log('📦 [NEW ARCH] Элементы перед пересчетом себестоимости:', updatedDocTableItems.map((item, idx) => ({
          индекс: idx,
          analiticId: item.analiticId,
          tableType: item.tableType || 'undefined',
          count: item.count,
          costPrice: item.costPrice,
          costTotal: item.costTotal
        })));
        
        const recalculatedItems = await recalculateProductCostFromMaterials(
          currentDocument.date,
          updatedDocTableItems,
          user.token,
          materialWarehouseId
        );
        
        console.log('\n✅ [NEW ARCH] ========== ЗАВЕРШЕНИЕ ПЕРЕСЧЕТА СЕБЕСТОИМОСТИ ==========');
        console.log('📦 [NEW ARCH] Элементы после пересчета себестоимости:', recalculatedItems.map((item, idx) => ({
          индекс: idx,
          analiticId: item.analiticId,
          tableType: item.tableType || 'undefined',
          count: item.count,
          costPrice: item.costPrice,
          costTotal: item.costTotal,
          изменение_costPrice: updatedDocTableItems[idx]?.costPrice !== item.costPrice ? 
            `${updatedDocTableItems[idx]?.costPrice || 0} → ${item.costPrice}` : 'без изменений',
          изменение_costTotal: updatedDocTableItems[idx]?.costTotal !== item.costTotal ? 
            `${updatedDocTableItems[idx]?.costTotal || 0} → ${item.costTotal}` : 'без изменений'
        })));
        
        setMainData('currentDocument', {
          ...currentDocument,
          docTableItems: recalculatedItems,
        });
        
        console.log('📝 [NEW ARCH] Материалы обновлены в документе локально (старые удалены, новые добавлены)');
        console.log('📋 [NEW ARCH] Финальный порядок элементов в документе:');
        recalculatedItems.forEach((item, index) => {
          console.log(`${index + 1}. ID: ${item.analiticId}, Количество: ${item.count}, Тип: ${item.tableType || 'income'}`);
        });
        
        // Сохраняем изменения в бэкенд
        try {
          console.log('💾 [NEW ARCH] Попытка сохранения документа с ID:', currentDocument.id);
          
          // Проверяем корректность ID документа
          if (!currentDocument.id || currentDocument.id <= 0) {
            console.warn('⚠️ [NEW ARCH] Некорректный ID документа, пропускаем сохранение в бэкенд');
            return;
          }

          // Формируем тело запроса, очищая служебные поля (как в updateCreateDocument.ts)
          const requestBody: any = {
            ...currentDocument,
            docTableItems: recalculatedItems
          };
          
          // Удаляем служебные поля, которые не должны передаваться при обновлении
          delete requestBody.id; // ID передается в URL, не в теле запроса
          
          // Убеждаемся, что обязательные поля присутствуют
          if (!requestBody.userId && user?.id) {
            requestBody.userId = user.id;
          }
          
          // Удаляем userOldId - это поле не используется на бэкенде
          delete requestBody.userOldId;
          
          // date остается как number - бэкенд сам преобразует в bigint через ValidationPipe
          // Не преобразуем в BigInt здесь, так как JSON.stringify не может сериализовать BigInt

          console.log('📤 [NEW ARCH] Отправляем запрос на обновление документа:', {
            id: currentDocument.id,
            docTableItemsCount: recalculatedItems.length,
            hasUserId: !!requestBody.userId
          });

          const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/update/${currentDocument.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${user.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
          
          if (response.ok) {
            console.log('✅ [NEW ARCH] Документ сохранен в бэкенд');
            alert('Материалы успешно рассчитаны и добавлены в документ!');
          } else {
            // Получаем детали ошибки из ответа для диагностики
            let errorMessage = `HTTP ${response.status}`;
            let errorDetails: any = null;
            
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
              errorDetails = errorData;
            } catch (e) {
              try {
                const errorText = await response.text();
                console.error('❌ [NEW ARCH] Текст ошибки от сервера:', errorText);
              } catch (textError) {
                console.error('❌ [NEW ARCH] Не удалось прочитать ответ сервера');
              }
            }
            
            console.error('❌ [NEW ARCH] Ошибка сохранения документа в бэкенд:', {
              status: response.status,
              statusText: response.statusText,
              error: errorDetails || errorMessage
            });
            
            alert(`Материалы рассчитаны, но возникла ошибка при сохранении в базу данных.\n\nОшибка: ${errorMessage}`);
          }
        } catch (saveError) {
          console.error('❌ [NEW ARCH] Исключение при сохранении документа:', saveError);
          const errorMessage = saveError instanceof Error ? saveError.message : 'Неизвестная ошибка';
          alert(`Материалы рассчитаны, но возникла ошибка при сохранении в базу данных.\n\nОшибка: ${errorMessage}`);
        }
      }
      
    } catch (error) {
      console.error('❌ [NEW ARCH] Ошибка расчета материалов:', error);
      
      let errorMessage = 'Неизвестная ошибка';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      alert(
        `Ошибка расчета материалов: ${errorMessage}\n\n` +
        'Возможные причины:\n' +
        '1. Нет подключения к серверу\n' +
        '2. Не настроены калькуляции для продукции\n' +
        '3. Ошибка в данных калькуляций'
      );
    } finally {
      setIsCalculating(false);
    }
  }, [user?.token, currentDocument, setMainData, incomeItems]);

  // Проверяем, что currentDocument инициализирован ПОСЛЕ всех хуков
  if (!currentDocument) {
    console.error('❌ DocTableCatalog: currentDocument не определен');
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        Ошибка: документ не инициализирован. Пожалуйста, обновите страницу.
      </div>
    );
  }

  if (shouldShowReceiveToolsTables(currentDocument.documentType as DocumentType)) {
    return <ReceiveToolsTables items={items || []} />;
  }

  return (
    <div className={`${styles.mainBox}${isToolsTransferDoc ? ` ${styles.mainBoxTools}` : ''}`}>
      <TableHeader 
        typeDocumentByComeOut={typeDocumentByComeOut} 
        onOpenCatalog={handleOpenCatalogFromHeader}
        onOpenPicker={
          currentDocument?.documentType === DocumentType.TransferToolsToClient
            ? handleOpenTransferPicker
            : undefined
        }
        onOpenFormwork={isTransferTools || isOrderTools ? () => setFormworkOpen(true) : undefined}
        onImportProducts={handleImportProducts}
        onCalculateMaterials={handleCalculateMaterials}
        docStatus={currentDocument?.docStatus} 
        docType={currentDocument?.documentType as DocumentType}
        hasIncomeItems={catalogItems.length > 0}
        isCalculating={isCalculating}
      />
      
		{catalogItems && catalogItems.length > 0 && catalogItems.map((item, index) => {
        const documentRowIndex = catalogIndicesInFullDoc[index] ?? index;
        return (
        <TableRow
          key={`income-doc-row-${documentRowIndex}`}
          item={item}
          index={index}
          documentRowIndex={documentRowIndex}
          typeReference={TypeReference.TMZ}
          tableState={tableState}
          typeDocumentByComeOut = {typeDocumentByComeOut}
          onDelete={handleDeleteItem}
          onLoadBalance={handleLoadBalance}
          onSubscribe={handleRowSubscribe}
				  onUnsubscribe={handleRowUnsubscribe}
          onOpenCatalogForRow={handleOpenCatalogForRow}
        />
        );
      })}

      {catalogItems && catalogItems.length === 0 &&
        !shouldShowMaterialsExpenseTable(currentDocument?.documentType as DocumentType) && (
        <TableEmptyBox docType={currentDocument?.documentType as DocumentType} />
      )}

      {/* Footer с итогами - показываем только если есть товары */}
      {catalogItems && catalogItems.length > 0 && (
        <TableFooter
          items={catalogItems}
          documentType={currentDocument?.documentType as DocumentType}
        />
      )}

      {/* Секция материалов: документы списания (LeaveMaterial и др.) */}
      {shouldShowMaterialsExpenseTable(currentDocument?.documentType as DocumentType) && (
        <MaterialsTable items={expenseItems || []} />
      )}

      {/* Продажа товаров (S29) вместе с передачей инструментов */}
      {isTransferTools && <TransferToolsSaleTable items={saleItems} />}

      <ProductCatalogIntegration
        warehouseId={warehouseId} 
        openCatalogRef={openCatalogRef} 
        typeDocumentByComeOut={typeDocumentByComeOut}
        replaceRowContext={replaceRowContext}
        onReplaceRowContextChange={setReplaceRowContext}
      />

      {currentDocument?.documentType === DocumentType.TransferToolsToClient && (
        <TransferToolsPickerModal
          open={transferPickerOpen}
          currentDocument={currentDocument}
          allDocItems={items || []}
          token={user?.token}
          enterpriseId={enterpriseId ?? null}
          setMainData={setMainData}
          onClose={() => setTransferPickerOpen(false)}
        />
      )}

      {(isTransferTools || isOrderTools) && formworkOpen && (
        <FormworkPlannerModal
          open={formworkOpen}
          currentDocument={currentDocument}
          allDocItems={items || []}
          token={user?.token}
          enterpriseId={enterpriseId ?? null}
          setMainData={setMainData}
          onClose={() => setFormworkOpen(false)}
        />
      )}
    </div> 
  );
};