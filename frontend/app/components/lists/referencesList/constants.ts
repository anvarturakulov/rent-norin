import { withApiDomain } from '@/app/service/common/getApiDomain';

/** Временно скрытые колонки в списке ТМЗ (включить обратно — true) */
export const TMZ_LIST_SHOW_ID = false;
export const TMZ_LIST_SHOW_ARTICLE = true;
export const TMZ_LIST_SHOW_SHORT_NAME = false;
export const TMZ_LIST_SHOW_SIZE = false;
export const TMZ_LIST_SHOW_COLOR = false;
export const TMZ_LIST_SHOW_MANUFACTURE = false;
/** Код организации (для ADMINGLOBAL) */
export const TMZ_LIST_SHOW_ENTERPRISE_CODE = true;
export const TMZ_LIST_SHOW_COMMENT = true;

const TMZ_LIST_COLUMNS_ALL = [
  { column: 'Қисқа ном', field: 'shortName', show: TMZ_LIST_SHOW_SHORT_NAME },
  { column: 'Ўлчам', field: 'size', show: TMZ_LIST_SHOW_SIZE },
  { column: 'Ранг', field: 'color', show: TMZ_LIST_SHOW_COLOR },
  { column: 'Ишлаб чиқарувчи', field: 'manufacture', show: TMZ_LIST_SHOW_MANUFACTURE },
  { column: 'ТМБ тури', field: 'typeTMZ', show: true },
  { column: 'Ул. бир.', field: 'unit', show: true },
] as const;

export const REFERENCE_TYPE_CONFIG = {
  TMZ: {
    columns: TMZ_LIST_COLUMNS_ALL.filter((c) => c.show).map((c) => c.column),
    fields: TMZ_LIST_COLUMNS_ALL.filter((c) => c.show).map((c) => c.field),
  },
  PARTNERS: {
    columns: ['ИНН', 'Телефон', 'Telegram ID', 'Excel'],
    fields: ['inn', 'phone', 'telegramId', 'importedFromXlsx'],
  },
  CARS: {
    columns: ['Модел'],
    fields: ['carModel']
  },
  MEDIATORS: {
    columns: ['Тури', 'Telegram ID'],
    fields: ['mediatorType', 'telegramId']
  },
  DELIVERERS: {
    columns: [],
    fields: []
  },
  STORAGES: {
    columns: ['Артикул', 'Булим тури'],
    fields: ['article', 'typeSection']
  },
  WORKS: {
    columns: ['Артикул', 'Норма', 'Ед. изм.', 'Цех'],
    fields: ['article', 'norma', 'unit', 'workDeptId']
  },
  COMMON_WORKS: {
    columns: ['Ед. изм.', 'Цена (firstPrice)'],
    fields: ['unit', 'firstPrice']
  }
} as const;

/** Тот же хост, что и PATCH/загрузки (Telegram: NEXT_PUBLIC_TELEGRAM_API_DOMAIN). */
export const REFERENCE_URLS = {
  byType: (type: string) => withApiDomain(`/api/references/byType/${type}`),
  all: () => withApiDomain('/api/references/all'),
} as const;
