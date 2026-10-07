'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DocTableItem,
  DocSTATUS,
  DocumentType,
  DocumentModel,
  getBrakItems,
  getReturnItems,
  getSaleItems,
  getTovarItems,
} from '@/app/interfaces/document.interface';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { Schet } from '@/app/interfaces/report.interface';
import { useAppContext } from '@/app/context/app.context';
import { useDocTableData } from '../hooks/useDocTableData';
import { useProductCatalog } from '@/app/hooks/useProductCatalog';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { Product } from '@/app/interfaces/product.interface';
import { getStockByItem } from '@/app/service/stocks/getStockByItem';
import { getPereodicValueForDate } from '@/app/service/references/getPereodicValueForDate';
import TableRow from './TableRow';
import TableFooter from './TableFooter';
import TableEmptyBox from './TableEmptyBox';
import styles from '../docTableCatalog.module.css';
import { fillReceiveToolsTable, getTotalRentFromReturnRows } from '@/app/service/documents/fillReceiveToolsTable';
import { getReceiveToolsPreviewParams } from '@/app/service/documents/fetchReceiveToolsPreview';
import {
  copyReturnRowToSection,
  getReceiveToolsCopyRemainQty,
  ReceiveToolsCopyTarget,
} from '@/app/service/documents/copyReceiveToolsFromReturn';
import { numberValue } from '@/app/service/common/converters';
import { showMessage } from '@/app/service/common/showMessage';
import { getDocumentTypeByComeOut } from '../../docValues/components/helpers/getDocumentTypeByComeOut';
import ReceiveToolsPickerModal from './receiveToolsPickerModal/receiveToolsPickerModal';

type SectionType = 'return' | 'brak' | 'sale' | 'tovar';

const SECTION_TITLES: Record<SectionType, string> = {
  return: 'Кабул килиш',
  brak: 'Брак',
  sale: 'Мижозга сотиш',
  tovar: 'Мижозга товар сотиш',
};

const COLLAPSIBLE_SECTIONS: SectionType[] = ['brak', 'sale', 'tovar'];

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ReceiveToolsTablesProps {
  items: DocTableItem[];
}

const ReceiveToolsTables = memo<ReceiveToolsTablesProps>(({ items }) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const token = user?.token;
  const enterpriseId =
    currentDocument?.enterpriseId ??
    mainData.report?.selectedEnterpriseId ??
    user?.enterpriseId;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<SectionType, boolean>>({
    return: true,
    brak: false,
    sale: false,
    tovar: false,
  });
  const prevCountsRef = useRef<Record<SectionType, number>>({
    return: 0,
    brak: 0,
    sale: 0,
    tovar: 0,
  });

  const docRef = useRef<DocumentModel | undefined>(currentDocument);
  useEffect(() => {
    docRef.current = currentDocument;
  }, [currentDocument]);

  const returnItems = getReturnItems(items || []);
  const brakItems = getBrakItems(items || []);
  const saleItems = getSaleItems(items || []);
  const tovarItems = getTovarItems(items || []);
  const isKaytarish =
    currentDocument?.documentType === DocumentType.ReceiveToolsFromClient;
  const tovarWarehouseId = currentDocument?.docValues?.receiverId;

  const sectionItemsMap: Record<SectionType, DocTableItem[]> = {
    return: returnItems,
    brak: brakItems,
    sale: saleItems,
    tovar: tovarItems,
  };

  const typeDocumentByComeOut = getDocumentTypeByComeOut(
    (currentDocument?.documentType as DocumentType) ||
      DocumentType.ReceiveToolsFromClient,
  );

  const indicesInFullDoc = useMemo(() => {
    const map: Record<SectionType, number[]> = {
      return: [],
      brak: [],
      sale: [],
      tovar: [],
    };
    (items || []).forEach((it, i) => {
      const t = (it.tableType || 'return') as SectionType;
      if (t in map) map[t].push(i);
    });
    return map;
  }, [items]);

  useEffect(() => {
    COLLAPSIBLE_SECTIONS.forEach((section) => {
      const prevCount = prevCountsRef.current[section];
      const nextCount = sectionItemsMap[section].length;
      if (nextCount > prevCount) {
        setExpandedSections((prev) => ({ ...prev, [section]: true }));
      }
      prevCountsRef.current[section] = nextCount;
    });
  }, [brakItems.length, saleItems.length, tovarItems.length]);

  const handleItemDeleted = useCallback(() => {}, []);
  const { tableState, handleDeleteItem, handleLoadBalance } = useDocTableData(
    items || [],
    handleItemDeleted,
  );

  const handleFill = useCallback(() => {
    fillReceiveToolsTable(currentDocument, setMainData, token, enterpriseId ?? null);
  }, [currentDocument, setMainData, token, enterpriseId]);

  const handleOpenPicker = useCallback(() => {
    const { error } = getReceiveToolsPreviewParams(currentDocument, enterpriseId ?? null);
    if (error) {
      showMessage(error, 'error', setMainData);
      return;
    }
    setPickerOpen(true);
  }, [currentDocument, enterpriseId, setMainData]);

  const onTovarProductSelected = useCallback(
    async (product: Product, quantity: number, customPrice?: number) => {
      const doc = docRef.current;
      if (!doc || !setMainData || !token) return;

      const warehouse = doc.docValues?.receiverId;
      if (!warehouse) {
        alert('Аввал қабул қилувчи складни танланг.');
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
          tableType: 'tovar',
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
          (item) => item.analiticId === product.id && item.tableType === 'tovar',
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
    [setMainData, token, enterpriseId],
  );

  const { isOpen, openCatalog, closeCatalog, handleSelectProduct } = useProductCatalog({
    onProductSelected: onTovarProductSelected,
    currentDocTableItems: currentDocument?.docTableItems ?? [],
  });

  const handleOpenTovarCatalog = useCallback(() => {
    if (!tovarWarehouseId) {
      alert('Аввал қабул қилувчи складни танланг.');
      return;
    }
    openCatalog();
  }, [openCatalog, tovarWarehouseId]);

  const handleCopyToSection = useCallback(
    (documentRowIndex: number, target: ReceiveToolsCopyTarget) => {
      const returnItem = items?.[documentRowIndex];
      if (!returnItem) return;

      const remain = getReceiveToolsCopyRemainQty(returnItem, items || []);
      if (remain <= 0) {
        showMessage('Копирование недоступно: остаток исчерпан', 'error', setMainData);
        return;
      }

      const sectionLabel = target === 'brak' ? 'Брак' : 'Мижозга сотиш';
      const rawQty = window.prompt(
        `«${sectionLabel}» учун миқдор (макс. ${remain}):`,
        String(remain),
      );
      if (rawQty === null) return;

      const parsedQty = Number(rawQty.replace(',', '.'));
      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        showMessage('Миқдор нотўғри', 'error', setMainData);
        return;
      }

      const result = copyReturnRowToSection(
        currentDocument,
        documentRowIndex,
        target,
        parsedQty,
      );
      if ('error' in result) {
        showMessage(result.error, 'error', setMainData);
        return;
      }

      setMainData?.('currentDocument', {
        ...currentDocument,
        docTableItems: result.docTableItems,
      });
      showMessage(`«${sectionLabel}» ga ko'chirildi`, 'success', setMainData);
    },
    [currentDocument, items, setMainData],
  );

  const toggleSection = useCallback((section: SectionType) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const isDocumentOpen = currentDocument?.docStatus === DocSTATUS.OPEN;

  const renderSection = (section: SectionType, sectionItems: DocTableItem[]) => {
    const indices = indicesInFullDoc[section];
    const isCollapsible = COLLAPSIBLE_SECTIONS.includes(section);
    const isExpanded = expandedSections[section];
    const rowCount = sectionItems.length;
    const sectionButton =
      section === 'return' ? (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleOpenPicker}
          disabled={!isDocumentOpen}
        >
          + Танлаб олиш
        </button>
      ) : section === 'tovar' ? (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleOpenTovarCatalog}
          disabled={!isDocumentOpen}
        >
          + Товар қўшиш
        </button>
      ) : null;

    return (
      <div
        key={section}
        className={`${styles.materialsSection} ${isCollapsible && !isExpanded ? styles.sectionCollapsed : ''}`}
      >
        <div className={styles.sectionHeader}>
          {isCollapsible ? (
            <button
              type="button"
              className={styles.sectionHeaderToggle}
              onClick={() => toggleSection(section)}
              aria-expanded={isExpanded}
            >
              <span className={styles.sectionToggleIcon}>{isExpanded ? '▼' : '▶'}</span>
              <h4>
                {SECTION_TITLES[section]}
                {rowCount > 0 && (
                  <span className={styles.sectionCountBadge}>{rowCount}</span>
                )}
              </h4>
            </button>
          ) : (
            <h4>{SECTION_TITLES[section]}</h4>
          )}
          {isDocumentOpen && sectionButton}
        </div>
        {(!isCollapsible || isExpanded) && (
          <>
            {section === 'return' && (
              <div
                className={`${styles.box} ${styles.boxReceiveTools} ${styles.receiveToolsColumnHeader}`}
              >
                <div>Номи</div>
                <div>Олинган сана</div>
                <div>Миқдор</div>
                <div>Соат</div>
                <div>Тариф</div>
                <div>Ижара</div>
                <div>Скидка</div>
                <div>Суммаси</div>
                <div />
              </div>
            )}
            {section === 'tovar' && (
              <div
                className={`${styles.box} ${styles.boxReceiveTools} ${styles.receiveToolsColumnHeader}`}
              >
                <div>Номи</div>
                <div>Колдик</div>
                <div>Миқдор</div>
                <div>—</div>
                <div>—</div>
                <div>—</div>
                <div>Нарх</div>
                <div>Суммаси</div>
                <div />
              </div>
            )}
            {sectionItems.map((item, index) => (
              <TableRow
                key={`${section}-${indices[index] ?? index}`}
                item={item}
                index={index}
                documentRowIndex={indices[index] ?? index}
                typeReference={TypeReference.TMZ}
                tableState={tableState}
                typeDocumentByComeOut={typeDocumentByComeOut}
                onDelete={handleDeleteItem}
                onLoadBalance={handleLoadBalance}
                onCopyToBrak={
                  section === 'return' && isDocumentOpen
                    ? () => handleCopyToSection(indices[index] ?? index, 'brak')
                    : undefined
                }
                onCopyToSale={
                  section === 'return' && isDocumentOpen
                    ? () => handleCopyToSection(indices[index] ?? index, 'sale')
                    : undefined
                }
                copyRemainQty={
                  section === 'return'
                    ? getReceiveToolsCopyRemainQty(item, items || [])
                    : undefined
                }
              />
            ))}
            {sectionItems.length === 0 && (
              <TableEmptyBox
                docType={
                  section === 'tovar'
                    ? DocumentType.SaleTovar
                    : (currentDocument?.documentType as DocumentType) ||
                      DocumentType.ReceiveToolsFromClient
                }
              />
            )}
            {sectionItems.length > 0 && <TableFooter items={sectionItems} />}
          </>
        )}
      </div>
    );
  };

  const totalRent = getTotalRentFromReturnRows(items);

  return (
    <div className={`${styles.mainBox} ${styles.mainBoxTools}`}>
      <div className={styles.receiveToolsToolbar}>
        {isDocumentOpen && (
          <button type="button" className={styles.actionBtn} onClick={handleFill}>
            Тулдириш
          </button>
        )}
        {totalRent > 0 && (
          <span className={styles.rentTotal}>
            Ижарадан даромад: {numberValue(totalRent)} сўм
          </span>
        )}
      </div>

      {renderSection('return', returnItems)}
      {renderSection('brak', brakItems)}
      {renderSection('sale', saleItems)}
      {isKaytarish && renderSection('tovar', tovarItems)}

      <ReceiveToolsPickerModal
        open={pickerOpen}
        currentDocument={currentDocument}
        allDocItems={items || []}
        token={token}
        enterpriseId={enterpriseId ?? null}
        setMainData={setMainData}
        onClose={() => setPickerOpen(false)}
      />

      {isKaytarish && (
        <ProductCatalog
          isOpen={isOpen}
          onClose={closeCatalog}
          onSelectProduct={handleSelectProduct}
          warehouseId={tovarWarehouseId ?? undefined}
          typeDocumentByComeOut="out"
          documentType={DocumentType.SaleTovar}
          documentDate={currentDocument?.date}
          catalogMode="add"
          allowNegativeStock={true}
        />
      )}
    </div>
  );
});

ReceiveToolsTables.displayName = 'ReceiveToolsTables';

export default ReceiveToolsTables;
