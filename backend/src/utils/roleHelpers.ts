import { UserRoles } from "../interfaces/user.interface";

/**
 * Проверяет, является ли роль глобальной (заканчивается на "GLOBAL")
 */
export function isGlobalRole(role: UserRoles | undefined | null): boolean {
  if (!role || typeof role !== "string") {
    return false;
  }
  return role.endsWith("GLOBAL");
}

/**
 * Возвращает список всех GLOBAL ролей
 */
export function getGlobalRoles(): UserRoles[] {
  return Object.values(UserRoles).filter(isGlobalRole);
}

/**
 * Проверяет, может ли роль редактировать глобальные настройки
 * HEADGLOBAL - только просмотр, KASSIRGLOBAL и другие редактируемые GLOBAL роли - могут редактировать
 */
export function canEditGlobalSettings(
  role: UserRoles | undefined | null,
): boolean {
  if (!role || typeof role !== "string") {
    return false;
  }

  if (!isGlobalRole(role)) {
    return false;
  }

  // HEADGLOBAL - только просмотр
  if (role === UserRoles.HEADGLOBAL) {
    return false;
  }

  // KASSIRGLOBAL и другие GLOBAL роли (кроме HEADGLOBAL) могут редактировать
  // Также ADMINGLOBAL может редактировать глобальные настройки
  if (role === UserRoles.KASSIRGLOBAL || role === UserRoles.ADMINGLOBAL) {
    return true;
  }
  // Проверяем другие GLOBAL роли (кроме HEADGLOBAL)
  return isGlobalRole(role);
}

export function canEditPricingPolicy(
  role: UserRoles | undefined | null,
): boolean {
  if (!role || typeof role !== "string") {
    return false;
  }
  return (
    role === UserRoles.ADMINGLOBAL ||
    role === UserRoles.HEADCOMPANY ||
    role === UserRoles.GLAVBUX
  );
}
