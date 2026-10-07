import { useEffect, useRef, ReactNode, useCallback } from 'react';

interface VisibilityObserverProps {
  schet: string;
  itemId: string;
  onVisible: () => void;
  onHidden: () => void;
  children: ReactNode;
  threshold?: number;
}

export const VisibilityObserver = ({
  schet,
  itemId,
  onVisible,
  onHidden,
  children,
  threshold = 0.1
}: VisibilityObserverProps) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const onVisibleRef = useRef(onVisible);
  const onHiddenRef = useRef(onHidden);
  
  // Дебаунс для оптимизации производительности
  const visibleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hiddenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);

  // Обновляем ref-ы коллбеков без пересоздания наблюдателя
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  // Оптимизированные коллбеки с улучшенным дебаунсом
  const handleVisible = useCallback(() => {
    if (isVisibleRef.current) return; // Уже видимый
    
    // Очищаем предыдущий таймер
    if (hiddenTimeoutRef.current) {
      clearTimeout(hiddenTimeoutRef.current);
      hiddenTimeoutRef.current = null;
    }
    
    // Увеличиваем дебаунс для предотвращения зависаний
    visibleTimeoutRef.current = setTimeout(() => {
      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        // Используем requestAnimationFrame для плавности
        requestAnimationFrame(() => {
          onVisibleRef.current();
        });
      }
    }, 150); // Увеличили до 150мс
  }, []);

  const handleHidden = useCallback(() => {
    if (!isVisibleRef.current) return; // Уже скрытый
    
    // Очищаем предыдущий таймер
    if (visibleTimeoutRef.current) {
      clearTimeout(visibleTimeoutRef.current);
      visibleTimeoutRef.current = null;
    }
    
    // Увеличиваем дебаунс для скрытия
    hiddenTimeoutRef.current = setTimeout(() => {
      if (isVisibleRef.current) {
        isVisibleRef.current = false;
        // Используем requestAnimationFrame для плавности
        requestAnimationFrame(() => {
          onHiddenRef.current();
        });
      }
    }, 300); // Увеличили до 300мс
  }, []);

  useEffect(() => {
    if (!elementRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            handleVisible();
          } else {
            handleHidden();
          }
        });
      },
      {
        threshold,
        rootMargin: '100px' // Увеличили для более раннего срабатывания
      }
    );

    observerRef.current.observe(elementRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      
      // Очищаем таймеры при размонтировании
      if (visibleTimeoutRef.current) {
        clearTimeout(visibleTimeoutRef.current);
      }
      if (hiddenTimeoutRef.current) {
        clearTimeout(hiddenTimeoutRef.current);
      }
    };
  }, [threshold, itemId, schet, handleVisible, handleHidden]);

  return (
    <div ref={elementRef}>
      {children}
    </div>
  );
};
