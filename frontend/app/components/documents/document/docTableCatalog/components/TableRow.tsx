import React, { memo } from 'react';
import cn from 'classnames';
import TrashIco from '../ico/trash.svg';
import CartIco from '../ico/cart.svg';
import { InputInTable } from '../../inputs/inputInTable/inputInTable';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { DocTableItem, TypeDocumentByComeOut } from '@/app/interfaces/document.interface';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { useAppContext } from '@/app/context/app.context';
import { useGlobalStockManagement } from '@/app/context/websocket.context';
import styles from '../docTableCatalog.module.css';  
import { InputInTableForNumbers } from '../../inputs/inputInTableForNumbers/inputInTableForNumbers';
import { DocumentType, DocSTATUS, documentsWithOwnPrice, shouldComeProductHaveEditablePrice, isReceiveToolsDocument } from '@/app/interfaces/document.interface';
import { numberValue, formatNumberForDisplay } from '@/app/service/common/converters';
import { getStorageIdForDocument } from '@/app/service/documents/getStorageIdForDocument';
import { getSchetForDocumentRow } from '@/app/service/documents/getSchetForDocumentRow';
import { UserRoles } from '@/app/interfaces/user.interface';

interface TableRowProps {
  item: DocTableItem;
  index: number;
  /** Индекс строки в полном `currentDocument.docTableItems` (если не задан — используется `index`). */
  documentRowIndex?: number;
  typeReference: TypeReference;
  tableState: {
    showBalance: boolean;
    hasWorkers: boolean;
    documentIsSaleType: boolean;
    hasCommentInTable: boolean;
  };
  typeDocumentByComeOut: TypeDocumentByComeOut
  onDelete: (index: number) => void;
  onLoadBalance: (index: number) => void;
  onSubscribe?: (analiticId: number) => void;
  onUnsubscribe?: (analiticId: number) => void;
  onOpenCatalogForRow?: (documentRowIndex: number) => void;
  onCopyToBrak?: () => void;
  onCopyToSale?: () => void;
  copyRemainQty?: number;
}

const TableRow = memo<TableRowProps>(({ 
  item,
  index,
  documentRowIndex,
  typeReference,
  tableState,
  typeDocumentByComeOut,
  onDelete,
  onLoadBalance,
  onSubscribe,
  onUnsubscribe,
  onOpenCatalogForRow,
  onCopyToBrak,
  onCopyToSale,
  copyRemainQty,
}) => {
  const effectiveDocIndex = documentRowIndex !== undefined ? documentRowIndex : index;
  const { showBalance, hasWorkers, documentIsSaleType, hasCommentInTable } = tableState;
  const { mainData } = useAppContext();
  const { user } = mainData.users;
  const { currentDocument } = mainData.document;
  const token = user?.token;
  const isToolsTransferDoc =
    currentDocument?.documentType === DocumentType.TransferToolsToClient ||
    currentDocument?.documentType === DocumentType.OrderToolsToClient ||
    currentDocument?.documentType === DocumentType.TransferSubleaseToolsToClient;
  const isReceiveToolsFromClient = isReceiveToolsDocument(
    currentDocument?.documentType,
  );
  const isLeaveMaterial =
    currentDocument?.documentType === DocumentType.LeaveMaterial;
  const isLeaveHalfstuff =
    currentDocument?.documentType === DocumentType.LeaveHalfstuff;
  const showOrderFillHints = isLeaveMaterial || isLeaveHalfstuff;
  const plannedCount =
    item.plannedCount != null && Number.isFinite(Number(item.plannedCount))
      ? Number(item.plannedCount)
      : null;
  const rowCount = Number(item.count) || 0;
  const isReturnRow =
    isReceiveToolsFromClient &&
    (item.tableType === 'return' || !item.tableType);
  
  const isSaleRow =
    isReceiveToolsFromClient && item.tableType === 'sale';
  const isTovarRow =
    isReceiveToolsFromClient && item.tableType === 'tovar';

  // Определяем, должно ли поле цены быть заблокировано
  const isPriceDisabled = Boolean(
    !isSaleRow &&
      !isTovarRow &&
      currentDocument?.documentType &&
      !documentsWithOwnPrice.includes(currentDocument.documentType) &&
      !(
        currentDocument.documentType === DocumentType.ComeProduct &&
        shouldComeProductHaveEditablePrice(currentDocument.date)
      ),
  );

  // Получаем все референсы для поиска товара по analiticId
  const { data: references } = useAllReferences(token);

  // Получаем данные остатков
  const { getStock } = useGlobalStockManagement();
  const { mainData: contextData } = useAppContext();
  
  // Используем ту же логику, что и в docTableCatalog.tsx
  const storageId = getStorageIdForDocument(
    contextData.document.currentDocument.documentType, 
    contextData.document.currentDocument?.docValues?.senderId, 
    contextData.document.currentDocument?.docValues?.receiverId
  );
	const warehouseId = storageId || 20125;

  const product = references?.find((ref: any) => ref.id === item.analiticId);

  // Определяем счет на основе типа документа, типа ТМЗ и типа строки
  const documentType = contextData.document.currentDocument.documentType;
  const schet = getSchetForDocumentRow(
    documentType as DocumentType,
    product?.refValues?.typeTMZ,
    item.tableType,
  );
  
  // Мемоизируем вызов getStock для предотвращения лишних вызовов
  const stockData = React.useMemo(() => {
    return getStock(schet, `${warehouseId}:${item.analiticId}`);
  }, [getStock, schet, warehouseId, item.analiticId]);
  
  // Отладочная информация для диагностики проблемы с остатками (без зависимости от stockData)
  React.useEffect(() => {
    console.log(`🔍 TableRow для товара ${item.analiticId}:`, {
      warehouseId,
      schet,
      stockKey: `${warehouseId}:${item.analiticId}`,
      documentType: contextData.document.currentDocument.documentType,
      senderId: contextData.document.currentDocument?.docValues?.senderId,
      receiverId: contextData.document.currentDocument?.docValues?.receiverId,
      itemCount: item.count,
      tableType: item.tableType
    });
  }, [item.analiticId, warehouseId, schet, item.count, contextData.document.currentDocument.documentType, item.tableType]);
  
  React.useEffect(() => {
    // Передаем analiticId и tableType для правильного определения счета
    if (typeof onSubscribe === 'function' && onSubscribe.length > 1) {
      // Если функция принимает 2 параметра (новая версия)
      (onSubscribe as any)(item.analiticId, item.tableType);
    } else {
      // Если функция принимает 1 параметр (старая версия)
      onSubscribe?.(item.analiticId);
    }
    
    return () => {
      if (typeof onUnsubscribe === 'function' && onUnsubscribe.length > 1) {
        // Если функция принимает 2 параметра (новая версия)
        (onUnsubscribe as any)(item.analiticId, item.tableType);
      } else {
        // Если функция принимает 1 параметр (старая версия)
        onUnsubscribe?.(item.analiticId);
      }
    };
  }, [item.analiticId, item.tableType]); // Убираем onSubscribe и onUnsubscribe из зависимостей

  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [product?.refValues?.imagePath]);

  const renderProductImage = () => {
    if (!product?.refValues?.imagePath || imageFailed) {
      return (
        <div className={styles.imagePlaceholder}>
          📦
        </div>
      );
    }

    return (
      <img 
        src={`${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/image/${product.refValues.imagePath}`}
        alt={product.name}
        className={styles.productImageThumb}
        onError={() => setImageFailed(true)}
      />
    );
  };

  const canReplaceNomenclature =
    !!onOpenCatalogForRow &&
    currentDocument?.docStatus === DocSTATUS.OPEN;

  const canCopyFromReturn =
    isReturnRow &&
    currentDocument?.docStatus === DocSTATUS.OPEN &&
    !!onCopyToBrak &&
    !!onCopyToSale &&
    (copyRemainQty ?? 0) > 0;

  // Не затираем fill-balance нулём из WS: предпочитаем ненулевой live, иначе balance строки
  const liveQty =
    stockData?.totalQuantity != null && Number.isFinite(Number(stockData.totalQuantity))
      ? Number(stockData.totalQuantity)
      : null;
  const rowBalance = Number(item.balance) || 0;
  const displayBalance =
    liveQty != null && liveQty > 0
      ? liveQty
      : rowBalance > 0
        ? rowBalance
        : liveQty ?? 0;
  const isOrderFillNoStock =
    showOrderFillHints &&
    plannedCount != null &&
    plannedCount > 0 &&
    displayBalance <= 0;
  const isOrderFillCapped =
    showOrderFillHints &&
    plannedCount != null &&
    plannedCount > rowCount &&
    rowCount > 0;
  const unit = product?.refValues?.unit || 'шт';

  const renderProductInfo = (typeDocumentByComeOut: TypeDocumentByComeOut) => {
    return (
      <div className={styles.productInfo}>
        {canReplaceNomenclature && (
          <div
            className={styles.icoCatalog}
            onClick={() => onOpenCatalogForRow!(effectiveDocIndex)}
            title="Номенклатурани алмаштириш"
            role="button"
          >
            <CartIco />
          </div>
        )}
        <div className={styles.rowNumber}>#{index + 1}</div>
        <div className={styles.productImageContainer}>
          {renderProductImage()}
        </div>
        <div className={styles.productDetails}>
          <div className={cn(canCopyFromReturn && styles.productHoverZone)}>
            <div className={styles.productNameWrap}>
              <div className={styles.productName}>
                {product?.name || `Товар ID: ${item.analiticId}`}
                {isLeaveMaterial && (
                  <span className={styles.costPriceInName}>
                    {` (колдик: ${formatNumberForDisplay(displayBalance)} ${unit})`}
                  </span>
                )}
                {!showOrderFillHints && (
                  <>
                    <span className={styles.costPriceInName}>{`( т: ${numberValue(item.costPrice)}`}</span>
                    <span className={styles.costPriceInName}>{` т.с: ${numberValue(item.costTotal)})`}</span>
                  </>
                )}
              </div>
            </div>
            {(product?.article || canCopyFromReturn) && (
              <div className={styles.productSecondaryRow}>
                {product?.article && (
                  <div className={styles.productArticle}>Артикул: {product.article}</div>
                )}
                {canCopyFromReturn && (
                  <div className={styles.copyActionsHover}>
                    <button
                      type="button"
                      className={styles.copyActionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyToBrak?.();
                      }}
                      title="Бракга кўчириш"
                    >
                      → Брак
                    </button>
                    <button
                      type="button"
                      className={styles.copyActionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyToSale?.();
                      }}
                      title="Мижозга сотишга кўчириш"
                    >
                      → Сотиш
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {stockData && (
            <div className={styles.stockInfo}>
              <div className={styles.stockQuantity}>
                Колдик: {formatNumberForDisplay(stockData.totalQuantity)} {product?.refValues?.unit || 'шт'}
                {stockData.totalQuantity > 0 && (
                  <span className={styles.available}> (бўш: {formatNumberForDisplay(stockData.totalQuantity)} {product?.refValues?.unit || 'шт'})</span>
                )}
              </div>
              {/* Индикация состояния остатков */}
              {item.count && item.count > 0 && typeDocumentByComeOut === 'out' && currentDocument?.documentType !== DocumentType.OrderToolsToClient && (
                <div className={cn(
                  styles.stockStatus,
                  // Проверяем превышение относительно общего количества товара
                  item.count > stockData.totalQuantity ? styles.stockError : 
                  styles.stockSuccess
                )}>
                  <span className={styles.stockIcon}>
                    {item.count > stockData.totalQuantity ? '⚠️' : '✅'}
                  </span>
                  {item.count > stockData.totalQuantity ? 
                    `Зиёд булаяпти ${formatNumberForDisplay(item.count - stockData.totalQuantity)}` :
                    `Мавжуд: ${formatNumberForDisplay(stockData.totalQuantity - item.count)}`
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      key={effectiveDocIndex}
      className={cn(
        styles.box,
        isReceiveToolsFromClient && styles.boxReceiveTools,
        isOrderFillNoStock && styles.leaveMaterialNoStockRow,
        isOrderFillCapped && styles.leaveMaterialCappedRow,
      )}
    >
      {/* Информация о товаре: номер строки, изображение, название, остатки */}
      {renderProductInfo(typeDocumentByComeOut)}

      {isReceiveToolsFromClient && (
        <div className={styles.totalField}>
          {isTovarRow
            ? formatNumberForDisplay(displayBalance)
            : item.settlementDate && Number.isFinite(Number(item.settlementDate))
              ? new Date(Number(item.settlementDate)).toLocaleString('ru-RU')
              : '—'}
        </div>
      )}
      
      <div className={styles.countWithPlanHint}>
        <InputInTableForNumbers nameControl='count' type='number' itemIndexInTable={effectiveDocIndex} />
        {isOrderFillNoStock && (
          <div className={styles.leaveMaterialPlanHint} title="Нет остатка на складе">
            нет остатка (план: {formatNumberForDisplay(plannedCount!)})
          </div>
        )}
        {isOrderFillCapped && (
          <div className={styles.leaveMaterialPlanHint} title="Количество урезано по остатку">
            план: {formatNumberForDisplay(plannedCount!)} → {formatNumberForDisplay(rowCount)}
          </div>
        )}
      </div>
      {isToolsTransferDoc && (
        <>
          <InputInTableForNumbers nameControl='hourlyTariff' type='number' itemIndexInTable={effectiveDocIndex} />
          <div className={styles.totalField}>
            {numberValue(item.dailyRent ?? 0)} / кун
          </div>
        </>
      )}
      {isReceiveToolsFromClient && (
        <>
          {isReturnRow ? (
            <>
              <InputInTableForNumbers nameControl="rentHours" type="number" itemIndexInTable={effectiveDocIndex} />
              <InputInTableForNumbers nameControl="hourlyTariff" type="number" itemIndexInTable={effectiveDocIndex} />
              <div className={styles.totalField}>
                {numberValue(item.rentSum ?? 0)}
              </div>
            </>
          ) : (
            <>
              <div className={styles.totalField}>—</div>
              <div className={styles.totalField}>—</div>
              <div className={styles.totalField}>—</div>
            </>
          )}
        </>
      )}

      {!isToolsTransferDoc && (
        <>
          {isReturnRow ? (
            <>
              <InputInTableForNumbers
                nameControl="price"
                type="number"
                itemIndexInTable={effectiveDocIndex}
              />
              <div className={styles.totalField}>
                {numberValue(item.total ?? 0)} сум
              </div>
            </>
          ) : (
            <>
              <InputInTableForNumbers 
                nameControl='price' 
                type='number' 
                itemIndexInTable={effectiveDocIndex} 
                disabled={isPriceDisabled ? true : undefined}
              />
              
              {isPriceDisabled ? (
                <div className={styles.totalField}>
                  {numberValue(item.total)} сум
                </div>
              ) : (
                <InputInTableForNumbers
                  nameControl='total'
                  type='number'
                  itemIndexInTable={effectiveDocIndex}
                  className={styles.totalField}
                />
              )}
            </>
          )}
        </>
      )}
      
      <div
        className={styles.ico}
        onClick={() => {
          const productName = product?.name || `Товар ID: ${item.analiticId}`;
          if (window.confirm(`Удалить "${productName}" Товарни хужжатдан учрайми?`)) {
            onDelete(effectiveDocIndex);
          }
        }}
        title="Товарни учириш"
      >
        <TrashIco />
      </div>
    </div>
  );
});

TableRow.displayName = 'TableRow';

export default TableRow; 