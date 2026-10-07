import { MenuItem, MenuSubItem } from '../interfaces/menu.interface';
import { DashboardReportItem } from '../interfaces/report.interface';
import { DocumentType } from '../interfaces/document.interface';
import { TypeReference } from '../interfaces/reference.interface';
import { ReportType } from '../interfaces/report.interface';
import { ServiceType, GateType } from '../interfaces/general.interface';

/**
 * Интерфейс для элемента с метаданными из MenuData
 */
export interface MenuItemWithMetadata {
  type: 'document' | 'report' | 'informReport' | 'reference' | 'servis' | 'gate' | 'furniture';
  value: DocumentType | ReportType | TypeReference | ServiceType | GateType | string;
  description: string;
  roles?: string[];
  registryKey?: string; // Опциональное для обратной совместимости
}

/**
 * Получает inform отчеты из DashboardReportData
 */
export function getInformReportsFromDashboard(dashboardData: DashboardReportItem[]): MenuItemWithMetadata[] {
  return dashboardData.map(item => ({
    type: 'informReport',
    value: item.code, // Используем code как значение
    description: item.title,
    roles: undefined,
    registryKey: item.code // Для обратной совместимости
  }));
}

/**
 * Преобразует структуру меню в плоский список элементов для настроек видимости
 * Использует title напрямую, без зависимости от registryKey
 */
function resolveItemType(itemType: string): MenuItemWithMetadata['type'] {
  if (itemType === 'document') return 'document';
  if (itemType === 'report') return 'report';
  if (itemType === 'reference') return 'reference';
  if (itemType === 'servis') return 'servis';
  if (itemType === 'gate-income' || itemType === 'gate-outcome') return 'gate';
  if (
    itemType === 'furniture-orders' ||
    itemType === 'furniture-my-works' ||
    itemType === 'furniture-production-board' ||
    itemType === 'furniture-stage-board' ||
    itemType === 'furniture-contracts' ||
    itemType === 'furniture-cutting-balances' ||
    itemType === 'furniture-work-time-report' ||
    itemType === 'rental-contracts'
  )
    return 'furniture';
  return 'document';
}

export function flattenMenuStructure(menuStructure: MenuItem[]): MenuItemWithMetadata[] {
  const result: MenuItemWithMetadata[] = [];

  menuStructure.forEach((menuItem) => {
    // Обрабатываем subMenu
    menuItem.subMenu.forEach((item) => {
      const itemType = resolveItemType(item.type);

      result.push({
        type: itemType,
        value: item.title as any,
        description: item.description,
        roles: item.roles?.map((r) => r.toString()),
        registryKey: String(item.title),
      });
    });

    // Обрабатываем subGroups
    menuItem.subGroups?.forEach((group) => {
      group.items.forEach((item) => {
        const itemType = resolveItemType(item.type);

        result.push({
          type: itemType,
          value: item.title as any,
          description: item.description,
          roles: item.roles?.map((r) => r.toString()),
          registryKey: String(item.title), // Используем title как registryKey для обратной совместимости
        });
      });
    });
  });

  return result;
}

/**
 * Группирует элементы по типам для удобного отображения в настройках
 */
export function groupItemsByType(
  items: MenuItemWithMetadata[]
): {
  documents: MenuItemWithMetadata[];
  reports: MenuItemWithMetadata[];
  informReports: MenuItemWithMetadata[];
  references: MenuItemWithMetadata[];
  services: MenuItemWithMetadata[];
  gates: MenuItemWithMetadata[];
  furniture: MenuItemWithMetadata[];
} {
  return {
    documents: items.filter((item) => item.type === 'document'),
    reports: items.filter((item) => item.type === 'report'),
    informReports: items.filter((item) => item.type === 'informReport'),
    references: items.filter((item) => item.type === 'reference'),
    services: items.filter((item) => item.type === 'servis'),
    gates: items.filter((item) => item.type === 'gate'),
    furniture: items.filter((item) => item.type === 'furniture'),
  };
}

