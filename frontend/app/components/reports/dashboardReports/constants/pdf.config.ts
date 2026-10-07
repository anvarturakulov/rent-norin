// Константы для PDF конфигурации
export const PDF_CONFIG = {
  SCALE: 1,
  QUALITY: 0.5,
  MAX_SIZE_MB: 50,
  PAGE_SIZE: 'a4',
  ORIENTATION: 'p',
  IMAGE_FORMAT: 'PNG',
  COMPRESSION: 'FAST'
} as const;

export const PDF_ERROR_MESSAGES = {
  CONTENT_NOT_FOUND: 'Report content not found',
  EMPTY_PDF: 'Generated PDF is empty',
  SIZE_EXCEEDED: (size: number, maxSize: number) => 
    `PDF size (${size.toFixed(2)}MB) exceeds ${maxSize}MB, please reduce report content.`,
  SEND_FAILED: 'Failed to send PDF',
  SEND_SUCCESS: 'Архивга жунатилди'
} as const;

export const PDF_FILENAME_TEMPLATE = (dateStart: string, dateEnd: string) => 
  `Жамланма хисобот - (${dateStart}-${dateEnd}).pdf`; 