import axios from 'axios';
import { Schet } from '@/app/interfaces/report.interface';

export type FetchClientS40BalanceParams = {
  clientId: number;
  endDate: number;
  token: string;
  enterpriseId?: number | null;
};

/** Текущий остаток S40 (дебиторка клиента) на дату. */
export const fetchClientS40Balance = async ({
  clientId,
  endDate,
  token,
  enterpriseId,
}: FetchClientS40BalanceParams): Promise<number> => {
  const params = new URLSearchParams({
    schet: Schet.S40,
    endDate: String(endDate),
    firstSubcontoId: String(clientId),
  });
  if (enterpriseId != null) {
    params.set('enterpriseId', String(enterpriseId));
  }

  const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/priceAndBalance?${params.toString()}`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Number(response.data?.balance ?? 0);
};
