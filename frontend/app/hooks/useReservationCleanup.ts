import { useEffect, useRef, useCallback } from 'react';

interface ReservationItem {
  schet: string;
  itemId: string;
  quantity: number;
  firstSubcontoId?: number;
  timestamp: number;
}

interface UseReservationCleanupProps {
  agentId: string;
  releaseReservation: (schet: string, itemId: string, quantity: number, firstSubcontoId?: number) => void;
  isConnected: boolean;
}

export const useReservationCleanup = ({
  agentId,
  releaseReservation,
  isConnected
}: UseReservationCleanupProps) => {
  const reservationsRef = useRef<Map<string, ReservationItem>>(new Map());
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Добавить резерв для отслеживания
  const trackReservation = useCallback((
    schet: string,
    itemId: string,
    quantity: number,
    firstSubcontoId?: number
  ) => {
    const key = `${schet}:${itemId}`;
    reservationsRef.current.set(key, {
      schet,
      itemId,
      quantity,
      firstSubcontoId,
      timestamp: Date.now()
    });
    console.log(`📝 Отслеживаем резерв: ${key} (количество: ${quantity})`);
  }, []);

  // Удалить резерв из отслеживания (когда товар добавлен в документ)
  const untrackReservation = useCallback((schet: string, itemId: string) => {
    const key = `${schet}:${itemId}`;
    const removed = reservationsRef.current.delete(key);
    if (removed) {
      console.log(`✅ Резерв успешно использован: ${key}`);
    }
  }, []);

  // Очистить все резервы
  const clearAllReservations = useCallback(async () => {
    if (!isConnected) {
      console.warn('❌ WebSocket не подключен для очистки резервов');
      return;
    }

    const reservations = Array.from(reservationsRef.current.values());
    
    if (reservations.length === 0) {
      console.log('✅ Нет резервов для очистки');
      return;
    }

    console.log(`🧹 Очищаем ${reservations.length} резервов для агента ${agentId}`);

    for (const reservation of reservations) {
      try {
        await new Promise<void>((resolve) => {
          releaseReservation(
            reservation.schet,
            reservation.itemId,
            reservation.quantity,
            reservation.firstSubcontoId
          );
          // Даем небольшую задержку между запросами
          setTimeout(resolve, 100);
        });
        console.log(`✅ Резерв освобожден: ${reservation.schet}:${reservation.itemId}`);
      } catch (error) {
        console.error(`❌ Ошибка при освобождении резерва ${reservation.schet}:${reservation.itemId}:`, error);
      }
    }

    // Очищаем локальный список
    reservationsRef.current.clear();
    console.log('🧹 Все резервы очищены');
  }, [agentId, releaseReservation, isConnected]);

  // Автоматическая очистка устаревших резервов (старше 30 минут)
  const cleanupExpiredReservations = useCallback(() => {
    if (!isConnected) return;

    const now = Date.now();
    const expiredTime = 30 * 60 * 1000; // 30 минут в миллисекундах
    const expiredKeys: string[] = [];

    reservationsRef.current.forEach((reservation, key) => {
      if (now - reservation.timestamp > expiredTime) {
        expiredKeys.push(key);
        // Освобождаем устаревший резерв
        releaseReservation(
          reservation.schet,
          reservation.itemId,
          reservation.quantity,
          reservation.firstSubcontoId
        );
      }
    });

    // Удаляем устаревшие записи
    expiredKeys.forEach(key => {
      reservationsRef.current.delete(key);
      console.log(`⏰ Автоочистка устаревшего резерва: ${key}`);
    });

    if (expiredKeys.length > 0) {
      console.log(`⏰ Автоматически очищено ${expiredKeys.length} устаревших резервов`);
    }
  }, [releaseReservation, isConnected]);

  // Запускаем периодическую очистку
  useEffect(() => {
    // Очистка каждые 5 минут
    cleanupTimerRef.current = setInterval(cleanupExpiredReservations, 5 * 60 * 1000);
    
    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
      }
    };
  }, [cleanupExpiredReservations]);

  // Очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      clearAllReservations();
    };
  }, [clearAllReservations]);

  // Очистка при событиях браузера (закрытие вкладки, перезагрузка)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Синхронная очистка при закрытии страницы
      const reservations = Array.from(reservationsRef.current.values());
      if (reservations.length > 0 && isConnected) {
        // Отправляем запрос на очистку всех резервов агента
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_DOMAIN}/api/cleanup-reservations/document`, 
          JSON.stringify({ agentId })
        );
        console.log(`🧹 Отправлен beacon для очистки резервов документа агента ${agentId}`);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Страница скрыта - очищаем резервы
        clearAllReservations();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [agentId, clearAllReservations, isConnected]);

  return {
    trackReservation,
    untrackReservation,
    clearAllReservations,
    getReservationsCount: () => reservationsRef.current.size
  };
};
