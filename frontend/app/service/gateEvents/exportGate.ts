import axios from 'axios';
import { showMessage } from '../common/showMessage';

export interface ExportMeta {
  exportId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  chunksCount: number;
  expiresAt: number;
}

/**
 * Инициализирует экспорт папки uploads/gate
 * @param token - JWT токен пользователя
 * @returns Результат инициализации экспорта
 */
export const initGateExport = async (token: string | undefined): Promise<{ exportId: string; fileName: string; status: 'processing' }> => {
  if (!token) {
    throw new Error('Токен не предоставлен');
  }

  const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/gate-events/export-gate/init`;
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  try {
    const response = await axios.post(url, {}, config);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Ошибка при инициализации экспорта';
    throw new Error(errorMessage);
  }
};

/**
 * Скачивает одну часть экспорта
 * @param exportId - ID экспорта
 * @param partNumber - Номер части (начинается с 1)
 * @param token - JWT токен пользователя
 * @returns Blob с данными части
 */
export const downloadExportPart = async (
  exportId: string,
  partNumber: number,
  token: string | undefined
): Promise<Blob> => {
  if (!token) {
    throw new Error('Токен не предоставлен');
  }

  const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/gate-events/export-gate/${exportId}/part/${partNumber}`;
  const config = {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob' as const
  };

  try {
    const response = await axios.get(url, config);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || `Ошибка при скачивании части ${partNumber}`;
    throw new Error(errorMessage);
  }
};

/**
 * Получает статус экспорта
 * @param exportId - ID экспорта
 * @param token - JWT токен пользователя
 * @returns Статус экспорта или метаданные если готов
 */
export const getExportStatus = async (
  exportId: string,
  token: string | undefined
): Promise<{ status: 'processing' | 'ready' | 'not_found' | 'expired' } & Partial<ExportMeta>> => {
  if (!token) {
    throw new Error('Токен не предоставлен');
  }

  const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/gate-events/export-gate/${exportId}/status`;
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  try {
    const response = await axios.get(url, config);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { status: 'not_found' };
    }
    if (error.response?.status === 410) {
      return { status: 'expired' };
    }
    const errorMessage = error.response?.data?.message || error.message || 'Ошибка при получении статуса экспорта';
    throw new Error(errorMessage);
  }
};

/**
 * Скачивает весь экспорт частями и склеивает в один файл
 * @param exportId - ID экспорта
 * @param chunksCount - Количество частей
 * @param fileName - Имя итогового файла
 * @param token - JWT токен пользователя
 * @param onProgress - Callback для отслеживания прогресса (partNumber, totalParts)
 * @returns Promise, который разрешается когда файл скачан
 */
export const downloadFullExport = async (
  exportId: string,
  chunksCount: number,
  fileName: string,
  token: string | undefined,
  onProgress?: (partNumber: number, totalParts: number) => void
): Promise<void> => {
  if (!token) {
    throw new Error('Токен не предоставлен');
  }

  const parts: Blob[] = [];

  try {
    // Скачиваем все части последовательно
    for (let partNumber = 1; partNumber <= chunksCount; partNumber++) {
      if (onProgress) {
        onProgress(partNumber, chunksCount);
      }

      const blob = await downloadExportPart(exportId, partNumber, token);
      parts.push(blob);
    }

    // Склеиваем все части в один Blob
    const fullBlob = new Blob(parts, { type: 'application/zip' });

    // Создаем ссылку для скачивания
    const url = window.URL.createObjectURL(fullBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    throw new Error(`Ошибка при скачивании экспорта: ${error.message}`);
  }
};

/**
 * Ожидает готовности экспорта, периодически проверяя статус
 * @param exportId - ID экспорта
 * @param token - JWT токен пользователя
 * @param onProgress - Callback для отслеживания прогресса
 * @param maxWaitTime - Максимальное время ожидания в миллисекундах (по умолчанию 10 минут)
 * @param checkInterval - Интервал проверки статуса в миллисекундах (по умолчанию 2 секунды)
 */
const waitForExportReady = async (
  exportId: string,
  token: string | undefined,
  onProgress?: (message: string) => void,
  maxWaitTime: number = 10 * 60 * 1000, // 10 минут
  checkInterval: number = 2000 // 2 секунды
): Promise<ExportMeta> => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await getExportStatus(exportId, token);

      if (status.status === 'ready' && status.fileSize && status.chunksCount) {
        // Экспорт готов, возвращаем полные метаданные
        return {
          exportId: status.exportId!,
          fileName: status.fileName!,
          fileSize: status.fileSize,
          chunkSize: status.chunkSize!,
          chunksCount: status.chunksCount,
          expiresAt: status.expiresAt!,
        };
      }

      if (status.status === 'expired' || status.status === 'not_found') {
        throw new Error(`Экспорт недоступен: ${status.status}`);
      }

      if (status.status === 'processing') {
        if (onProgress) {
          onProgress('Ожидание готовности экспорта...');
        }
      }
    } catch (error: any) {
      // Если это ошибка сети или сервера, продолжаем ждать
      if (error.message.includes('Экспорт недоступен')) {
        throw error;
      }
      // Иначе логируем и продолжаем
      console.warn('Ошибка при проверке статуса экспорта:', error.message);
    }

    // Ждем перед следующей проверкой
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error('Превышено время ожидания готовности экспорта');
};

/**
 * Полная функция экспорта: инициализация + ожидание готовности + скачивание всех частей
 * @param token - JWT токен пользователя
 * @param setMainData - Функция для обновления состояния (для showMessage)
 * @param onProgress - Callback для отслеживания прогресса
 */
export const exportGateFolder = async (
  token: string | undefined,
  setMainData?: Function,
  onProgress?: (message: string, partNumber?: number, totalParts?: number) => void
): Promise<void> => {
  try {
    if (onProgress) {
      onProgress('Инициализация экспорта...');
    }

    // Инициализируем экспорт (создание архива запускается в фоне)
    const initResult = await initGateExport(token);

    if (onProgress) {
      onProgress('Экспорт инициализирован. Ожидание готовности архива...');
    }

    // Ждем готовности экспорта
    const meta = await waitForExportReady(
      initResult.exportId,
      token,
      (message) => {
        if (onProgress) {
          onProgress(message);
        }
      }
    );

    if (onProgress) {
      onProgress(`Экспорт готов. Размер: ${(meta.fileSize / 1024 / 1024).toFixed(2)} MB. Начинаем скачивание...`);
    }

    // Скачиваем все части
    await downloadFullExport(
      meta.exportId,
      meta.chunksCount,
      meta.fileName,
      token,
      (partNumber, totalParts) => {
        if (onProgress) {
          const percent = Math.round((partNumber / totalParts) * 100);
          onProgress(`Скачивание части ${partNumber} из ${totalParts} (${percent}%)...`, partNumber, totalParts);
        }
      }
    );

    if (onProgress) {
      onProgress('Экспорт успешно скачан!');
    }

    if (setMainData) {
      showMessage('Экспорт папки uploads/gate успешно скачан', 'success', setMainData);
    }
  } catch (error: any) {
    const errorMessage = error.message || 'Ошибка при экспорте папки uploads/gate';
    
    if (onProgress) {
      onProgress(`Ошибка: ${errorMessage}`);
    }

    if (setMainData) {
      showMessage(errorMessage, 'error', setMainData);
    }
    
    throw error;
  }
};

