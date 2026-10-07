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

const API_BASE = `${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/export-uploads`;

export const initUploadsExport = async (
  token: string | undefined,
): Promise<{ exportId: string; fileName: string; status: 'processing' }> => {
  if (!token) {
    throw new Error('Токен не предоставлен');
  }

  try {
    const response = await axios.post(
      `${API_BASE}/init`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      'Ошибка при инициализации экспорта';
    throw new Error(errorMessage);
  }
};

export const downloadUploadsExportPart = async (
  exportId: string,
  partNumber: number,
  token: string | undefined,
): Promise<Blob> => {
  if (!token) {
    throw new Error('Токен не предоставлен');
  }

  try {
    const response = await axios.get(`${API_BASE}/${exportId}/part/${partNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });
    return response.data;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      `Ошибка при скачивании части ${partNumber}`;
    throw new Error(errorMessage);
  }
};

export const getUploadsExportStatus = async (
  exportId: string,
  token: string | undefined,
): Promise<{ status: 'processing' | 'ready' | 'not_found' | 'expired' } & Partial<ExportMeta>> => {
  if (!token) {
    throw new Error('Токен не предоставлен');
  }

  try {
    const response = await axios.get(`${API_BASE}/${exportId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { status: 'not_found' };
    }
    if (error.response?.status === 410) {
      return { status: 'expired' };
    }
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      'Ошибка при получении статуса экспорта';
    throw new Error(errorMessage);
  }
};

const downloadFullUploadsExport = async (
  exportId: string,
  chunksCount: number,
  fileName: string,
  token: string | undefined,
  onProgress?: (partNumber: number, totalParts: number) => void,
): Promise<void> => {
  const parts: Blob[] = [];

  for (let partNumber = 1; partNumber <= chunksCount; partNumber++) {
    if (onProgress) {
      onProgress(partNumber, chunksCount);
    }

    const blob = await downloadUploadsExportPart(exportId, partNumber, token);
    parts.push(blob);
  }

  const fullBlob = new Blob(parts, { type: 'application/zip' });
  const url = window.URL.createObjectURL(fullBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const waitForUploadsExportReady = async (
  exportId: string,
  token: string | undefined,
  onProgress?: (message: string) => void,
  maxWaitTime: number = 60 * 60 * 1000,
  checkInterval: number = 3000,
): Promise<ExportMeta> => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const status = await getUploadsExportStatus(exportId, token);

    if (status.status === 'ready' && status.fileSize && status.chunksCount) {
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

    if (status.status === 'processing' && onProgress) {
      onProgress('Ожидание готовности архива uploads...');
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  throw new Error('Превышено время ожидания готовности экспорта uploads');
};

export const exportUploadsFolder = async (
  token: string | undefined,
  setMainData?: Function,
  onProgress?: (message: string, partNumber?: number, totalParts?: number) => void,
): Promise<void> => {
  try {
    if (onProgress) {
      onProgress('Инициализация экспорта uploads...');
    }

    const initResult = await initUploadsExport(token);

    if (onProgress) {
      onProgress('Экспорт инициализирован. Ожидание готовности архива...');
    }

    const meta = await waitForUploadsExportReady(
      initResult.exportId,
      token,
      (message) => {
        if (onProgress) {
          onProgress(message);
        }
      },
    );

    if (onProgress) {
      onProgress(
        `Экспорт готов. Размер: ${(meta.fileSize / 1024 / 1024).toFixed(2)} MB. Начинаем скачивание...`,
      );
    }

    await downloadFullUploadsExport(
      meta.exportId,
      meta.chunksCount,
      meta.fileName,
      token,
      (partNumber, totalParts) => {
        if (onProgress) {
          const percent = Math.round((partNumber / totalParts) * 100);
          onProgress(
            `Скачивание части ${partNumber} из ${totalParts} (${percent}%)...`,
            partNumber,
            totalParts,
          );
        }
      },
    );

    if (onProgress) {
      onProgress('Экспорт uploads успешно скачан!');
    }

    if (setMainData) {
      showMessage('Экспорт папки uploads успешно скачан', 'success', setMainData);
    }
  } catch (error: any) {
    const errorMessage = error.message || 'Ошибка при экспорте папки uploads';

    if (onProgress) {
      onProgress(`Ошибка: ${errorMessage}`);
    }

    if (setMainData) {
      showMessage(errorMessage, 'error', setMainData);
    }

    throw error;
  }
};
