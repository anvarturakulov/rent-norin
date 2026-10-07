'use client';

import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { DocTableItem, DocumentType, DocSTATUS, DocumentModel } from '@/app/interfaces/document.interface';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { Schet } from '@/app/interfaces/report.interface';
import { DocTable } from '../../docTable/docTable';
import { useAppContext } from '@/app/context/app.context';
import { useProductCatalog } from '@/app/hooks/useProductCatalog';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { Product } from '@/app/interfaces/product.interface';
import { getStockByItem } from '@/app/service/stocks/getStockByItem';
import { getPereodicValueForDate } from '@/app/service/references/getPereodicValueForDate';
import CartIco from '../ico/cart.svg';
import styles from '../docTableCatalog.module.css';

interface TransferToolsSaleTableProps {
  items: DocTableItem[];
  /** Склад S29. По умолчанию senderId (Топшириш). Для Кайтариш — receiverId. */
  warehouseId?: number | null;
  rowTableType?: 'sale' | 'tovar';
  warehouseMissingMessage?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const TransferToolsSaleTable = memo<TransferToolsSaleTableProps>(({
  items,
  warehouseId: warehouseIdProp,
  rowTableType = 'sale',
  warehouseMissingMessage = 'Аввал жунатувчи складни танланг.',
}) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const token = user?.token;

  const docRef = useRef<DocumentModel | undefined>(currentDocument);
  useEffect(() => {
    docRef.current = currentDocument;
  }, [currentDocument]);

  const warehouseId = warehouseIdProp ?? currentDocument?.docValues?.senderId;
  const enterpriseId =
    currentDocument?.enterpriseId ??
    mainData.report?.selectedEnterpriseId ??
    user?.enterpriseId;

  const onSaleProductSelected = useCallback(
    async (product: Product, quantity: number, customPrice?: number) => {
      const doc = docRef.current;
      if (!doc || !setMainData || !token) return;

      const warehouse = warehouseIdProp ?? doc.docValues?.senderId;
      if (!warehouse) {
        alert(warehouseMissingMessage);
        return;
      }

      const documentDate = doc.date ?? Date.now();

      try {
        const stockData = await getStockByItem(
          Schet.S29,
          warehouse,
          product.id,
          documentDate,
          enterpriseId ?? undefined,
          token,
        );

        const totalQuantity = Number(stockData?.totalQuantity) || 0;
        if (totalQuantity <= 0) {
          alert(`Складда (S29) товар "${product.name}" қолдиғи йўқ.`);
          return;
        }

        const costPrice = (Number(stockData.totalSum) || 0) / totalQuantity;

        let price = customPrice !== undefined && customPrice > 0 ? customPrice : 0;
        if (price <= 0) {
          const periodic = await getPereodicValueForDate(
            product.id,
            'firstPrice',
            documentDate,
            token,
            enterpriseId ?? undefined,
          );
          price =
            periodic > 0
              ? periodic
              : product.refValues?.firstPrice || product.price || 0;
        }

        if (price <= 0) {
          alert(`Товар "${product.name}" учун сотиш нархи (firstPrice) топилмади.`);
          return;
        }

        const newItem: DocTableItem = {
          analiticId: product.id,
          tableType: rowTableType,
          count: quantity,
          balance: stockData.availableQuantity ?? totalQuantity,
          price,
          total: round2(price * quantity),
          costPrice,
          costTotal: round2(costPrice * quantity),
          refCountInBox: product.refValues?.countInBox,
          countByBox: product.refValues?.countInBox
            ? Math.ceil(quantity / product.refValues.countInBox)
            : undefined,
        };

        const latestDoc = docRef.current ?? doc;
        const currentItems = latestDoc.docTableItems ?? [];

        const duplicateIndex = currentItems.findIndex(
          (item) => item.analiticId === product.id && item.tableType === rowTableType,
        );
        if (duplicateIndex >= 0) {
          const proceed = window.confirm(
            `Товар "${product.name}" уже есть в таблице продажи (строка ${duplicateIndex + 1}). Добавить ещё раз?`,
          );
          if (!proceed) return;
        }

        setMainData('currentDocument', {
          ...latestDoc,
          docTableItems: [...currentItems, newItem],
        });
      } catch (e) {
        console.error('Ошибка добавления товара:', e);
        alert(
          e instanceof Error
            ? e.message
            : 'Не удалось получить цену и остаток товара.',
        );
      }
    },
    [setMainData, token, enterpriseId, warehouseIdProp, warehouseMissingMessage, rowTableType],
  );

  const { isOpen, openCatalog, closeCatalog, handleSelectProduct } = useProductCatalog({
    onProductSelected: onSaleProductSelected,
    currentDocTableItems: currentDocument?.docTableItems ?? [],
  });

  const handleOpenCatalogAdd = useCallback(() => {
    if (!warehouseId) {
      alert(warehouseMissingMessage);
      return;
    }
    openCatalog();
  }, [openCatalog, warehouseId, warehouseMissingMessage]);

  const itemsWithRealIndices = useMemo(() => {
    if (!currentDocument?.docTableItems || !items || items.length === 0) {
      return [];
    }
    const docTableItems = currentDocument.docTableItems;
    const saleIndices = docTableItems
      .map((it, i) => (it.tableType === rowTableType ? i : -1))
      .filter((i) => i >= 0);
    return items.map((saleItem, i) => ({
      ...saleItem,
      _realIndex: saleIndices[i] !== undefined ? saleIndices[i] : undefined,
    }));
  }, [items, currentDocument?.docTableItems, rowTableType]);

  const canReplaceInRow = currentDocument?.docStatus === DocSTATUS.OPEN;

  return (
    <div className={styles.materialsSection}>
      <div className={`${styles.boxHeader} ${styles.titleBox}`}>
        <div className={styles.title}>
          <CartIco className={styles.icoCart} />
          <div className={styles.titleText}>Мижозга товар сотиш</div>
        </div>
        {canReplaceInRow && (
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleOpenCatalogAdd}
            >
              + Товар қўшиш
            </button>
          </div>
        )}
      </div>
      {items && items.length > 0 ? (
        <DocTable
          typeReference={TypeReference.TMZ}
          items={itemsWithRealIndices}
          useRealIndices={true}
          editableExpense={canReplaceInRow}
          editableExpensePrice={canReplaceInRow}
        />
      ) : (
        <div className={styles.materialsEmpty}>
          Мижозга сотиладиган товарларни қўшинг.
        </div>
      )}
      <ProductCatalog
        isOpen={isOpen}
        onClose={closeCatalog}
        onSelectProduct={handleSelectProduct}
        warehouseId={warehouseId ?? undefined}
        typeDocumentByComeOut="out"
        documentType={DocumentType.SaleTovar}
        documentDate={currentDocument?.date}
        catalogMode="add"
        allowNegativeStock={true}
      />
    </div>
  );
});

TransferToolsSaleTable.displayName = 'TransferToolsSaleTable';

export default TransferToolsSaleTable;
