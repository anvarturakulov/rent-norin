'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { Product, ProductTreeNode } from '@/app/interfaces/product.interface';
import { TypeTMZ } from '@/app/interfaces/reference.interface';
import { useReferencesData } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { matchTmzCombinedSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';
import { compareTmzCatalogItems } from '@/app/service/references/compareTmzCatalogItems';
import { ProductCatalogSearch } from '@/app/components/productCatalog/components/productCatalogSearch';
import { ProductCatalogNavigation } from '@/app/components/productCatalog/components/productCatalogNavigation';
import { Pagination } from '@/app/components/productCatalog/components/pagination';
import LoadingIco from '@/app/components/common/loading.svg';
import { TmzBalanceCatalogItem } from './tmzBalanceCatalogItem';
import {
  TmzBalanceEntry,
  TmzBalanceReportValues,
  TmzMainWarehouseBalanceProps,
} from './tmzMainWarehouseBalance.props';
import catalogStyles from '@/app/components/productCatalog/productCatalog.module.css';
import styles from './tmzMainWarehouseBalance.module.css';

const formatReportDate = (value: number | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ru-RU');
};

const resolveEnterpriseId = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = Number((raw as { id: unknown }).id);
    return Number.isNaN(id) ? null : id;
  }
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
};

export const TmzMainWarehouseBalance = ({
  data,
  ...props
}: TmzMainWarehouseBalanceProps): JSX.Element => {
  const { mainData } = useAppContext();
  const token = mainData.users.user?.token;
  const selectedEnterpriseId = resolveEnterpriseId(mainData.report?.selectedEnterpriseId);

  const report = Array.isArray(data)
    ? data.find((item: { reportType?: string }) => item?.reportType === 'TMZMAINWAREHOUSEBALANCE')
    : null;
  const values = report?.values as TmzBalanceReportValues | undefined;

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: number | null; name: string }[]>([
    { id: null, name: 'Бош ойна' },
  ]);
  const [openFolders, setOpenFolders] = useState<Set<number>>(new Set());
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [nameSearchQuery, setNameSearchQuery] = useState('');
  const [shortNameFilterId, setShortNameFilterId] = useState<number | null>(null);
  const [sizeFilterId, setSizeFilterId] = useState<number | null>(null);
  const [colorFilterId, setColorFilterId] = useState<number | null>(null);
  const [manufactureFilterId, setManufactureFilterId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const isSearchActive =
    articleSearchQuery.trim().length > 0 || nameSearchQuery.trim().length > 0;
  const isDictionaryFilterActive =
    shortNameFilterId !== null ||
    sizeFilterId !== null ||
    colorFilterId !== null ||
    manufactureFilterId !== null;
  const isFilterActive = isSearchActive || isDictionaryFilterActive;

  const { data: productsData, mutate, isLoading: loading, error } = useReferencesData(
    'TMZ',
    token,
    selectedEnterpriseId,
  );
  const products = useMemo(() => productsData || [], [productsData]);

  const balancesMap = useMemo<Record<string, TmzBalanceEntry>>(() => {
    return values?.balances ?? {};
  }, [values?.balances]);

  const getBalanceForProduct = useCallback(
    (product: Product): TmzBalanceEntry | null => {
      if (product.isFolder) return null;
      const entry = balancesMap[String(product.id)];
      return entry ?? { qty: 0, sum: 0, schet: '' };
    },
    [balancesMap],
  );

  const filterProductsByTypeTMZ = useCallback((items: Product[]): Product[] => {
    return items.filter((product) => {
      if (product.isFolder) return true;
      const typeTMZ = product.refValues?.typeTMZ;
      return (
        typeTMZ === TypeTMZ.MATERIAL ||
        typeTMZ === TypeTMZ.PRODUCT ||
        typeTMZ === TypeTMZ.HALFSTUFF
      );
    });
  }, []);

  const filterProductsByDeleted = useCallback((items: Product[]): Product[] => {
    return items.filter((product) => product.refValues?.markToDeleted !== true);
  }, []);

  const getCurrentFolderItems = useCallback(
    (items: Product[], folderId: number | null): Product[] => {
      const currentItems = items.filter((item) => {
        if (folderId === null) {
          return item.parentId === null || item.parentId === undefined || item.parentId === 0;
        }
        return item.parentId === folderId;
      });
      return [...currentItems].sort(compareTmzCatalogItems);
    },
    [],
  );

  const navigateToFolder = useCallback(
    (folderId: number | null) => {
      setCurrentFolderId(folderId);
      if (folderId === null) {
        setFolderPath([{ id: null, name: 'Бош ойна' }]);
      } else {
        const folder = products.find((p: Product) => p.id === folderId);
        if (folder) {
          setFolderPath((prev) => [...prev, { id: folderId, name: folder.name }]);
        }
      }
    },
    [products],
  );

  const navigateToBreadcrumb = useCallback((targetFolderId: number | null) => {
    setCurrentFolderId(targetFolderId);
    setFolderPath((prev) => {
      const targetIndex = prev.findIndex((item) => item.id === targetFolderId);
      if (targetIndex !== -1) return prev.slice(0, targetIndex + 1);
      return prev;
    });
  }, []);

  const handleFolderClick = useCallback(
    (product: Product) => {
      if (product.isFolder) navigateToFolder(product.id);
    },
    [navigateToFolder],
  );

  const buildTree = useCallback(
    (items: Product[]): ProductTreeNode[] => {
      const childrenByParentId = new Map<number | null, ProductTreeNode[]>();
      const roots: ProductTreeNode[] = [];

      items.forEach((item) => {
        const node: ProductTreeNode = {
          item,
          children: [],
          level: 0,
          isOpen: openFolders.has(item.id),
        };
        const parentId =
          item.parentId === null || item.parentId === undefined || item.parentId === 0
            ? null
            : item.parentId;
        if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, []);
        childrenByParentId.get(parentId)!.push(node);
      });

      const setLevelsAndChildren = (node: ProductTreeNode, level: number) => {
        node.level = level;
        const children = childrenByParentId.get(node.item.id) || [];
        node.children = children;
        children.forEach((child) => setLevelsAndChildren(child, level + 1));
      };

      const rootNodes = childrenByParentId.get(null) || [];
      rootNodes.forEach((rootNode) => {
        setLevelsAndChildren(rootNode, 0);
        roots.push(rootNode);
      });

      const sortTree = (nodes: ProductTreeNode[]): ProductTreeNode[] =>
        [...nodes]
          .sort((a, b) => compareTmzCatalogItems(a.item, b.item))
          .map((node) => {
            if (node.children.length > 0) node.children = sortTree(node.children);
            return node;
          });

      return sortTree(roots);
    },
    [openFolders],
  );

  const toggleFolder = useCallback((folderId: number) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const displayItems = useMemo(() => {
    let allProducts = filterProductsByDeleted(filterProductsByTypeTMZ(products));

    if (isFilterActive) {
      allProducts = allProducts.filter((product) => {
        if (isSearchActive && !matchTmzCombinedSearch(product, articleSearchQuery, nameSearchQuery)) {
          return false;
        }
        if (shortNameFilterId !== null && product.refValues?.shortNameId !== shortNameFilterId) {
          return false;
        }
        if (sizeFilterId !== null && product.refValues?.sizeId !== sizeFilterId) return false;
        if (colorFilterId !== null && product.refValues?.colorId !== colorFilterId) return false;
        if (
          manufactureFilterId !== null &&
          product.refValues?.manufactureId !== manufactureFilterId
        ) {
          return false;
        }
        return true;
      });
      return [...allProducts].sort(compareTmzCatalogItems);
    }

    if (viewMode === 'grid') {
      return getCurrentFolderItems(allProducts, currentFolderId);
    }
    return allProducts;
  }, [
    products,
    articleSearchQuery,
    nameSearchQuery,
    isSearchActive,
    isFilterActive,
    shortNameFilterId,
    sizeFilterId,
    colorFilterId,
    manufactureFilterId,
    getCurrentFolderItems,
    currentFolderId,
    viewMode,
    filterProductsByTypeTMZ,
    filterProductsByDeleted,
  ]);

  const treeData = useMemo(() => {
    if (viewMode === 'list' && !isFilterActive) return buildTree(displayItems);
    return [];
  }, [displayItems, buildTree, viewMode, isFilterActive]);

  const totalItems = displayItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = displayItems.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    articleSearchQuery,
    nameSearchQuery,
    shortNameFilterId,
    sizeFilterId,
    colorFilterId,
    manufactureFilterId,
    viewMode,
    currentFolderId,
  ]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    const list = document.querySelector(`.${styles.balanceProductList}`);
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const renderGridItem = useCallback(
    (product: Product) => (
      <TmzBalanceCatalogItem
        key={product.id}
        product={product}
        balance={getBalanceForProduct(product)}
        level={0}
        isFolder={product.isFolder || false}
        hasChildren={false}
        isOpen={false}
        viewMode={viewMode}
        onToggleFolder={() => handleFolderClick(product)}
      />
    ),
    [getBalanceForProduct, viewMode, handleFolderClick],
  );

  const renderListItem = useCallback(
    (product: Product) => (
      <TmzBalanceCatalogItem
        key={product.id}
        product={product}
        balance={getBalanceForProduct(product)}
        level={0}
        isFolder={product.isFolder || false}
        hasChildren={false}
        isOpen={false}
        viewMode="list"
        onToggleFolder={() => {}}
      />
    ),
    [getBalanceForProduct],
  );

  const renderTreeNode = useCallback(
    (node: ProductTreeNode): JSX.Element => {
      const isFolder = node.item.isFolder;
      const isOpen = openFolders.has(node.item.id);
      const hasChildren = node.children.length > 0;

      return (
        <React.Fragment key={node.item.id}>
          <TmzBalanceCatalogItem
            product={node.item}
            balance={getBalanceForProduct(node.item)}
            level={node.level}
            isFolder={isFolder || false}
            hasChildren={hasChildren}
            isOpen={isOpen}
            viewMode={viewMode}
            onToggleFolder={() => toggleFolder(node.item.id)}
          />
          {isFolder && isOpen && hasChildren && node.children.map((child) => renderTreeNode(child))}
        </React.Fragment>
      );
    },
    [openFolders, viewMode, getBalanceForProduct, toggleFolder],
  );

  if (!values) {
    return (
      <div className={styles.container} {...props}>
        <div className={styles.title}>Асосий омбор — ТМЗ қолдиқлари</div>
        <div className={styles.emptyMessage}>Маълумотлар юкланмоқда</div>
      </div>
    );
  }

  if (values.warehouseId == null) {
    return (
      <div className={styles.container} {...props}>
        <div className={styles.title}>Асосий омбор — ТМЗ қолдиқлари</div>
        <div className={styles.emptyMessage}>{values.warehouseName}</div>
      </div>
    );
  }

  const balanceDateLabel = formatReportDate(values.balanceDate);

  return (
    <div className={styles.container} {...props}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.title}>Асосий омбор — ТМЗ қолдиқлари</div>
          <div className={styles.subtitle}>
            {values.warehouseName} · Колдик санаси: {balanceDateLabel}
          </div>
        </div>
        <div className={styles.viewModeToggle}>
          <button
            type="button"
            className={cn(styles.viewModeButton, { [styles.active]: viewMode === 'grid' })}
            onClick={() => setViewMode('grid')}
          >
            Сетка
          </button>
          <button
            type="button"
            className={cn(styles.viewModeButton, { [styles.active]: viewMode === 'list' })}
            onClick={() => setViewMode('list')}
          >
            Рўйхат
          </button>
        </div>
      </div>

      <div className={styles.catalogBody}>
        {viewMode === 'grid' && (
          <ProductCatalogNavigation
            folderPath={folderPath}
            onNavigateToFolder={navigateToBreadcrumb}
          />
        )}

        <ProductCatalogSearch
          articleValue={articleSearchQuery}
          nameValue={nameSearchQuery}
          onArticleChange={setArticleSearchQuery}
          onNameChange={setNameSearchQuery}
          shortNameFilterId={shortNameFilterId}
          sizeFilterId={sizeFilterId}
          colorFilterId={colorFilterId}
          manufactureFilterId={manufactureFilterId}
          onShortNameFilterChange={setShortNameFilterId}
          onSizeFilterChange={setSizeFilterId}
          onColorFilterChange={setColorFilterId}
          onManufactureFilterChange={setManufactureFilterId}
          referenceEnterpriseId={selectedEnterpriseId}
        />

        {!loading && !error && displayItems.length > 0 && (viewMode === 'grid' || isFilterActive) && (
          <div className={styles.itemsPerPageSelector}>
            <label htmlFor="tmzBalanceItemsPerPage">Товаров на странице:</label>
            <select
              id="tmzBalanceItemsPerPage"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className={styles.itemsPerPageSelect}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingMessage}>
              <LoadingIco className={styles.loadingIco} />
              <span>Товарлар юкланмоқда...</span>
            </div>
          ) : error ? (
            <div className={styles.errorMessage}>
              <span>Товарлар юкланишида хатолик</span>
              <button type="button" onClick={() => mutate()} className={styles.retryButton}>
                Кайта уриниш
              </button>
            </div>
          ) : (
            <div
              className={cn(
                styles.balanceProductList,
                catalogStyles.productList,
                viewMode === 'grid' ? catalogStyles.gridView : catalogStyles.listView,
              )}
            >
              {viewMode === 'grid'
                ? paginatedItems.map(renderGridItem)
                : isFilterActive
                  ? paginatedItems.map(renderListItem)
                  : treeData.map((node) => renderTreeNode(node))}
            </div>
          )}

          {!loading &&
            !error &&
            (viewMode === 'grid'
              ? displayItems.length === 0
              : isFilterActive
                ? displayItems.length === 0
                : treeData.length === 0) && (
              <div className={styles.emptyMessage}>
                {isFilterActive ? 'Товарлар топилмади' : viewMode === 'grid' ? 'Папка пуста' : 'Нет товаров'}
              </div>
            )}

          {!loading && !error && totalPages > 1 && (viewMode === 'grid' || isFilterActive) && (
            <div className={styles.paginationFooter}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
