import axios from 'axios';
import { DocumentModel, ReceiveToolsPreviewRow } from '@/app/interfaces/document.interface';

export const getReceiveToolsPreviewParams = (
  currentDocument: DocumentModel,
  enterpriseId: number | null | undefined,
): { params: Record<string, string | number>; error?: string } => {
  const isSublease =
    currentDocument?.documentType === 'ReceiveSubleaseToolsFromClient';
  const clientId = currentDocument?.docValues?.senderId;
  const warehouseId = currentDocument?.docValues?.receiverId;
  const partnerId = currentDocument?.docValues?.partnerId;
  const returnDateTime =
    Number(currentDocument?.docValues?.returnDateTime) ||
    Number(currentDocument?.date) ||
    0;

  if (isSublease) {
    if (!clientId || !returnDateTime) {
      return { params: {}, error: 'Клиент и дата возврата обязательны' };
    }
    const params: Record<string, string | number> = {
      clientId,
      returnDate: returnDateTime,
    };
    if (partnerId) params.partnerId = partnerId;
    if (enterpriseId != null) params.enterpriseId = enterpriseId;
    if (currentDocument?.id) params.excludeDocId = currentDocument.id;
    return { params };
  }

  if (!clientId || !warehouseId || !returnDateTime) {
    return { params: {}, error: 'Клиент, склад и дата возврата обязательны' };
  }

  const params: Record<string, string | number> = {
    clientId,
    warehouseId,
    returnDate: returnDateTime,
  };
  if (currentDocument?.id) {
    params.excludeDocId = currentDocument.id;
  }
  if (enterpriseId != null) {
    params.enterpriseId = enterpriseId;
  }

  return { params };
};

export const fetchReceiveToolsPreview = async (
  currentDocument: DocumentModel,
  token: string | undefined,
  enterpriseId: number | null | undefined,
): Promise<ReceiveToolsPreviewRow[]> => {
  const isSublease =
    currentDocument?.documentType === 'ReceiveSubleaseToolsFromClient';

  if (isSublease) {
    const { fetchSubleaseReceivePreview } = await import(
      './fetchSubleaseReceivePreview'
    );
    return fetchSubleaseReceivePreview(currentDocument, token, enterpriseId);
  }

  const { params, error } = getReceiveToolsPreviewParams(currentDocument, enterpriseId);
  if (error) {
    throw new Error(error);
  }

  const { data } = await axios.get<ReceiveToolsPreviewRow[]>(
    `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/receive-tools/preview`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );
  return Array.isArray(data) ? data : [];
};
