import { MenuItem, MenuSubItem, MenuSubGroup } from '../interfaces/menu.interface';
import { MenuVisibilitySettings, RoleMenuVisibility } from '../interfaces/enterprise.interface';
import { UserRoles } from '../interfaces/user.interface';
import { DocumentType } from '../interfaces/document.interface';
import { ReportType, DashboardReportItem } from '../interfaces/report.interface';
import { TypeReference } from '../interfaces/reference.interface';
import { ServiceType, GateType, FurnitureType } from '../interfaces/general.interface';
import { INFORM_REPORTS_AUTO_GRANT } from '../data/report';

/**
 * Проверяет, виден ли элемент меню для данной роли на основе настроек предприятия (whitelist)
 * @param item - элемент меню
 * @param role - роль пользователя
 * @param roleVisibility - настройки видимости для роли
 * @returns true если элемент должен быть виден
 */
function isItemVisible(
    item: MenuSubItem,
    role: UserRoles,
    roleVisibility: RoleMenuVisibility | undefined
): boolean {
    // Если настройки не заданы для роли, ничего не показываем (whitelist подход)
    if (!roleVisibility) {
        return false;
    }

    // Проверяем в зависимости от типа элемента
    switch (item.type) {
        case 'document':
            if (roleVisibility.visibleDocuments) {
                if (roleVisibility.visibleDocuments.includes(item.title as DocumentType)) {
                    return true;
                }
                if (
                    item.title === DocumentType.OrderToolsToClient &&
                    roleVisibility.visibleDocuments.includes(
                        DocumentType.TransferToolsToClient,
                    )
                ) {
                    return true;
                }
                if (
                    item.title === DocumentType.Advance &&
                    roleVisibility.visibleDocuments.includes(DocumentType.LeaveCash)
                ) {
                    return true;
                }
                return false;
            }
            return false;

        case 'report':
            if (roleVisibility.visibleReports) {
                return roleVisibility.visibleReports.includes(item.title as ReportType);
            }
            return false;

        case 'reference':
            if (roleVisibility.visibleReferences) {
                return roleVisibility.visibleReferences.includes(item.title as TypeReference);
            }
            return false;

        case 'servis':
            if (roleVisibility.visibleServices) {
                return roleVisibility.visibleServices.includes(item.title as ServiceType);
            }
            return false;

        case 'gate-income':
        case 'gate-outcome':
            if (roleVisibility.visibleGates) {
                const gateType = item.type === 'gate-income' ? GateType.Income : GateType.Outcome;
                return roleVisibility.visibleGates.includes(gateType);
            }
            return false;

        case 'furniture-orders':
        case 'furniture-my-works':
        case 'furniture-production-board':
        case 'furniture-stage-board':
        case 'furniture-contracts':
        case 'furniture-cutting-balances':
        case 'furniture-work-time-report':
            if (roleVisibility.visibleFurniture) {
                const ft =
                    item.type === 'furniture-orders' ||
                    item.type === 'furniture-stage-board'
                        ? FurnitureType.Orders
                        : item.type === 'furniture-contracts'
                          ? FurnitureType.Contracts
                          : item.type === 'furniture-cutting-balances'
                            ? FurnitureType.CuttingBalances
                            : item.type === 'furniture-work-time-report'
                              ? FurnitureType.WorkTimeReport
                            : item.type === 'furniture-production-board'
                              ? FurnitureType.ProductionBoard
                              : FurnitureType.MyWorks;
                const list = roleVisibility.visibleFurniture;
                if (list.includes(ft)) return true;
                if (
                    item.type === 'furniture-production-board' &&
                    list.includes(FurnitureType.MyWorks)
                ) {
                    return true;
                }
                return false;
            }
            return false;

        case 'rental-contracts':
            if (roleVisibility.visibleDocuments) {
                return roleVisibility.visibleDocuments.includes(
                    DocumentType.TransferToolsToClient,
                );
            }
            return false;

        default:
            return false;
    }
}

/**
 * Фильтрует элементы подменю на основе настроек видимости
 */
function filterSubMenuItems(
    items: MenuSubItem[],
    role: UserRoles,
    roleVisibility: RoleMenuVisibility | undefined
): MenuSubItem[] {
    return items.filter(item => isItemVisible(item, role, roleVisibility));
}

/**
 * Фильтрует группы подменю на основе настроек видимости
 */
function filterSubGroups(
    subGroups: MenuSubGroup[],
    role: UserRoles,
    roleVisibility: RoleMenuVisibility | undefined
): MenuSubGroup[] {
    return subGroups
        .map(group => ({
            ...group,
            items: filterSubMenuItems(group.items, role, roleVisibility)
        }))
        .filter(group => group.items.length > 0); // Убираем пустые группы
}

/**
 * Фильтрует меню на основе настроек видимости предприятия
 * @param menuData - исходные данные меню
 * @param role - роль пользователя
 * @param menuVisibility - настройки видимости меню предприятия
 * @returns отфильтрованное меню
 */
export function filterMenuByEnterpriseSettings(
    menuData: MenuItem[],
    role: UserRoles,
    menuVisibility: MenuVisibilitySettings | undefined
): MenuItem[] {
    // Если настройки не заданы, возвращаем пустой массив (whitelist подход)
    if (!menuVisibility) {
        return [];
    }

    const roleVisibility = menuVisibility[role];

    // Если настройки не заданы для данной роли, возвращаем пустой массив
    if (!roleVisibility) {
        return [];
    }

    return menuData
        .map(item => {
            // Если у пункта меню нет подменю и подгрупп, оставляем как есть (например, "Асосий натижалар")
            if (item.subMenu.length === 0 && (!item.subGroups || item.subGroups.length === 0)) {
                return item;
            }

            // Фильтруем subMenu
            const filteredSubMenu = filterSubMenuItems(item.subMenu, role, roleVisibility);

            // Фильтруем subGroups
            const filteredSubGroups = item.subGroups
                ? filterSubGroups(item.subGroups, role, roleVisibility)
                : undefined;

            // Если после фильтрации не осталось элементов, возвращаем null (будет отфильтрован)
            if (filteredSubMenu.length === 0 && (!filteredSubGroups || filteredSubGroups.length === 0)) {
                return null;
            }

            return {
                ...item,
                subMenu: filteredSubMenu,
                subGroups: filteredSubGroups
            };
        })
        .filter((item): item is MenuItem => item !== null);
}

/**
 * Добавляет новые inform-отчёты в настройки видимости для ролей с уже настроенным доступом.
 */
export function patchMenuVisibilityInformReports(
    menuVisibility: MenuVisibilitySettings | undefined,
): MenuVisibilitySettings | undefined {
    if (!menuVisibility) {
        return menuVisibility;
    }

    const result: MenuVisibilitySettings = { ...menuVisibility };

    (Object.keys(result) as UserRoles[]).forEach((role) => {
        const roleSettings = result[role];
        if (!roleSettings) return;

        const current = roleSettings.visibleInformReports || [];
        if (current.length === 0) return;

        const merged = new Set(current);
        let changed = false;

        for (const code of INFORM_REPORTS_AUTO_GRANT) {
            if (!merged.has(code)) {
                merged.add(code);
                changed = true;
            }
        }

        if (changed) {
            result[role] = {
                ...roleSettings,
                visibleInformReports: Array.from(merged),
            };
        }
    });

    return result;
}

/**
 * Фильтрует dashboard отчеты на основе настроек видимости предприятия
 * @param reports - список отчетов dashboard
 * @param role - роль пользователя
 * @param menuVisibility - настройки видимости меню предприятия
 * @returns отфильтрованный список отчетов
 */
export function filterDashboardReports(
    reports: DashboardReportItem[],
    role: UserRoles,
    menuVisibility: MenuVisibilitySettings | undefined
): DashboardReportItem[] {
    const patchedVisibility = patchMenuVisibilityInformReports(menuVisibility);

    // Если настройки не заданы, возвращаем пустой массив (whitelist подход)
    if (!patchedVisibility) {
        return [];
    }

    const roleVisibility = patchedVisibility[role];
    if (!roleVisibility) {
        return [];
    }

    // Если visibleInformReports не определен или не является массивом, возвращаем пустой массив
    if (!Array.isArray(roleVisibility.visibleInformReports)) {
        return [];
    }

    const allowedCodes = new Set(roleVisibility.visibleInformReports);

    // Сохраняем порядок из DashboardReportData
    return reports.filter((report) => allowedCodes.has(report.code));
}

