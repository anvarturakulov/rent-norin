'use client'
/**
 * WebSocket Context с динамическим warehouseId
 * 
 * Изменения:
 * - Добавлен динамический warehouseId вместо хардкода 20094
 * - Приоритеты получения warehouseId:
 *   1. currentDocument.docValues.senderId (из текущего документа)
 *   2. mainData.users.user.sectionId (из пользователя)
 *   3. NEXT_PUBLIC_MAIN_STORAGE (из переменной окружения, по умолчанию 20094)
 * - Добавлено логирование для отслеживания изменений warehouseId
 * - Подписка на остатки автоматически обновляется при изменении warehouseId
 * - Добавлена подписка на обновления справочников через WebSocket
 */
import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
// УБРАНО: useStockWebSocket - остатки теперь получаются через REST API
// import { useStockWebSocket } from '@/app/hooks/useStockWebSocket';
import { useStockManagement } from '@/app/hooks/useStockManagement';
// WebSocket для справочников отключен
// import { useReferencesWebSocket, ReferenceUpdate } from '@/app/hooks/useReferencesWebSocket';
import { useAppContext } from '@/app/context/app.context';
import { mutate } from 'swr';

// Хелпер для получения значения MAIN_STORAGE из переменной окружения
const getMainStorageId = (): number => {
  // const mainStorage = process.env.NEXT_PUBLIC_MAIN_STORAGE;
  // if (mainStorage) {
  //   const parsed = parseInt(mainStorage);
  //   if (!isNaN(parsed)) {
  //     return parsed;
  //   }
  // }
  // Fallback значение, если переменная не установлена или некорректна
  return 20125;
};

interface WebSocketContextType {
  // WebSocket состояние
  isConnected: boolean;
  
  // WebSocket методы
  subscribeToStocks: (subscriptions: Array<{
    schet: string;
    itemIds: string[];
    firstSubcontoId?: number;
    targetDate?: number;
  }>) => void;
  
  // Stock Management методы
  updateStocks: (update: any) => void;
  getStock: (schet: string, itemId: string) => any;
  addVisibleItem: (schet: string, itemId: string) => void;
  removeVisibleItem: (schet: string, itemId: string) => void;
  getVisibleSubscriptions: (warehouseId?: number, targetDate?: number) => Array<{
    schet: string;
    itemIds: string[];
    firstSubcontoId: number;
    targetDate?: number;
  }>;
  clearVisibleItems: () => void;
  clearStocks: () => void;
  visibleItems: Set<string>;
  stocks: any;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider = ({ children }: WebSocketProviderProps) => {
  const [lastSubscriptionTime, setLastSubscriptionTime] = useState(0);
  const lastSubsSignatureRef = React.useRef<string>('');
  const isInitializedRef = React.useRef(false);
  
  // Добавляем доступ к контексту приложения
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  
  // Инициализация MAIN_STORAGE
  useEffect(() => {
    getMainStorageId();
  }, []);
  
  // Управление состоянием остатков
  const {
    stocks,
    updateStocks,
    getStock,
    addVisibleItem,
    removeVisibleItem,
    getVisibleSubscriptions,
    clearVisibleItems,
    clearStocks,
    visibleItems
  } = useStockManagement();

  // УБРАНО: WebSocket соединение для остатков
  // Теперь остатки получаются через REST API при выборе товара
  // const {
  //   isConnected,
  //   subscribeToStocks,
  //   connect,
  //   disconnect
  // } = useStockWebSocket({
  //   agentId: 'global-app',
  //   onStockUpdate: updateStocks,
  //   onConnectionChange: (connected) => {
  //     // WebSocket connection status changed
  //   }
  // });
  
  // Заглушки для обратной совместимости
  const isConnected = false;
  const subscribeToStocks = () => {}; // Пустая функция
  const connect = () => {}; // Пустая функция
  const disconnect = () => {}; // Пустая функция

  // Функция для получения warehouseId с приоритетами
  const getWarehouseId = useCallback(() => {
    // Приоритет 1: из текущего документа (senderId)
    if (currentDocument?.docValues?.senderId) {
      return currentDocument.docValues.senderId;
    }
    
    // Приоритет 2: из пользователя (если есть sectionId)
    if (mainData.users.user?.sectionId) {
      return mainData.users.user.sectionId;
    }
    
    // Приоритет 3: значение из переменной окружения MAIN_STORAGE
    return getMainStorageId();
  }, [currentDocument?.docValues?.senderId, mainData.users.user?.sectionId]);

  // УБРАНО: Автоматическое подключение WebSocket для остатков
  // Теперь остатки получаются через REST API
  // useEffect(() => {
  //   if (!isInitializedRef.current) {
  //     isInitializedRef.current = true;
  //     connect();
  //   }
  //   
  //   return () => {
  //     disconnect();
  //   };
  // }, []);

  // УБРАНО: Автоматическая подписка на остатки через WebSocket
  // Теперь остатки получаются через REST API при выборе товара
  // useEffect(() => {
  //   if (!isConnected) return;
  //   
  //   const now = Date.now();
  //   if (now - lastSubscriptionTime < 500) return;
  //   
  //   const warehouseId = getWarehouseId();
  //   const documentDate = currentDocument?.date;
  //   const enterpriseId = mainData.users.user?.enterpriseId ?? undefined;
  //   const subs = getVisibleSubscriptions(warehouseId, documentDate, enterpriseId);
  //   
  //   if (subs.length > 0) {
  //     const signature = subs
  //       .map(s => `${s.schet}|${s.firstSubcontoId}|${s.targetDate || 'current'}|${[...s.itemIds].sort().join(',')}`)
  //       .sort()
  //       .join('||');
  //     
  //     if (signature === lastSubsSignatureRef.current) return;
  //     
  //     lastSubsSignatureRef.current = signature;
  //     subscribeToStocks(subs);
  //     setLastSubscriptionTime(now);
  //   }
  // }, [isConnected, visibleItems.size, lastSubscriptionTime, getWarehouseId, currentDocument?.date, getVisibleSubscriptions, subscribeToStocks]);

  // Обновления справочников через WebSocket отключены — они будут обновляться при запросах REST

  const contextValue: WebSocketContextType = {
    isConnected,
    subscribeToStocks,
    updateStocks,
    getStock,
    addVisibleItem,
    removeVisibleItem,
    getVisibleSubscriptions,
    clearVisibleItems,
    clearStocks,
    visibleItems,
    stocks
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};

// Хук для удобного доступа к WebSocket функциональности
export const useGlobalWebSocket = () => {
  const context = useWebSocketContext();
  
  return {
    isConnected: context.isConnected,
    subscribeToStocks: context.subscribeToStocks
  };
};

// Хук для удобного доступа к управлению остатками
export const useGlobalStockManagement = () => {
  const context = useWebSocketContext();
  
  return {
    stocks: context.stocks,
    updateStocks: context.updateStocks,
    getStock: context.getStock,
    addVisibleItem: context.addVisibleItem,
    removeVisibleItem: context.removeVisibleItem,
    getVisibleSubscriptions: context.getVisibleSubscriptions,
    clearVisibleItems: context.clearVisibleItems,
    clearStocks: context.clearStocks,
    visibleItems: context.visibleItems
  };
};

// Хук для глобальной очистки резервов (используется при переключении между документами/страницами)
export const useGlobalReservationCleanup = () => {
  const clearAllGlobalReservations = useCallback(() => {
    // Заглушка для очистки резервов
    // В будущем здесь можно добавить реальную логику очистки через API
    // Пока просто логируем действие без отправки запросов
  }, []);

  return {
    clearAllGlobalReservations
  };
};

