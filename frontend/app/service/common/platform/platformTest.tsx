'use client'
import React, { useState } from 'react';
import { usePlatform } from '@/app/hooks/usePlatforms';
import { PlatformAdaptive, AdaptiveButton, AdaptiveNavigation } from './platformAdaptive';


export const PlatformTest: React.FC = () => {
  const { 
    isTelegram, 
    isBrowser, 
    platformType, 
    telegramWebApp,
    getTelegramUser,
    getTelegramChat,
    sendDataToTelegram,
    setHeaderColor,
    setBackgroundColor,
    showAlert,
    showConfirm
  } = usePlatform();

  const [testMessage, setTestMessage] = useState('');

  const handleTestAlert = () => {
    showAlert('Это тестовое уведомление!');
  };

  const handleTestConfirm = () => {
    showConfirm('Вы уверены, что хотите выполнить тестовое действие?', (confirmed) => {
      if (confirmed) {
        showAlert('Действие подтверждено!');
      } else {
        showAlert('Действие отменено!');
      }
    });
  };

  const handleSendData = () => {
    const data = {
      action: 'test',
      message: testMessage,
      timestamp: new Date().toISOString(),
      platform: platformType
    };
    sendDataToTelegram(JSON.stringify(data));
    showAlert('Данные отправлены в Telegram!');
  };

  const handleSetTheme = () => {
    setHeaderColor('#ff6b6b');
    setBackgroundColor('#f8f9fa');
    showAlert('Тема изменена!');
  };

  const telegramUser = getTelegramUser();
  const telegramChat = getTelegramChat();

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Тест определения платформы</h2>
      
      {/* Основная информация */}
      <div style={{ 
        padding: '15px', 
        margin: '15px 0', 
        backgroundColor: isTelegram ? '#0088cc' : '#f0f0f0', 
        color: isTelegram ? 'white' : 'black',
        borderRadius: '8px'
      }}>
        <h3>Информация о платформе</h3>
        <p><strong>Тип платформы:</strong> {platformType}</p>
        <p><strong>Telegram:</strong> {isTelegram ? 'Да' : 'Нет'}</p>
        <p><strong>Браузер:</strong> {isBrowser ? 'Да' : 'Нет'}</p>
        <p><strong>User Agent:</strong> {navigator.userAgent.substring(0, 100)}...</p>
      </div>

      {/* Информация о Telegram пользователе */}
      <PlatformAdaptive telegramOnly>
        <div style={{ 
          padding: '15px', 
          margin: '15px 0', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '8px',
          border: '1px solid #2196f3'
        }}>
          <h3>Информация о Telegram пользователе</h3>
          {telegramUser ? (
            <div>
              <p><strong>ID:</strong> {telegramUser.id}</p>
              <p><strong>Имя:</strong> {telegramUser.first_name} {telegramUser.last_name || ''}</p>
              <p><strong>Username:</strong> {telegramUser.username || 'Не указан'}</p>
              <p><strong>Язык:</strong> {telegramUser.language_code || 'Не указан'}</p>
            </div>
          ) : (
            <p>Информация о пользователе недоступна</p>
          )}
          
          {telegramChat && (
            <div style={{ marginTop: '10px' }}>
              <h4>Информация о чате</h4>
              <p><strong>ID чата:</strong> {telegramChat.id}</p>
              <p><strong>Тип:</strong> {telegramChat.type}</p>
              <p><strong>Название:</strong> {telegramChat.title || 'Не указано'}</p>
            </div>
          )}
        </div>
      </PlatformAdaptive>

      {/* Тестовые кнопки */}
      <div style={{ margin: '20px 0' }}>
        <h3>Тестовые функции</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <AdaptiveButton onClick={handleTestAlert} className="test-button">
            Показать уведомление
          </AdaptiveButton>
          
          <AdaptiveButton onClick={handleTestConfirm} className="test-button">
            Показать подтверждение
          </AdaptiveButton>
          
          <PlatformAdaptive telegramOnly>
            <AdaptiveButton onClick={handleSetTheme} className="test-button">
              Изменить тему
            </AdaptiveButton>
          </PlatformAdaptive>
        </div>
      </div>

      {/* Отправка данных в Telegram */}
      <PlatformAdaptive telegramOnly>
        <div style={{ margin: '20px 0' }}>
          <h3>Отправка данных в Telegram</h3>
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Введите сообщение для отправки"
            style={{ 
              width: '100%', 
              padding: '10px', 
              marginBottom: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
          <AdaptiveButton 
            onClick={handleSendData} 
            className="test-button"
            disabled={!testMessage.trim()}
          >
            Отправить данные
          </AdaptiveButton>
        </div>
      </PlatformAdaptive>

      {/* Адаптивная навигация */}
      <div style={{ margin: '20px 0' }}>
        <AdaptiveNavigation 
          title="Тестовая страница"
          onBack={() => showAlert('Нажата кнопка "Назад"')}
        >
          <p>Это тестовая страница с адаптивной навигацией</p>
        </AdaptiveNavigation>
      </div>

      {/* Информация о Telegram Web App API */}
      <PlatformAdaptive telegramOnly>
        <div style={{ 
          padding: '15px', 
          margin: '15px 0', 
          backgroundColor: '#fff3e0', 
          borderRadius: '8px',
          border: '1px solid #ff9800'
        }}>
          <h3>Telegram Web App API</h3>
          {telegramWebApp ? (
            <div>
              <p><strong>Версия:</strong> {telegramWebApp.version}</p>
              <p><strong>Платформа:</strong> {telegramWebApp.platform}</p>
              <p><strong>Цветовая схема:</strong> {telegramWebApp.colorScheme}</p>
              <p><strong>Высота viewport:</strong> {telegramWebApp.viewportHeight}px</p>
              <p><strong>Стабильная высота viewport:</strong> {telegramWebApp.viewportStableHeight}px</p>
              <p><strong>Расширен:</strong> {telegramWebApp.isExpanded ? 'Да' : 'Нет'}</p>
              <p><strong>Подтверждение закрытия:</strong> {telegramWebApp.isClosingConfirmationEnabled ? 'Включено' : 'Отключено'}</p>
            </div>
          ) : (
            <p>Telegram Web App API недоступен</p>
          )}
        </div>
      </PlatformAdaptive>

      {/* Стили для кнопок */}
      <style jsx>{`
        .test-button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          background-color: #007bff;
          color: white;
          cursor: pointer;
          font-size: 14px;
        }
        
        .test-button:hover {
          background-color: #0056b3;
        }
        
        .test-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};