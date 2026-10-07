import { User, UserRoles } from "@/app/interfaces/user.interface"
import { DocumentType } from "@/app/interfaces/document.interface"

export const isAdmins = (user: User | undefined): boolean => {
  if (user && (user.role == UserRoles.ADMINGLOBAL || user.role == UserRoles.HEADCOMPANY)) return true
  return false
}

export const isUsersForProveden = (user: User | undefined): boolean => {
  if (user && (
      user.role == UserRoles.ADMINGLOBAL || 
      user.role == UserRoles.HEADCOMPANY ||
      user.role == UserRoles.GLAVBUX ||
      user.role == UserRoles.KASSIRGLOBAL ||
      user.role == UserRoles.KASSIR
    )) return true
  return false
}

/** Складские списания, которые может создавать/править/проводить ZAVSKLAD */
export const ZAVSKLAD_EDITABLE_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.LeaveMaterial,
  DocumentType.LeaveHalfstuff,
  DocumentType.LeaveOnlyOneMaterial,
]

export const canZavskladEditDocument = (
  user: User | undefined,
  documentType: DocumentType | string | undefined,
): boolean => {
  if (!user || user.role !== UserRoles.ZAVSKLAD || !documentType) return false
  return ZAVSKLAD_EDITABLE_DOCUMENT_TYPES.includes(documentType as DocumentType)
}

export const canUserEditOrProveDocument = (
  user: User | undefined,
  documentType: DocumentType | string | undefined,
): boolean => {
  return isUsersForProveden(user) || canZavskladEditDocument(user, documentType)
}

export const isGuest = (user: User | undefined): boolean => {
  if (user && user.role == UserRoles.GUEST ) return true
  return false
}

export const isGlBuxs = (user: User | undefined): boolean => {
  if (user && user.role == UserRoles.GLAVBUX) return true
  return false
}