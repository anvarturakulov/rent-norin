'use client'
import React, { useEffect, useMemo, memo, useState, useCallback, useId, useRef } from 'react';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { Product, ProductTreeNode } from '@/app/interfaces/product.interface';
import { useGlobalStockManagement } from '@/app/context/websocket.context';
import { VisibilityObserver } from '@/app/components/VisibilityObserver';
import { getStockByItem } from '@/app/service/stocks/getStockByItem';
import { ProductCatalogItem } from './components/productCatalogItem';
import { ProductCatalogSearch } from './components/productCatalogSearch';
import { ProductCatalogHeader } from './components/productCatalogHeader';
import { ProductCatalogNavigation } from './components/productCatalogNavigation';
import { ProductModal } from './components/productModal';
import { Pagination } from './components/pagination';
import LoadingIco from '@/app/components/common/loading.svg';
import { useReferencesData } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { matchTmzCombinedSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';
import { compareTmzCatalogItems } from '@/app/service/references/compareTmzCatalogItems';
import styles from './productCatalog.module.css';
import { getSchetForDocumentType, DocumentType, TypeDocumentByComeOut } from '@/app/interfaces/document.interface';
import { getDocumentTypeByComeOut } from '@/app/components/documents/document/docValues/components/helpers/getDocumentTypeByComeOut';
import { getTypeDocumentForReference } from '@/app/service/documents/getTypeDocumentForReference';
import { TypeTMZ, TypeReference } from '@/app/interfaces/reference.interface';
import { UserRoles } from '@/app/interfaces/user.interface';
import { ReferencesService } from '@/app/service/references/references.service';
import { showMessage } from '@/app/service/common/showMessage';
import type { DecimalFractionDigits } from '@/app/service/common/decimalInput';

interface ProductCatalogProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product, quantity: number, customPrice?: number) => void;
  warehouseId?: number; 
  typeDocumentByComeOut: TypeDocumentByComeOut;
  documentType?: DocumentType | string; // Добавляем documentType для определения схемы
  documentDate?: number; // Дата документа для запроса остатков
  allowNegativeStock?: boolean; // Разрешить выбор товаров даже при нулевом/отрицательном остатке
  /** Фильтр справочника TMZ по организации (как в API references?enterpriseId=) */
  referenceEnterpriseId?: number | null;
  /** Режим каталога: добавление или замена строки */
  catalogMode?: 'add' | 'replace' | 'pick';
  /** Текущая номенклатура: в replace — предзаполнение поиска; иначе — папка и подсветка */
  focusProduct?: {
    id: number;
    name?: string;
    article?: string;
  };
  /** Переопределение счёта для запроса остатков (если отличается от documentType) */
  stockSchet?: string;
  /** Точность количества в модале: 2 (документы) или 3 (нормы материалов) */
  quantityFractionDigits?: DecimalFractionDigits;
}

function normalizeCatalogParentId(parentId?: number | null): number | null {
  if (parentId === null || parentId === undefined || parentId === 0) return null;
  return parentId;
}

function buildFolderPathToParent(
  products: Product[],
  item: Product,
): { path: { id: number | null; name: string }[]; parentId: number | null; ancestorIds: number[] } {
  const byId = new Map(products.map((product) => [product.id, product]));
  const parentId = normalizeCatalogParentId(item.parentId);
  const ancestors: { id: number; name: string }[] = [];
  const visited = new Set<number>();
  let currentId = parentId;

  while (currentId != null && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = byId.get(currentId);
    if (!folder) break;
    ancestors.unshift({ id: folder.id, name: folder.name });
    currentId = normalizeCatalogParentId(folder.parentId);
  }

  return {
    parentId,
    ancestorIds: ancestors.map((ancestor) => ancestor.id),
    path: [{ id: null, name: 'Бош ойна' }, ...ancestors],
  };
}

const ProductCatalog = memo<ProductCatalogProps>(({
  className,
  isOpen,
  onClose,
  onSelectProduct,
  warehouseId,
  typeDocumentByComeOut,
  documentType,
  documentDate,
  allowNegativeStock = false,
  referenceEnterpriseId,
  catalogMode = 'add',
  focusProduct,
  stockSchet,
  quantityFractionDigits = 2,
}): JSX.Element => {

  const { mainData, setMainData } = useAppContext();
  const { user } = mainData.users;
  const token = user?.token;
  const catalogInstanceId = useId();

  const canCreateTmz = useMemo(() => {
    const role = user?.role;
    if (!role) return false;
    return [
      UserRoles.ADMINGLOBAL,
      UserRoles.HEADCOMPANY,
      UserRoles.GLAVBUX,
      UserRoles.HEADGLOBAL,
    ].includes(role);
  }, [user?.role]);
  const agentId = user?.id?.toString() || 'default-agent';
  
  // Используем warehouseId из пропсов или основной склад по умолчанию
  const actualWarehouseId = warehouseId; // Основной склад по умолчанию

  // Определяем схему на основе типа документа
  // Для готовой продукции используем S28 по умолчанию (не S29!)
  const schet =
    stockSchet ??
    (documentType
      ? getSchetForDocumentType(documentType as DocumentType)
      : typeDocumentByComeOut === 'come'
        ? 'S28'
        : 'S29'); // Для прихода готовой продукции - S28

  // Состояние для навигации по папкам (Grid режим)
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null); // null = корневая папка
  const [folderPath, setFolderPath] = useState<{ id: number | null; name: string }[]>([
    { id: null, name: 'Бош ойна' }
  ]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [nameSearchQuery, setNameSearchQuery] = useState('');
  const [shortNameFilterId, setShortNameFilterId] = useState<number | null>(null);
  const [sizeFilterId, setSizeFilterId] = useState<number | null>(null);
  const [colorFilterId, setColorFilterId] = useState<number | null>(null);
  const [manufactureFilterId, setManufactureFilterId] = useState<number | null>(null);
  const isSearchActive = articleSearchQuery.trim().length > 0 || nameSearchQuery.trim().length > 0;
  const isDictionaryFilterActive =
    shortNameFilterId !== null ||
    sizeFilterId !== null ||
    colorFilterId !== null ||
    manufactureFilterId !== null;
  const isFilterActive = isSearchActive || isDictionaryFilterActive;
  const [openFolders, setOpenFolders] = useState<Set<number>>(new Set()); // Для list режима
  
  // Состояние модального окна товара
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  
  
  // Состояние пагинации
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20); // 20 товаров на странице
  const skipNextPageResetRef = useRef(false);
  const restoredFocusKeyRef = useRef<string | null>(null);
  
  // Функции для управления модальным окном товара
  const handleOpenProductModal = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  }, [documentType, typeDocumentByComeOut]);
  
  const handleCloseProductModal = useCallback(() => {
    setIsProductModalOpen(false);
    setSelectedProduct(null);
  }, []);

  const handleCreateNewProduct = useCallback(() => {
    if (!setMainData || !canCreateTmz) return;
    setMainData('reference.lastCreatedForInline', null);
    setMainData('reference.inlineCreation', {
      typeReference: TypeReference.TMZ,
      instanceId: catalogInstanceId,
    });
  }, [setMainData, catalogInstanceId, canCreateTmz]);

  const handleDoubleClickProduct = useCallback((product: Product) => {
    if (!setMainData || !token) return;
    setMainData('reference.lastCreatedForInline', null);
    setMainData('reference.inlineCreation', {
      typeReference: TypeReference.TMZ,
      instanceId: catalogInstanceId,
      referenceId: product.id,
    });
  }, [setMainData, catalogInstanceId, token]);

  // Используем хук для получения данных как в referencesList
  const { data: productsData, mutate, isLoading: loading, error } = useReferencesData(
    'TMZ',
    token,
    referenceEnterpriseId,
  );
  const products = useMemo(() => productsData || [], [productsData]);

  const handleDuplicateProduct = useCallback(async (product: Product) => {
    if (!setMainData || !token || !product.id) return;
    try {
      await ReferencesService.duplicateReference(product.id, token);
      showMessage(`"${product.name}" нусхаси яратилди`, 'success', setMainData);
      await mutate(undefined, { revalidate: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Маҳсулотни нусхалашда хатолик';
      showMessage(message, 'error', setMainData);
    }
  }, [setMainData, token, mutate]);

  // После создания нового товара из каталога — открыть окно выбора количества/цены.
  // При редактировании (двойной клик) lastCreatedForInline не выставляется — остаёмся в каталоге.
  const lastCreatedForInline = mainData.reference?.lastCreatedForInline;
  useEffect(() => {
    if (!isOpen || !lastCreatedForInline) return;
    if (lastCreatedForInline.instanceId !== catalogInstanceId) return;

    const created = lastCreatedForInline.reference;
    if (!created?.id || created.isFolder) {
      setMainData?.('reference.lastCreatedForInline', null);
      return;
    }

    const newProduct: Product = {
      id: created.id,
      name: created.name,
      article: created.article,
      parentId: created.parentId,
      isFolder: created.isFolder,
      refValues: created.refValues,
    };

    void mutate(undefined, { revalidate: true });
    setSelectedProduct(newProduct);
    setIsProductModalOpen(true);
    setMainData?.('reference.lastCreatedForInline', null);
  }, [isOpen, lastCreatedForInline, catalogInstanceId, setMainData, mutate]);

  // УБРАНО: Отладочная информация о загруженных товарах

  // УБРАНО: Логирование ошибок загрузки

  // Ревалидируем товары при открытии каталога (всегда получаем свежие данные из БД)
  useEffect(() => {
    if (isOpen && token) {
      mutate(undefined, { revalidate: true });
    }
  }, [isOpen, token, mutate]);

  // Сброс навигации и поиска при открытии каталога
  useEffect(() => {
    if (!isOpen) {
      restoredFocusKeyRef.current = null;
      return;
    }
    setCurrentFolderId(null);
    setFolderPath([{ id: null, name: 'Бош ойна' }]);
    if (catalogMode === 'replace' && focusProduct) {
      setNameSearchQuery(focusProduct.name?.trim() ?? '');
      setArticleSearchQuery(focusProduct.article?.trim() ?? '');
    } else {
      setArticleSearchQuery('');
      setNameSearchQuery('');
    }
    setShortNameFilterId(null);
    setSizeFilterId(null);
    setColorFilterId(null);
    setManufactureFilterId(null);
  }, [isOpen, catalogMode, focusProduct?.id, focusProduct?.name, focusProduct?.article]);

  // Закрытие по Escape (не закрываем каталог, если открыта ProductModal или inline-редактор)
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isProductModalOpen) return;

      const inlineCreation = mainData.reference?.inlineCreation;
      if (inlineCreation?.instanceId === catalogInstanceId) return;
      // Открыт вложенный inline-атрибут (color/shortName и т.п.) поверх формы ТМЗ — каталог не закрываем.
      if (mainData.reference?.nestedInlineCreation) return;

      onClose();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, isProductModalOpen, onClose, catalogInstanceId, mainData.reference?.inlineCreation, mainData.reference?.nestedInlineCreation]);

  // Сброс состояния при переключении режимов
  useEffect(() => {
    if (viewMode === 'grid') {
      // При переключении на grid - сбрасываем состояние раскрытых папок
      setOpenFolders(new Set());
    } else {
      // При переключении на list - сбрасываем навигацию
      setCurrentFolderId(null);
      setFolderPath([{ id: null, name: 'Бош ойна' }]);
    }
  }, [viewMode]);

  const { stocks, updateStocks, getStock, addVisibleItem, removeVisibleItem, getVisibleSubscriptions, clearVisibleItems, clearStocks, visibleItems } = useGlobalStockManagement();
  
  // Очищаем кеш остатков при закрытии каталога
  useEffect(() => {
    if (!isOpen) {
      clearStocks();
      clearVisibleItems();
    }
  }, [isOpen, clearStocks, clearVisibleItems]);
  
  // УБРАНО: WebSocket подписки на остатки
  // Теперь остатки получаются через REST API при выборе товара
  // WebSocket больше не используется для остатков, поэтому isConnected всегда false
  const isConnected = false;
  
  // Функция для запроса остатков через REST API при появлении товара в зоне видимости
  // БЕЗ КЕША - всегда запрашиваем остатки из БД
  const handleItemVisible = useCallback(async (schet: string, itemId: string) => {
    // Добавляем товар в список видимых
    addVisibleItem(schet, itemId);
    
    // Парсим itemId (формат: "warehouseId:productId")
    const [warehouseIdStr, productIdStr] = itemId.split(':');
    const warehouseId = Number(warehouseIdStr);
    const productId = Number(productIdStr);
    
    if (!warehouseId || !productId || isNaN(warehouseId) || isNaN(productId)) {
      return;
    }
    
    try {
      // Получаем дату документа и enterpriseId
      const currentDocument = mainData.document.currentDocument;
      const docDate = currentDocument?.date || documentDate || Date.now();
      const enterpriseId =
        referenceEnterpriseId ??
        currentDocument?.enterpriseId ??
        mainData.users.user?.enterpriseId;
      
      // Всегда запрашиваем остаток через REST API (без кеша)
      const stockData = await getStockByItem(
        schet,
        warehouseId,
        productId,
        docDate,
        enterpriseId ?? undefined,
        mainData.users.user?.token
      );
      
      // Сохраняем остаток в локальное состояние для отображения
      updateStocks({
        type: 'update',
        stocks: {
          [schet]: {
            [itemId]: stockData
          }
        }
      });
      
    } catch (error) {
      // Не показываем ошибку пользователю, просто не загружаем остаток
    }
  }, [addVisibleItem, updateStocks, mainData, documentDate, schet, referenceEnterpriseId]);

  // УБРАНО: WebSocket подписки и throttling таймеры
  // Теперь остатки получаются через REST API при выборе товара
  // useEffect(() => {
  //   console.log('📦 Монтируем каталог товаров');
  //   return () => {
  //     console.log('📦 Размонтируем каталог');
  //     
  //     // Очищаем throttling таймеры
  //     if (subscriptionThrottleRef.current) {
  //       clearTimeout(subscriptionThrottleRef.current);
  //     }
  //   };
  // }, []);



  // =============== ФУНКЦИИ ДЛЯ GRID РЕЖИМА (навигация по папкам) ===============

  // Функция для получения элементов текущей папки
  const getCurrentFolderItems = useCallback((items: Product[], folderId: number | null): Product[] => {
    if (!items || items.length === 0) return [];
    
    // Фильтруем элементы, которые являются дочерними для текущей папки
    const currentItems = items.filter(item => {
      if (folderId === null) {
        // Корневая папка - показываем элементы без родителя или с parentId = null/0
        return item.parentId === null || item.parentId === undefined || item.parentId === 0;
      } else {
        // Показываем элементы, родитель которых - текущая папка
        return item.parentId === folderId;
      }
    });

    return [...currentItems].sort(compareTmzCatalogItems);
  }, []);

  // Функция для навигации в папку
  const navigateToFolder = useCallback((folderId: number | null, folderName?: string) => {
    setCurrentFolderId(folderId);
    
    if (folderId === null) {
      // Переход в корневую папку
      setFolderPath([{ id: null, name: 'Бош ойна' }]);
    } else {
      // Находим папку в данных
      const folder = products.find((p: Product) => p.id === folderId);
      if (folder) {
        // Добавляем папку в путь
        setFolderPath(prev => [...prev, { id: folderId, name: folder.name }]);
      }
    }
  }, [products]);

  // Функция для навигации по breadcrumbs
  const navigateToBreadcrumb = useCallback((targetFolderId: number | null) => {
    setCurrentFolderId(targetFolderId);
    
    // Обрезаем путь до выбранной папки
    setFolderPath(prev => {
      const targetIndex = prev.findIndex(item => item.id === targetFolderId);
      if (targetIndex !== -1) {
        return prev.slice(0, targetIndex + 1);
      }
      return prev;
    });
  }, []);

  // Функция для обработки клика по папке (открыть папку в grid режиме)
  const handleFolderClick = useCallback((product: Product) => {
    if (product.isFolder) {
      navigateToFolder(product.id, product.name);
    }
  }, [navigateToFolder]);

  // =============== ФУНКЦИИ ДЛЯ LIST РЕЖИМА (иерархическое дерево) ===============

  // Функция для построения дерева из плоского списка (оптимизирована O(n))
  const buildTree = useCallback((items: Product[]): ProductTreeNode[] => {
    if (!items || items.length === 0) return [];
    
    const itemMap = new Map<number, ProductTreeNode>();
    const childrenByParentId = new Map<number | null, ProductTreeNode[]>();
    const roots: ProductTreeNode[] = [];

    // Создаем узлы для всех элементов и группируем по parentId
    items.forEach(item => {
      const node: ProductTreeNode = {
        item,
        children: [],
        level: 0,
        isOpen: openFolders.has(item.id)
      };
      itemMap.set(item.id, node);
      
      const parentId = item.parentId === null || item.parentId === undefined || item.parentId === 0 ? null : item.parentId;
      
      if (!childrenByParentId.has(parentId)) {
        childrenByParentId.set(parentId, []);
      }
      childrenByParentId.get(parentId)!.push(node);
    });

    // Рекурсивная функция для установки уровней и связывания детей
    const setLevelsAndChildren = (node: ProductTreeNode, level: number) => {
      node.level = level;
      const children = childrenByParentId.get(node.item.id) || [];
      node.children = children;
      
      children.forEach(child => {
        setLevelsAndChildren(child, level + 1);
      });
    };

    // Обрабатываем корневые элементы
    const rootNodes = childrenByParentId.get(null) || [];
    rootNodes.forEach(rootNode => {
      setLevelsAndChildren(rootNode, 0);
      roots.push(rootNode);
    });

    // Сортируем корневые элементы и рекурсивно сортируем дочерние
    const sortTree = (nodes: ProductTreeNode[]): ProductTreeNode[] => {
      return [...nodes].sort((a, b) => compareTmzCatalogItems(a.item, b.item)).map(node => {
        if (node.children.length > 0) {
          node.children = sortTree(node.children);
        }
        return node;
      });
    };

    return sortTree(roots);
  }, [openFolders]);

  // Функция для переключения состояния папки (для list режима)
  const toggleFolder = useCallback((folderId: number) => {
    setOpenFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  // =============== ЛОГИКА ОТОБРАЖЕНИЯ ДАННЫХ ===============

  const handleArticleSearchChange = useCallback((value: string) => {
    setArticleSearchQuery(value);
  }, []);

  const handleNameSearchChange = useCallback((value: string) => {
    setNameSearchQuery(value);
  }, []);

  const handleShortNameFilterChange = useCallback((id: number | null) => {
    setShortNameFilterId(id);
  }, []);

  const handleSizeFilterChange = useCallback((id: number | null) => {
    setSizeFilterId(id);
  }, []);

  const handleColorFilterChange = useCallback((id: number | null) => {
    setColorFilterId(id);
  }, []);

  const handleManufactureFilterChange = useCallback((id: number | null) => {
    setManufactureFilterId(id);
  }, []);

  // Функция для проверки, нужно ли фильтровать по остаткам
  const shouldFilterByStock = useCallback(() => {
    if (!documentType) return true;
    return getDocumentTypeByComeOut(documentType as DocumentType) !== 'come';
  }, [documentType]);

  // Функция для фильтрации товаров по остаткам
  const filterProductsByStock = useCallback((productsToFilter: Product[]): Product[] => {
    // Теперь показываем все товары, но возможность добавления зависит от типа документа и остатков
    // Фильтрация по остаткам перенесена в компонент ProductCatalogItem
    return productsToFilter;
  }, []);

  // Функция для фильтрации товаров по TypeTMZ
  const filterProductsByTypeTMZ = useCallback((productsToFilter: any[]): any[] => {
    if (!documentType) {
      return productsToFilter;
    }
    
    // Для шаблонов (OTHER) показываем все товары - материалы, продукты, полуфабрикаты
    if (documentType === 'OTHER') {
      return productsToFilter;
    }
    
    // Для ComeMaterial показываем материалы, готовую продукцию и полуфабрикаты
    if (documentType === DocumentType.ComeMaterial) {
      return productsToFilter.filter((product: any) => {
        // Папки всегда показываем
        if (product.isFolder) {
          return true;
        }
        // Показываем материалы, готовую продукцию и полуфабрикаты
        const productTypeTMZ = product.refValues?.typeTMZ;
        return productTypeTMZ === TypeTMZ.MATERIAL || productTypeTMZ === TypeTMZ.PRODUCT || productTypeTMZ === TypeTMZ.HALFSTUFF;
      });
    }
    
    // Для LeaveMaterial показываем материалы, готовую продукцию и полуфабрикаты
    if (documentType === DocumentType.LeaveMaterial || documentType === DocumentType.LeaveOnlyOneMaterial) {
      return productsToFilter.filter((product: any) => {
        // Папки всегда показываем
        if (product.isFolder) {
          return true;
        }
        // Показываем материалы, готовую продукцию и полуфабрикаты
        const productTypeTMZ = product.refValues?.typeTMZ;
        return productTypeTMZ === TypeTMZ.MATERIAL || productTypeTMZ === TypeTMZ.PRODUCT || productTypeTMZ === TypeTMZ.HALFSTUFF;
      });
    }
    
    // Для MoveMaterial показываем материалы, готовую продукцию и полуфабрикаты
    if (documentType === DocumentType.MoveMaterial) {
      return productsToFilter.filter((product: any) => {
        // Папки всегда показываем
        if (product.isFolder) {
          return true;
        }
        // Показываем материалы, готовую продукцию и полуфабрикаты
        const productTypeTMZ = product.refValues?.typeTMZ;
        return productTypeTMZ === TypeTMZ.MATERIAL || productTypeTMZ === TypeTMZ.PRODUCT || productTypeTMZ === TypeTMZ.HALFSTUFF;
      });
    }

    // Документы инструментов — только TypeTMZ.TOOLS (свои, не субаренда)
    if (
      documentType === DocumentType.ComeTools ||
      documentType === DocumentType.MoveTools ||
      documentType === DocumentType.LeaveTools ||
      documentType === DocumentType.SaleTools ||
      documentType === DocumentType.TransferToolsToClient ||
      documentType === DocumentType.OrderToolsToClient ||
      documentType === DocumentType.ReceiveToolsFromClient
    ) {
      return productsToFilter.filter((product: any) => {
        if (product.isFolder) {
          return true;
        }
        return (
          product.refValues?.typeTMZ === TypeTMZ.TOOLS &&
          !product.refValues?.isSubleaseTool
        );
      });
    }

    // Субаренда — только TOOLS с флагом isSubleaseTool
    if (
      documentType === DocumentType.TransferSubleaseToolsToClient ||
      documentType === DocumentType.ReceiveSubleaseToolsFromClient
    ) {
      return productsToFilter.filter((product: any) => {
        if (product.isFolder) {
          return true;
        }
        return (
          product.refValues?.typeTMZ === TypeTMZ.TOOLS &&
          Boolean(product.refValues?.isSubleaseTool)
        );
      });
    }

    if (
      documentType === DocumentType.ComeTovar ||
      documentType === DocumentType.LeaveTovar ||
      documentType === DocumentType.SaleTovar
    ) {
      return productsToFilter.filter((product: any) => {
        if (product.isFolder) {
          return true;
        }
        return product.refValues?.typeTMZ === TypeTMZ.TOVAR;
      });
    }
    
    const requiredTypeTMZ = getTypeDocumentForReference(documentType as string);
    
    const filteredProducts = productsToFilter.filter((product: any) => {
      // Папки всегда показываем
      if (product.isFolder) {
        return true;
      }
      
      // Для товаров проверяем TypeTMZ
      const productTypeTMZ = product.refValues?.typeTMZ;
      
      switch (requiredTypeTMZ) {
        case 'MATERIAL':
          return productTypeTMZ === TypeTMZ.MATERIAL;
        case 'PRODUCT':
          return productTypeTMZ === TypeTMZ.PRODUCT;
        case 'HALFSTUFF':
          return productTypeTMZ === TypeTMZ.HALFSTUFF;
        case 'OS':
          return productTypeTMZ === TypeTMZ.OS;
        case 'TOOLS':
          // На случай других tools-доков: исключаем субарендные
          return (
            productTypeTMZ === TypeTMZ.TOOLS &&
            !product.refValues?.isSubleaseTool
          );
        case 'TOVAR':
          return productTypeTMZ === TypeTMZ.TOVAR;
        default:
          return true;
      }
    });
    
    return filteredProducts;
  }, [documentType]);

  // Функция для фильтрации товаров, помеченных на удаление
  const filterProductsByDeleted = useCallback((productsToFilter: Product[]): Product[] => {
    return productsToFilter.filter((product: Product) => {
      // Исключаем товары и папки, помеченные на удаление
      return product.refValues?.markToDeleted !== true;
    });
  }, []);

  // Получаем элементы для отображения в зависимости от режима
  const displayItems = useMemo(() => {
    // Временно показываем все товары без фильтрации по warehouseId
    let allProducts = products;
    
    // Сначала фильтруем по TypeTMZ
    allProducts = filterProductsByTypeTMZ(allProducts);
    
    // Фильтруем товары, помеченные на удаление
    allProducts = filterProductsByDeleted(allProducts);
    
    // Пагинация - не ограничиваем количество, а разбиваем на страницы
    
    if (isFilterActive) {
      allProducts = allProducts.filter((product: Product) => {
        if (isSearchActive && !matchTmzCombinedSearch(product, articleSearchQuery, nameSearchQuery)) {
          return false;
        }
        if (shortNameFilterId !== null && product.refValues?.shortNameId !== shortNameFilterId) {
          return false;
        }
        if (sizeFilterId !== null && product.refValues?.sizeId !== sizeFilterId) {
          return false;
        }
        if (colorFilterId !== null && product.refValues?.colorId !== colorFilterId) {
          return false;
        }
        if (manufactureFilterId !== null && product.refValues?.manufactureId !== manufactureFilterId) {
          return false;
        }
        return true;
      });

      return [...allProducts].sort(compareTmzCatalogItems);
    } else {
      if (viewMode === 'grid') {
        // Grid режим - навигация по папкам: показываем только элементы текущей папки
        const folderItems = getCurrentFolderItems(allProducts, currentFolderId);
        return filterProductsByStock(folderItems);
      } else {
        // List режим - иерархическое дерево: показываем все товары
        return filterProductsByStock(allProducts);
      }
    }
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
    filterProductsByStock,
    filterProductsByTypeTMZ,
    filterProductsByDeleted,
  ]);

  // Строим дерево из данных (только для list режима)
  const treeData = useMemo(() => {
    if (viewMode === 'list' && !isFilterActive) {
      return buildTree(displayItems);
    }
    return [];
  }, [displayItems, buildTree, viewMode, isFilterActive]);

  // Логика пагинации
  const totalItems = displayItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = displayItems.slice(startIndex, endIndex);

  // Сброс страницы при изменении поиска или фильтров
  useEffect(() => {
    if (skipNextPageResetRef.current) {
      skipNextPageResetRef.current = false;
      return;
    }
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

  // После загрузки справочника — открыть папку текущего ТМЗ (не в режиме replace)
  useEffect(() => {
    if (!isOpen || !focusProduct?.id || products.length === 0 || catalogMode === 'replace') {
      return;
    }

    const restoreKey = String(focusProduct.id);
    if (restoredFocusKeyRef.current === restoreKey) return;

    const item = products.find((product: Product) => product.id === focusProduct.id);
    if (!item) return;

    const { path, parentId, ancestorIds } = buildFolderPathToParent(products, item);
    const visibleProducts = filterProductsByDeleted(filterProductsByTypeTMZ(products));
    const folderItems = getCurrentFolderItems(visibleProducts, parentId);
    const index = folderItems.findIndex((product) => product.id === focusProduct.id);
    const page = index >= 0 ? Math.floor(index / itemsPerPage) + 1 : 1;

    skipNextPageResetRef.current = true;
    restoredFocusKeyRef.current = restoreKey;
    setCurrentFolderId(parentId);
    setFolderPath(path);
    setOpenFolders(new Set(ancestorIds));
    setCurrentPage(page);
  }, [
    isOpen,
    focusProduct?.id,
    products,
    catalogMode,
    filterProductsByDeleted,
    filterProductsByTypeTMZ,
    getCurrentFolderItems,
    itemsPerPage,
  ]);

  // Обработчик изменения страницы
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Прокручиваем к началу списка при смене страницы
    const productList = document.querySelector(`.${styles.productList}`);
    if (productList) {
      productList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Функция-обёртка: передаём товар наверх
  const handleSelectWithReserve = useCallback((product: Product, quantity: number, customPrice?: number) => {
    onSelectProduct(product, quantity, customPrice);  
  }, [onSelectProduct, typeDocumentByComeOut]);

  // =============== ФУНКЦИИ РЕНДЕРИНГА ===============

  // Мемоизированная функция рендеринга элемента каталога для GRID режима
  const renderGridItem = useCallback((product: Product): JSX.Element => {
    const stockKey = `${actualWarehouseId}:${product.id}`;
    const stockData = getStock(schet, stockKey);
    
    
    return (
      <VisibilityObserver
        key={product.id}
        schet={schet}
        itemId={`${actualWarehouseId}:${product.id}`}
        onVisible={() => handleItemVisible(schet, `${actualWarehouseId}:${product.id}`)}
        onHidden={() => removeVisibleItem(schet, `${actualWarehouseId}:${product.id}`)}
      >
        <ProductCatalogItem
          product={product}
          stockData={stockData}
          level={0}
          isFolder={product.isFolder || false}
          hasChildren={false}
          isOpen={false}
          viewMode={viewMode}
          onToggleFolder={() => handleFolderClick(product)}
          onSelectProduct={handleSelectWithReserve}
          onOpenProductModal={handleOpenProductModal}
          onDoubleClickProduct={handleDoubleClickProduct}
          onDuplicate={handleDuplicateProduct}
          canDuplicate={canCreateTmz}
          isConnected={isConnected}
          typeDocumentByComeOut={typeDocumentByComeOut}  
          documentType={documentType}
          allowNegativeStock={allowNegativeStock}
          catalogMode={catalogMode}
          isFocused={focusProduct?.id === product.id}
        />
      </VisibilityObserver>
    );
  }, [viewMode, actualWarehouseId, handleItemVisible, removeVisibleItem, getStock, handleFolderClick, handleSelectWithReserve, handleOpenProductModal, handleDoubleClickProduct, handleDuplicateProduct, canCreateTmz, typeDocumentByComeOut, schet, documentType, stocks, allowNegativeStock, catalogMode, focusProduct?.id]);

  // Функция рендеринга элемента каталога для LIST режима (плоский список)
  const renderListItem = useCallback((product: Product): JSX.Element => {
    return (
      <VisibilityObserver
        key={product.id}
        schet={schet}
        itemId={`${actualWarehouseId}:${product.id}`}
        onVisible={() => handleItemVisible(schet, `${actualWarehouseId}:${product.id}`)}
        onHidden={() => removeVisibleItem(schet, `${actualWarehouseId}:${product.id}`)}
      >
        <ProductCatalogItem
          product={product}
          stockData={getStock(schet, `${actualWarehouseId}:${product.id}`)}
          level={0} // Все элементы на одном уровне в списке поиска
          isFolder={product.isFolder || false}
          hasChildren={false} // Не показываем дочерние элементы в списке поиска
          isOpen={false} // Не используется в списке поиска
          viewMode="list" // Принудительно используем list режим
          onToggleFolder={() => {}} // Пустая функция, так как в поиске не нужна навигация по папкам
          onSelectProduct={handleSelectWithReserve}
          onOpenProductModal={handleOpenProductModal}
          onDoubleClickProduct={handleDoubleClickProduct}
          onDuplicate={handleDuplicateProduct}
          canDuplicate={canCreateTmz}
          isConnected={isConnected}
          typeDocumentByComeOut={typeDocumentByComeOut}
          documentType={documentType}
          allowNegativeStock={allowNegativeStock}
          catalogMode={catalogMode}
          isFocused={focusProduct?.id === product.id}
        />
      </VisibilityObserver>
    );
  }, [actualWarehouseId, handleItemVisible, removeVisibleItem, getStock, handleSelectWithReserve, handleOpenProductModal, handleDoubleClickProduct, handleDuplicateProduct, canCreateTmz, typeDocumentByComeOut, schet, documentType, stocks, allowNegativeStock, catalogMode, focusProduct?.id]);

  // Рекурсивная функция для рендеринга дерева в LIST режиме
  const renderTreeNode = useCallback((node: ProductTreeNode): JSX.Element => {
    const isFolder = node.item.isFolder;
    const isOpen = openFolders.has(node.item.id);
    const hasChildren = node.children.length > 0;

    return (
      <React.Fragment key={node.item.id}>
        <VisibilityObserver
          schet={schet}
          itemId={`${actualWarehouseId}:${node.item.id}`}
          onVisible={() => handleItemVisible(schet, `${actualWarehouseId}:${node.item.id}`)}
          onHidden={() => removeVisibleItem(schet, `${actualWarehouseId}:${node.item.id}`)}
        >
          <ProductCatalogItem
            product={node.item}
            stockData={getStock(schet, `${actualWarehouseId}:${node.item.id}`)}
            level={node.level} // Уровень для отступов в list режиме
            isFolder={isFolder || false}
            hasChildren={hasChildren}
            isOpen={isOpen}
            viewMode={viewMode}
            onToggleFolder={() => toggleFolder(node.item.id)} // При клике на папку - раскрытие/закрытие
            onSelectProduct={handleSelectWithReserve}
            onOpenProductModal={handleOpenProductModal}
            onDoubleClickProduct={handleDoubleClickProduct}
            onDuplicate={handleDuplicateProduct}
            canDuplicate={canCreateTmz}
            isConnected={isConnected}
            typeDocumentByComeOut={typeDocumentByComeOut}
            documentType={documentType}
            allowNegativeStock={allowNegativeStock}
            catalogMode={catalogMode}
            isFocused={focusProduct?.id === node.item.id}
          />
        </VisibilityObserver>
        
        {/* Рекурсивно рендерим дочерние элементы, если папка открыта */}
        {isFolder && isOpen && hasChildren && 
          node.children.map(child => renderTreeNode(child))
        }
      </React.Fragment>
    );
  }, [openFolders, viewMode, actualWarehouseId, handleItemVisible, removeVisibleItem, getStock, toggleFolder, handleSelectWithReserve, handleOpenProductModal, handleDoubleClickProduct, handleDuplicateProduct, canCreateTmz, schet, typeDocumentByComeOut, documentType, stocks, allowNegativeStock, catalogMode, focusProduct?.id]);

  if (!isOpen) return <></>;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <ProductCatalogHeader
          onClose={onClose}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCreateNewProduct={canCreateTmz ? handleCreateNewProduct : undefined}
          catalogMode={catalogMode}
        />
        
        {/* Навигация по папкам - только для grid режима */}
        {viewMode === 'grid' && (
          <ProductCatalogNavigation
            folderPath={folderPath}
            onNavigateToFolder={navigateToBreadcrumb}
          />
        )}
        
        <ProductCatalogSearch
          articleValue={articleSearchQuery}
          nameValue={nameSearchQuery}
          onArticleChange={handleArticleSearchChange}
          onNameChange={handleNameSearchChange}
          shortNameFilterId={shortNameFilterId}
          sizeFilterId={sizeFilterId}
          colorFilterId={colorFilterId}
          manufactureFilterId={manufactureFilterId}
          onShortNameFilterChange={handleShortNameFilterChange}
          onSizeFilterChange={handleSizeFilterChange}
          onColorFilterChange={handleColorFilterChange}
          onManufactureFilterChange={handleManufactureFilterChange}
          referenceEnterpriseId={referenceEnterpriseId}
        />
        
        {/* Селектор количества элементов на странице */}
        {!loading && !error && displayItems.length > 0 && (viewMode === 'grid' || isFilterActive) && (
          <div className={styles.itemsPerPageSelector}>
            <label htmlFor="itemsPerPage">Товаров на странице:</label>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // Сбрасываем на первую страницу
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
            <div className={styles.loading}>
              <LoadingIco className={styles.loadingIco} />
              <span>Товарлар юкланмокда...</span>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <span>❌ Товарлар юкланишида хатолик</span>
              <button onClick={() => mutate()} className={styles.retryButton}>
                Кайта уриниш
              </button>
            </div>
          ) : (
            <div className={cn(styles.productList, {
              [styles.gridView]: viewMode === 'grid',
              [styles.listView]: viewMode === 'list'
            })}>
              {viewMode === 'grid' ? (
                // Grid режим - навигация по папкам, плоский список элементов текущей папки
                paginatedItems.map((product: Product) => renderGridItem(product))
              ) : isFilterActive ? (
                // List режим с поиском - плоский список найденных товаров
                paginatedItems.map((product: Product) => renderListItem(product))
              ) : (
                // List режим без поиска - иерархическое дерево (без пагинации для дерева)
                treeData.map(node => renderTreeNode(node))
              )}
            </div>
          )}
          
          {!loading && !error && (
            (viewMode === 'grid' ? displayItems.length === 0 : 
             isFilterActive ? displayItems.length === 0 : treeData.length === 0)
          ) && (
            <div className={styles.emptyState}>
              <span>
                {isFilterActive ? 'Товарлар топилмади' : viewMode === 'grid' ? 'Папка пуста' : 'Нет товаров'}
              </span>
            </div>
          )}
          
          {/* Пагинация - показываем только для grid режима и поиска */}
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
      
      {/* Модальное окно товара */}
      {selectedProduct && (
        <ProductModal
          isOpen={isProductModalOpen}
          product={selectedProduct}
          stockData={getStock(schet, `${actualWarehouseId}:${selectedProduct.id}`) || undefined}
          onClose={handleCloseProductModal}
          onAddToOrder={handleSelectWithReserve}
          typeDocumentByComeOut={typeDocumentByComeOut}
          documentType={documentType}
          documentDate={mainData.document.currentDocument?.date || documentDate}
          token={token}
          enterpriseId={referenceEnterpriseId ?? mainData.document.currentDocument?.enterpriseId ?? user?.enterpriseId}
          allowNegativeStock={allowNegativeStock}
          catalogMode={catalogMode}
          quantityFractionDigits={quantityFractionDigits}
        />
      )}
      
    </div>
  );
});

ProductCatalog.displayName = 'ProductCatalog';

export default ProductCatalog;