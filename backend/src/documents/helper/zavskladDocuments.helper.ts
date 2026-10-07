import { ForbiddenException } from "@nestjs/common";
import { DocumentType } from "src/interfaces/document.interface";
import { UserRoles } from "src/interfaces/user.interface";

/** Складские списания, доступные роли ZAVSKLAD */
export const ZAVSKLAD_EDITABLE_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.LeaveMaterial,
  DocumentType.LeaveHalfstuff,
  DocumentType.LeaveOnlyOneMaterial,
];

export const isZavskladEditableDocumentType = (
  documentType: DocumentType | string | undefined | null,
): boolean => {
  if (!documentType) return false;
  return ZAVSKLAD_EDITABLE_DOCUMENT_TYPES.includes(documentType as DocumentType);
};

/**
 * ZAVSKLAD может работать только со складскими списаниями.
 * Остальные роли (уже прошедшие @Roles) — без ограничений здесь.
 */
export const assertZavskladDocumentAccess = (
  role: UserRoles | string | undefined,
  documentType: DocumentType | string | undefined | null,
): void => {
  if (role !== UserRoles.ZAVSKLAD) return;
  if (!isZavskladEditableDocumentType(documentType)) {
    throw new ForbiddenException(
      "Нет доступа: роль ZAVSKLAD может работать только со списаниями материалов/полуфабрикатов",
    );
  }
};
