import { DocumentType } from "src/interfaces/document.interface";

export const DOCUMENT_NOT_FOUND_ERROR = "Document not found";
export const DOCUMENT_IS_PROVEDEN = "Document is proveden";

export const INTER_ENTERPRISE_RECEIVER_TYPE: Partial<
  Record<DocumentType, DocumentType>
> = {
  [DocumentType.SaleProd]: DocumentType.ComeMaterial,
  [DocumentType.SaleMaterial]: DocumentType.ComeMaterial,
  [DocumentType.SaleOS]: DocumentType.ComeOS,
  [DocumentType.MoveCash]: DocumentType.MoveCash,
};

export const INTER_ENTERPRISE_SENDER_TYPE: Partial<
  Record<DocumentType, DocumentType>
> = {};

export const resolveReceiverDocumentType = (
  documentType: DocumentType,
): DocumentType => INTER_ENTERPRISE_RECEIVER_TYPE[documentType] ?? documentType;

export const resolveSenderDocumentType = (
  documentType: DocumentType,
): DocumentType => INTER_ENTERPRISE_SENDER_TYPE[documentType] ?? documentType;
