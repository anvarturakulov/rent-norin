import axios from 'axios';
import { DocumentModel } from '@/app/interfaces/document.interface';
import { ReadyRentalOrdersPayload } from './rentalOrders';

export const readyRentalOrdersKey = (
  token?: string,
  enterpriseId?: number | null,
) =>
  token && enterpriseId
    ? (['ready-rental-orders', enterpriseId] as const)
    : null;

export const fetchReadyRentalOrders = async (
  token: string | undefined,
  enterpriseId: number | null | undefined,
): Promise<ReadyRentalOrdersPayload> => {
  if (!token || !enterpriseId) {
    return { enoughForAll: true, orders: [] };
  }
  const { data } = await axios.get<ReadyRentalOrdersPayload>(
    `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/rental-orders/ready`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { enterpriseId },
    },
  );
  return {
    enoughForAll: Boolean(data?.enoughForAll),
    orders: Array.isArray(data?.orders) ? data.orders : [],
  };
};

export const createTransferFromRentalOrder = async (
  orderId: number,
  token: string | undefined,
): Promise<DocumentModel> => {
  const { data } = await axios.post<DocumentModel>(
    `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/rental-orders/${orderId}/create-transfer`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};
