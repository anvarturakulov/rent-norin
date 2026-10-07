import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { StockData, StockUpdate } from '@/app/interfaces/product.interface';

interface UseStockWebSocketProps {
  agentId: string;
  onStockUpdate: (update: StockUpdate) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export const useStockWebSocket = ({
  agentId,
  onStockUpdate,
  onConnectionChange
}: UseStockWebSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const isInitializedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Используем refs для callback'ов, чтобы избежать пересоздания функций
  const onStockUpdateRef = useRef(onStockUpdate);
  const onConnectionChangeRef = useRef(onConnectionChange);
  
  // Обновляем refs при изменении callback'ов
  useEffect(() => {
    onStockUpdateRef.current = onStockUpdate;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onStockUpdate, onConnectionChange]);

  const connect = useCallback(() => {
    // Проверяем, что соединение еще не установлено
    if (socketRef.current?.connected) {
      console.log('⚠️ WebSocket уже подключен');
      return;
    }
    
    // Проверяем, что мы не создаем повторное соединение
    if (socketRef.current && !socketRef.current.connected) {
      console.log('⚠️ Используем существующее WebSocket соединение');
      socketRef.current.connect();
      return;
    }
    
    // Определяем URL для WebSocket подключения
    let wsUrl: string;
    
    if (typeof window !== 'undefined') {
      // В браузере - используем текущий хост с портом backend
      const currentHost = window.location.hostname;
      if (currentHost === 'jbi7-turon.osondastur.uz') {
        // В продакшене - используем тот же домен (nginx должен проксировать)
        wsUrl = `https://${currentHost}`;
      } else {
        // В разработке - используем localhost:5009
        wsUrl = 'http://localhost:5009';
      }
    } else {
      // На сервере - используем переменную окружения или fallback
      wsUrl = process.env.NEXT_PUBLIC_DOMAIN || 'http://localhost:5009';
    }
    
    console.log('🔄 Попытка подключения к WebSocket на ', wsUrl);
    
    socketRef.current = io(wsUrl, {
      transports: ['websocket', 'polling'], // Сначала WebSocket, потом polling как fallback
      autoConnect: true,
      timeout: 20000, // Увеличили timeout
      reconnection: true,
      reconnectionAttempts: 5, // Увеличили количество попыток
      reconnectionDelay: 1000, // Уменьшили задержку для быстрого переподключения
      reconnectionDelayMax: 5000,
      forceNew: false,
      upgrade: true, // Позволяем upgrade на WebSocket если возможно
      rememberUpgrade: true,
      secure: process.env.NEXT_PUBLIC_DOMAIN?.startsWith('https'),
      rejectUnauthorized: false, // Для самоподписанных сертификатов
    });

    socketRef.current.on('connect', () => {
      console.log('✅ WebSocket подключен успешно');
      isConnectedRef.current = true;
      setConnected(true);
      onConnectionChangeRef.current?.(true);
      
      // Очищаем таймауты переподключения
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Запускаем проверку здоровья соединения
      startHealthCheck();
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ WebSocket отключен:', reason);
      isConnectedRef.current = false;
      setConnected(false);
      onConnectionChangeRef.current?.(false);
      
      // Останавливаем проверку здоровья
      stopHealthCheck();
      
      // Если отключение не было инициировано пользователем, планируем переподключение
      if (reason !== 'io client disconnect') {
        scheduleReconnect();
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket:', error);
      scheduleReconnect();
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket переподключен после попытки:', attemptNumber);
      isConnectedRef.current = true;
      setConnected(true);
      onConnectionChangeRef.current?.(true);
      startHealthCheck();
    });

    socketRef.current.on('reconnect_error', (error) => {
      console.error('❌ Ошибка переподключения WebSocket:', error);
    });

    socketRef.current.on('reconnect_failed', () => {
      console.error('❌ WebSocket не удалось переподключиться');
      // Пробуем принудительное переподключение
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current.connect();
        }
      }, 5000);
    });

    socketRef.current.on('stocksUpdate', (update: StockUpdate) => {
      console.log('📊 Получено обновление остатков:', update);
      onStockUpdateRef.current(update);
    });


    socketRef.current.on('error', (error) => {
      console.error('❌ WebSocket ошибка:', error);
    });

    socketRef.current.on('pong', () => {
      console.log('🏓 Получен pong от сервера');
    });
  }, []);

  // Планирование переподключения
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;
    
    console.log('🔄 Планируем переподключение через 3 секунды...');
    reconnectTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && !socketRef.current.connected) {
        console.log('🔄 Выполняем запланированное переподключение...');
        socketRef.current.connect();
      }
      reconnectTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Запуск проверки здоровья соединения
  const startHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) return;
    
    healthCheckIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping');
      }
    }, 30000); // Каждые 30 секунд
  }, []);

  // Остановка проверки здоровья
  const stopHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('🔌 Закрываем WebSocket соединение');
    stopHealthCheck();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []); // Убираем зависимости

  const subscribeToStocks = useCallback((subscriptions: Array<{
    schet: string;
    itemIds: string[];
    firstSubcontoId?: number;
    targetDate?: number;
    enterpriseId?: number;
  }>) => {
    if (!socketRef.current?.connected) {
      console.warn('⚠️ WebSocket не подключен, пропускаем подписку');
      return;
    }

    console.log('📡 Подписка на остатки:', subscriptions.map(sub => ({
      schet: sub.schet,
      itemIdsCount: sub.itemIds.length,
      firstSubcontoId: sub.firstSubcontoId,
      targetDate: sub.targetDate ? new Date(sub.targetDate).toISOString() : 'не указана',
      enterpriseId: sub.enterpriseId || 'не указан',
      firstItems: sub.itemIds.slice(0, 3)
    })));
    socketRef.current.emit('subscribeToStocks', {
      agentId,
      subscriptions
    });
  }, [agentId]);


  // Подключение при монтировании (только один раз)
  useEffect(() => {
    // Проверяем, что мы не инициализированы
    if (!isInitializedRef.current) {
      console.log('🔌 Инициализируем глобальное WebSocket соединение');
      isInitializedRef.current = true;
      connect();
    }
    
    // Очистка при размонтировании
    return () => {
      console.log('🧹 Размонтирование useStockWebSocket');
      disconnect();
    };
  }, []); // Пустой массив - выполняется только при монтировании/размонтировании

  return {
    isConnected: connected,
    subscribeToStocks,
    connect,
    disconnect
  };
};
