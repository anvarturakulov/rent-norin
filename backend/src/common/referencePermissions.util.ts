import { TypeReference } from "src/interfaces/reference.interface";
import { UserRoles } from "src/interfaces/user.interface";

export interface ReferencePermissionItem {
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canUploadFiles?: boolean;
}

const LEGACY_CREATE_ROLES: UserRoles[] = [
  UserRoles.ADMINGLOBAL,
  UserRoles.HEADCOMPANY,
  UserRoles.GLAVBUX,
  UserRoles.KASSIR,
  UserRoles.KASSIRGLOBAL,
  UserRoles.HEADGLOBAL,
];

const LEGACY_EDIT_ROLES: UserRoles[] = [
  UserRoles.ADMINGLOBAL,
  UserRoles.HEADCOMPANY,
  UserRoles.GLAVBUX,
  UserRoles.HEADGLOBAL,
];

function getTypePermission(
  referencePermissions: Record<string, unknown> | null | undefined,
  type: TypeReference,
): ReferencePermissionItem | null {
  if (referencePermissions == null) {
    return null;
  }
  const item = referencePermissions[type];
  if (!item || typeof item !== "object") {
    return null;
  }
  return item as ReferencePermissionItem;
}

function hasFlag(
  referencePermissions: Record<string, unknown> | null | undefined,
  role: string,
  type: TypeReference,
  key: keyof ReferencePermissionItem,
  legacyRoles: UserRoles[],
): boolean {
  const item = getTypePermission(referencePermissions, type);
  if (item) {
    return item[key] !== false;
  }
  if (referencePermissions != null) {
    return true;
  }
  if (
    role === UserRoles.DRAWING &&
    type === TypeReference.TMZ &&
    key !== "canDelete"
  ) {
    return true;
  }
  return legacyRoles.includes(role as UserRoles);
}

export function canCreateReference(
  referencePermissions: Record<string, unknown> | null | undefined,
  role: string,
  type: TypeReference,
): boolean {
  return hasFlag(
    referencePermissions,
    role,
    type,
    "canCreate",
    LEGACY_CREATE_ROLES,
  );
}

export function canEditReference(
  referencePermissions: Record<string, unknown> | null | undefined,
  role: string,
  type: TypeReference,
): boolean {
  return hasFlag(
    referencePermissions,
    role,
    type,
    "canEdit",
    LEGACY_EDIT_ROLES,
  );
}
