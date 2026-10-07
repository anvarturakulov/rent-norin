import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ReferenceUpdate {
  type: 'update' | 'create' | 'delete';
  reference: {
    id: number;
    name: string;
    typeReference: string;
    enterpriseId: number | null;
    parentId?: number | null;
    isFolder?: boolean;
    refValues: {
      typePartners?: string;
      typeTMZ?: string;
      typeSection?: string;
    } | null;
  };
  timestamp: number;
}

interface UseReferencesWebSocketProps {
  onReferenceUpdate?: (update: ReferenceUpdate) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export const useReferencesWebSocket = ({
  onReferenceUpdate,
  onConnectionChange
}: UseReferencesWebSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const isInitializedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Используем refs для callback'ов, чтобы избежать пересоздания функций
  const onReferenceUpdateRef = useRef(onReferenceUpdate);
  const onConnectionChangeRef = useRef(onConnectionChange);
  
  // Обновляем refs при изменении callback'ов
  useEffect(() => {
    onReferenceUpdateRef.current = onReferenceUpdate;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onReferenceUpdate, onConnectionChange]);

  const connect = useCallback(() => {
    // Проверяем, что соединение еще не установлено
    if (socketRef.current?.connected) {
      console.log('⚠️ WebSocket для справочников уже подключен');
      return;
    }
    
    // Проверяем, что мы не создаем повторное соединение
    if (socketRef.current && !socketRef.current.connected) {
      console.log('⚠️ Используем существующее WebSocket соединение для справочников');
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
    
    console.log('🔄 Попытка подключения к WebSocket для справочников на ', wsUrl);
    
    socketRef.current = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      forceNew: false,
      upgrade: true,
      rememberUpgrade: true,
      secure: process.env.NEXT_PUBLIC_DOMAIN?.startsWith('https'),
      rejectUnauthorized: false,
    });

    socketRef.current.on('connect', () => {
      console.log('✅ WebSocket для справочников подключен успешно');
      isConnectedRef.current = true;
      setConnected(true);
      onConnectionChangeRef.current?.(true);
      
      // Очищаем таймауты переподключения
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ WebSocket для справочников отключен:', reason);
      isConnectedRef.current = false;
      setConnected(false);
      onConnectionChangeRef.current?.(false);
      
      // Если отключение не было инициировано пользователем, планируем переподключение
      if (reason !== 'io client disconnect') {
        scheduleReconnect();
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket для справочников:', error);
      scheduleReconnect();
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket для справочников переподключен после попытки:', attemptNumber);
      isConnectedRef.current = true;
      setConnected(true);
      onConnectionChangeRef.current?.(true);
    });

    socketRef.current.on('reconnect_error', (error) => {
      console.error('❌ Ошибка переподключения WebSocket для справочников:', error);
    });

    socketRef.current.on('reconnect_failed', () => {
      console.error('❌ WebSocket для справочников не удалось переподключиться');
      // Пробуем принудительное переподключение
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current.connect();
        }
      }, 5000);
    });

    // Слушаем обновления справочников
    socketRef.current.on('referenceUpdate', (update: ReferenceUpdate) => {
      console.log('📋 Получено обновление справочника:', update);
      onReferenceUpdateRef.current?.(update);
    });

    socketRef.current.on('error', (error) => {
      console.error('❌ WebSocket ошибка для справочников:', error);
    });
  }, []); // Убираем зависимости, используем refs

  // Планирование переподключения
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      return; // Уже запланировано
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (socketRef.current && !socketRef.current.connected) {
        console.log('🔄 Попытка переподключения WebSocket для справочников...');
        socketRef.current.connect();
      }
    }, 3000);
  }, []);

  // Отключение
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Закрываем WebSocket соединение для справочников');
      socketRef.current.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
      setConnected(false);
      onConnectionChangeRef.current?.(false);
    }
    
    // Очищаем таймаут переподключения
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []); // Убираем зависимости, используем ref

  // Подключение при монтировании (только один раз)
  useEffect(() => {
    // Проверяем, что мы не инициализированы
    if (!isInitializedRef.current) {
      console.log('🔌 Инициализируем WebSocket соединение для справочников');
      isInitializedRef.current = true;
      connect();
    }

    // Очистка при размонтировании
    return () => {
      console.log('🧹 Размонтирование useReferencesWebSocket');
      disconnect();
    };
  }, []); // Пустой массив - выполняется только при монтировании/размонтировании

  return {
    connected,
    connect,
    disconnect,
  };
};

