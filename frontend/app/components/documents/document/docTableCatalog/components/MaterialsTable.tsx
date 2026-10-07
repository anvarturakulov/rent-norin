import React, { memo, useMemo, useCallback, useState } from 'react';
import { DocTableItem, DocumentType, DocSTATUS } from '@/app/interfaces/document.interface';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { DocTable } from '../../docTable/docTable';
import { useAppContext } from '@/app/context/app.context';
import { getStorageIdForDocument } from '@/app/service/documents/getStorageIdForDocument';
import { getMaterialCostPrice } from '@/app/service/productCalculations/calculateMaterials';
import { useProductCatalog } from '@/app/hooks/useProductCatalog';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { Product } from '@/app/interfaces/product.interface';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { ReplaceRowContext, toCatalogFocusProduct } from '../replaceRowContext';
import styles from '../docTableCatalog.module.css';

interface MaterialsTableProps {
  items: DocTableItem[];
}

const MaterialsTable = memo<MaterialsTableProps>(({ items }) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const token = user?.token;
  const [replaceRowContext, setReplaceRowContext] = useState<ReplaceRowContext | null>(null);
  const { data: references } = useAllReferences(token);

  const warehouseId = useMemo(() => getStorageIdForDocument(
    currentDocument?.documentType as string,
    currentDocument?.docValues?.senderId,
    currentDocument?.docValues?.receiverId
  ), [currentDocument]);

  const buildMaterialItem = useCallback((
    product: Product,
    quantity: number,
    costPrice: number,
    balance: number,
    customPrice?: number,
  ): DocTableItem => {
    const price = customPrice !== undefined ? customPrice : costPrice;
    const total = Math.round((price * quantity) * 100) / 100;
    const costTotal = Math.round((costPrice * quantity) * 100) / 100;
    return {
      analiticId: product.id,
      tableType: 'expense',
      count: quantity,
      balance: balance ?? 0,
      price,
      total,
      costPrice,
      costTotal,
    };
  }, []);

  const onMaterialSelected = useCallback(async (product: Product, quantity: number, customPrice?: number) => {
    if (!currentDocument || !setMainData || !token) return;
    const materialWarehouseId = currentDocument.docValues?.receiverId ?? warehouseId ?? 1;
    const documentDate = currentDocument.date ?? Date.now();
    const replaceRowIndex = replaceRowContext?.rowIndex ?? null;
    try {
      const { costPrice, balance } = await getMaterialCostPrice(documentDate, product.id, materialWarehouseId, token);
      const newItem = buildMaterialItem(product, quantity, costPrice, balance ?? 0, customPrice);
      const currentItems = currentDocument.docTableItems ?? [];

      if (replaceRowIndex !== null && replaceRowIndex >= 0 && replaceRowIndex < currentItems.length) {
        const duplicateIndex = currentItems.findIndex(
          (item, i) => item.analiticId === product.id && i !== replaceRowIndex
        );
        if (duplicateIndex >= 0) {
          const proceed = window.confirm(
            `Материал "${product.name}" уже есть в документе (строка ${duplicateIndex + 1}). Всё равно заменить текущую позицию?`
          );
          if (!proceed) return;
        }
        const updated = [...currentItems];
        updated[replaceRowIndex] = newItem;
        setMainData('currentDocument', { ...currentDocument, docTableItems: updated });
        setReplaceRowContext(null);
        return;
      }

      const updated = [...currentItems, newItem];
      setMainData('currentDocument', { ...currentDocument, docTableItems: updated });
    } catch (e) {
      console.error('Ошибка добавления материала:', e);
      alert('Не удалось получить цену и остаток материала.');
    }
  }, [currentDocument, setMainData, token, warehouseId, replaceRowContext, buildMaterialItem]);

  const { isOpen, openCatalog, closeCatalog, handleSelectProduct } = useProductCatalog({
    onProductSelected: onMaterialSelected,
    currentDocTableItems: currentDocument?.docTableItems ?? [],
  });

  const handleCloseCatalog = useCallback(() => {
    setReplaceRowContext(null);
    closeCatalog();
  }, [closeCatalog]);

  const handleOpenCatalogAdd = useCallback(() => {
    setReplaceRowContext(null);
    openCatalog();
  }, [openCatalog]);

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
    openCatalog();
  }, [openCatalog, currentDocument?.docTableItems, references]);

  const itemsWithRealIndices = useMemo(() => {
    if (!currentDocument?.docTableItems || !items || items.length === 0) {
      return [];
    }
    const docTableItems = currentDocument.docTableItems;
    const expenseIndices = docTableItems
      .map((it, i) => (it.tableType === 'expense' ? i : -1))
      .filter((i) => i >= 0);
    return items.map((expenseItem, i) => ({
      ...expenseItem,
      _realIndex: expenseIndices[i] !== undefined ? expenseIndices[i] : undefined
    }));
  }, [items, currentDocument?.docTableItems]);

  const isComeProduct = currentDocument?.documentType === DocumentType.ComeProduct;
  const canReplaceInRow = currentDocument?.docStatus === DocSTATUS.OPEN;
  const catalogMode = replaceRowContext !== null ? 'replace' as const : 'add' as const;
  const focusProduct = toCatalogFocusProduct(replaceRowContext);

  return (
    <div className={styles.materialsSection}>
      <div className={styles.materialsHeader}>
        <h3>Списание материалов</h3>
        <button
          type="button"
          className={styles.addBtn}
          onClick={handleOpenCatalogAdd}
        >
          + Добавить материал
        </button>
      </div>
      {items && items.length > 0 ? (
        <DocTable
          typeReference={TypeReference.TMZ}
          items={itemsWithRealIndices}
          useRealIndices={true}
          editableExpense={isComeProduct}
          editableExpensePrice={isComeProduct ? false : undefined}
          onOpenCatalogForRow={canReplaceInRow ? handleOpenCatalogForRow : undefined}
        />
      ) : (
        <div className={styles.materialsEmpty}>Добавьте материалы по кнопке выше.</div>
      )}
      <ProductCatalog
        isOpen={isOpen}
        onClose={handleCloseCatalog}
        onSelectProduct={handleSelectProduct}
        warehouseId={warehouseId ?? undefined}
        typeDocumentByComeOut="come"
        documentType={DocumentType.ComeMaterial}
        documentDate={currentDocument?.date}
        catalogMode={catalogMode}
        focusProduct={focusProduct}
      />
    </div>
  );
});

MaterialsTable.displayName = 'MaterialsTable';

export default MaterialsTable;
