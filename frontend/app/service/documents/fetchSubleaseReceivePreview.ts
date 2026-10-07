import axios from 'axios';
import { DocumentModel, ReceiveToolsPreviewRow } from '@/app/interfaces/document.interface';

export const getSubleaseReceivePreviewParams = (
  currentDocument: DocumentModel,
  enterpriseId: number | null | undefined,
): { params: Record<string, string | number>; error?: string } => {
  const clientId = currentDocument?.docValues?.senderId;
  const partnerId = currentDocument?.docValues?.partnerId;
  const returnDateTime =
    Number(currentDocument?.docValues?.returnDateTime) ||
    Number(currentDocument?.date) ||
    0;

  if (!clientId || !returnDateTime) {
    return { params: {}, error: 'Клиент и дата возврата обязательны' };
  }

  const params: Record<string, string | number> = {
    clientId,
    returnDate: returnDateTime,
  };
  if (partnerId) {
    params.partnerId = partnerId;
  }
  if (enterpriseId != null) {
    params.enterpriseId = enterpriseId;
  }
  if (currentDocument?.id) {
    params.excludeDocId = currentDocument.id;
  }

  return { params };
};

export const fetchSubleaseReceivePreview = async (
  currentDocument: DocumentModel,
  token: string | undefined,
  enterpriseId: number | null | undefined,
): Promise<ReceiveToolsPreviewRow[]> => {
  const { params, error } = getSubleaseReceivePreviewParams(
    currentDocument,
    enterpriseId,
  );
  if (error) {
    throw new Error(error);
  }

  const { data } = await axios.get(
    `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/sublease-receive/preview`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );

  return (data || []).map((row: any) => ({
    analiticId: row.analiticId,
    count: row.count,
    price: row.price ?? 0,
    total: row.total ?? row.rentSum ?? 0,
    costPrice: 0,
    costTotal: 0,
    balance: row.balance ?? row.count,
    hourlyTariff: row.hourlyTariff,
    rentSum: row.rentSum,
    partnerHourlyTariff: row.partnerHourlyTariff,
    partnerRentSum: row.partnerRentSum,
    sourceTransferDocId: row.sourceTransferDocId,
    settlementDate: row.settlementDate,
    transferDocNumber: row.transferDocNumber,
    tableType: 'return' as const,
  }));
};
