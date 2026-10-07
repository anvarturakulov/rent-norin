'use client'
import React from 'react';
import { usePlatform } from '@/app/hooks/usePlatforms';

interface PlatformAdaptiveProps {
  children: React.ReactNode;
  telegramOnly?: boolean;
  browserOnly?: boolean;
  className?: string;
}

export const PlatformAdaptive: React.FC<PlatformAdaptiveProps> = ({
  children,
  telegramOnly = false,
  browserOnly = false,
  className = ''
}) => {
  const { isTelegram, isBrowser } = usePlatform();

  // Если компонент только для Telegram и мы не в Telegram - не показываем
  if (telegramOnly && !isTelegram) {
    return null;
  }

  // Если компонент только для браузера и мы не в браузере - не показываем
  if (browserOnly && !isBrowser) {
    return null;
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
};

// Компонент для кнопок, адаптированных под платформу
interface AdaptiveButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const AdaptiveButton: React.FC<AdaptiveButtonProps> = ({
  onClick,
  children,
  className = '',
  disabled = false
}) => {
  const { isTelegram, showMainButton, hideMainButton } = usePlatform();

  React.useEffect(() => {
    if (isTelegram) {
      // В Telegram используем главную кнопку
      showMainButton(children as string, onClick);
      
      return () => {
        hideMainButton();
      };
    }
  }, [isTelegram, children, onClick, showMainButton, hideMainButton]);

  // В браузере показываем обычную кнопку
  if (!isTelegram) {
    return (
      <button 
        onClick={onClick} 
        className={className}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }

  // В Telegram кнопка управляется через Telegram Web App API
  return null;
};

// Компонент для навигации
interface AdaptiveNavigationProps {
  onBack?: () => void;
  title?: string;
  children?: React.ReactNode;
}

export const AdaptiveNavigation: React.FC<AdaptiveNavigationProps> = ({
  onBack,
  title,
  children
}) => {
  const { isTelegram, showBackButton, hideBackButton, setHeaderColor } = usePlatform();

  React.useEffect(() => {
    if (isTelegram) {
      // Настраиваем заголовок и кнопку "Назад" в Telegram
      if (onBack) {
        showBackButton(onBack);
      } else {
        hideBackButton();
      }

      // Устанавливаем цвет заголовка
      setHeaderColor('#0088cc');

      return () => {
        hideBackButton();
      };
    }
  }, [isTelegram, onBack, showBackButton, hideBackButton, setHeaderColor]);

  // В браузере показываем обычную навигацию
  if (!isTelegram) {
    return (
      <div style={{ 
        padding: '10px', 
        borderBottom: '1px solid #ccc',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {onBack && (
          <button onClick={onBack} style={{ padding: '5px 10px' }}>
            ← Назад
          </button>
        )}
        {title && <h2>{title}</h2>}
        {children}
      </div>
    );
  }

  // В Telegram навигация управляется через Telegram Web App API
  return null;
};

// Компонент для уведомлений
interface AdaptiveAlertProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export const AdaptiveAlert: React.FC<AdaptiveAlertProps> = ({
  message,
  type = 'info'
}) => {
  const { isTelegram, showAlert } = usePlatform();

  const handleShowAlert = () => {
    if (isTelegram) {
      showAlert(message);
    } else {
      // В браузере показываем обычное уведомление
      alert(message);
    }
  };

  React.useEffect(() => {
    handleShowAlert();
  }, [message]);

  return null;
};