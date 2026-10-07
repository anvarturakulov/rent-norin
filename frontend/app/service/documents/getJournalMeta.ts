import { getDataForSwr } from '../common/getDataForSwr';
import { DocumentType } from '@/app/interfaces/document.interface';

export interface JournalMeta {
  lastDocumentDate: number | null;
  lastModifiedAt: string | null;
}

export const isJournalMetaDocumentType = (
  contentName: string | DocumentType | undefined,
): contentName is DocumentType => {
  if (!contentName || contentName === 'ALL_DOCUMENTS') return false;
  return Object.values(DocumentType).includes(contentName as DocumentType);
};

export const buildJournalMetaUrl = (documentType: DocumentType): string => {
  const params = new URLSearchParams();
  params.append('documentType', documentType);
  return `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/journal-meta?${params}`;
};

export const getJournalMeta = async (
  documentType: DocumentType,
  token: string | undefined,
): Promise<JournalMeta | null> => {
  if (!token) return null;
  return getDataForSwr(buildJournalMetaUrl(documentType), token);
};
