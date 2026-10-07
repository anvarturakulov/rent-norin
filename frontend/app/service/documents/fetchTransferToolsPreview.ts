import axios from 'axios';
import { DocumentModel, TransferToolsPreviewRow } from '@/app/interfaces/document.interface';

export const getTransferToolsPreviewParams = (
  currentDocument: DocumentModel,
  enterpriseId: number | null | undefined,
): { params: Record<string, string | number>; error?: string } => {
  const warehouseId = currentDocument?.docValues?.senderId;
  const documentDate = Number(currentDocument?.date) || 0;

  if (!warehouseId || !documentDate) {
    return { params: {}, error: 'Склад-отправитель и дата документа обязательны' };
  }

  const params: Record<string, string | number> = {
    warehouseId,
    date: documentDate,
  };
  if (enterpriseId != null) {
    params.enterpriseId = enterpriseId;
  }
  if (currentDocument?.docValues?.rentTariffType) {
    params.rentTariffType = currentDocument.docValues.rentTariffType;
  }

  return { params };
};

export const fetchTransferToolsPreview = async (
  currentDocument: DocumentModel,
  token: string | undefined,
  enterpriseId: number | null | undefined,
): Promise<TransferToolsPreviewRow[]> => {
  const { params, error } = getTransferToolsPreviewParams(currentDocument, enterpriseId);
  if (error) {
    throw new Error(error);
  }

  const { data } = await axios.get<TransferToolsPreviewRow[]>(
    `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/transfer-tools/preview`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );

  return Array.isArray(data) ? data : [];
};
