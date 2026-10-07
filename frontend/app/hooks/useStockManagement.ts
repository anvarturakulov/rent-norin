import { useState, useCallback, useRef } from 'react';
import { StockData } from '@/app/interfaces/product.interface';
import { getStockByItem } from '@/app/service/stocks/getStockByItem';

interface StockState {
  [schet: string]: {
    [itemId: string]: StockData;
  };
}


export const useStockManagement = () => {
  const [stocks, setStocks] = useState<StockState>({});
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const subscriptionsRef = useRef<Map<string, Set<string>>>(new Map());
  const lastLogTimeRef = useRef<Record<string, number>>({});
  // Кеш для запросов к REST API (чтобы не делать повторные запросы)
  const stockCacheRef = useRef<Map<string, { data: StockData | null; timestamp: number }>>(new Map());
  const pendingRequestsRef = useRef<Map<string, Promise<StockData | null>>>(new Map());

  const updateStocks = useCallback((update: {
    type: 'initial' | 'update';
    stocks: StockState;
  }) => {
    console.log(`📥 updateStocks получено обновление:`, {
      type: update.type,
      schets: Object.keys(update.stocks),
      totalItems: Object.values(update.stocks).reduce((sum, schetStocks) => sum + Object.keys(schetStocks).length, 0),
      itemsBySchet: Object.entries(update.stocks).reduce((acc, [schet, schetStocks]) => {
        acc[schet] = Object.keys(schetStocks).slice(0, 10); // первые 10 ключей для диагностики
        return acc;
      }, {} as Record<string, string[]>)
    });
    
    setStocks(prevStocks => {
      const newStocks = { ...prevStocks };
      
      Object.entries(update.stocks).forEach(([schet, schetStocks]) => {
        if (!newStocks[schet]) {
          newStocks[schet] = {};
        }
        
        Object.entries(schetStocks).forEach(([itemId, stockData]) => {
          // Логируем первые несколько обновлений для диагностики
          if (Object.keys(schetStocks).indexOf(itemId) < 3) {
            console.log(`📊 updateStocks: обновляем остаток для ${schet}:${itemId}:`, {
              totalQuantity: stockData.totalQuantity,
              availableQuantity: stockData.availableQuantity,
              remainCount: (stockData as any).remainCount // может быть в данных
            });
          }
          newStocks[schet][itemId] = stockData;
        });
      });
      
      return newStocks;
    });
  }, []);

  // getStock теперь возвращает данные из локального состояния (если есть) или null
  // Для получения остатков из БД нужно использовать getStockByItem напрямую
  const getStock = useCallback((schet: string, itemId: string): StockData | null => {
    // Проверяем прямое попадание по полному ключу (warehouseId:productId)
    const directKey = stocks[schet]?.[itemId];
    if (directKey) {
      return directKey;
    }
    
    // Если данных нет в локальном состоянии, возвращаем null
    // Компоненты должны использовать getStockByItem для получения остатков из БД
    return null;
  }, [stocks]);

  const addVisibleItem = useCallback((schet: string, itemId: string) => {
    const key = `${schet}:${itemId}`;
    setVisibleItems(prev => {
      if (prev.has(key)) {
        return prev;
      }
      // Дебаунс логирования для предотвращения спама
      const now = Date.now();
      if (!lastLogTimeRef.current[key] || now - lastLogTimeRef.current[key] > 1000) {
        console.log('👁️ Добавляем видимый элемент:', key);
        lastLogTimeRef.current[key] = now;
      }
      
      const newSet = new Set(prev);
      newSet.add(key);
      return newSet;
    });
  }, []);

  const removeVisibleItem = useCallback((schet: string, itemId: string) => {
    const key = `${schet}:${itemId}`;
    setVisibleItems(prev => {
      if (!prev.has(key)) {
        return prev;
      }
      // Дебаунс логирования для предотвращения спама
      const now = Date.now();
      if (!lastLogTimeRef.current[key] || now - lastLogTimeRef.current[key] > 1000) {
        console.log('👁️ Удаляем видимый элемент:', key);
        lastLogTimeRef.current[key] = now;
      }
      
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  }, []);

  const getVisibleSubscriptions = useCallback((warehouseId:any, targetDate?: number, enterpriseId?: number) => {
    const subscriptions: Array<{
      schet: string;
      itemIds: string[];
      firstSubcontoId: number;
      targetDate?: number;
      enterpriseId?: number;
    }> = [];
    const schetGroups = new Map<string, Set<string>>();

    visibleItems.forEach(key => {
      const firstColonIndex = key.indexOf(':');
      if (firstColonIndex <= 0) return; // некорректный ключ
      const schet = key.slice(0, firstColonIndex);
      const fullItemId = key.slice(firstColonIndex + 1); // может содержать дополнительные двоеточия

      if (!schetGroups.has(schet)) {
        schetGroups.set(schet, new Set());
      }
      // Для счетов с двумя субконто (например, S29) backend ожидает itemId в формате "warehouseId:productId"
      schetGroups.get(schet)!.add(fullItemId);
    });

    schetGroups.forEach((itemIds, schet) => {
      subscriptions.push({
        schet,
        itemIds: Array.from(itemIds),
        firstSubcontoId: warehouseId, // Используем константу для кода склада
        targetDate: targetDate,
        enterpriseId: enterpriseId
      });
    });

    return subscriptions;
  }, [visibleItems]);

  const clearVisibleItems = useCallback(() => {
    setVisibleItems(new Set());
  }, []);

  const clearStocks = useCallback(() => {
    setStocks({});
  }, []);

  return {
    stocks,
    updateStocks,
    getStock,
    addVisibleItem,
    removeVisibleItem,
    getVisibleSubscriptions,
    clearVisibleItems,
    clearStocks,
    visibleItems
  };
};
