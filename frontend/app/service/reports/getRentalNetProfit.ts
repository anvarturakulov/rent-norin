import axios from 'axios';

export type RentalNetProfitNode = {
  id: number;
  name: string;
  parentId: number | null;
  isFolder: boolean;
  income: number;
  otherIncome93: number;
  cogs: number;
  expense20: number;
  netProfit: number;
  profitability: number;
  children?: RentalNetProfitNode[];
};

export type RentalNetProfitResponse = {
  reportType: 'RENTAL_NET_PROFIT';
  startDate: number;
  endDate: number;
  totals: {
    income: number;
    otherIncome93: number;
    cogs: number;
    expense20: number;
    netProfit: number;
    profitability: number;
  };
  values: RentalNetProfitNode[];
};

const resolveEnterpriseId = (selectedEnterpriseId: unknown): number | null => {
  if (selectedEnterpriseId === null || selectedEnterpriseId === undefined) {
    return null;
  }
  if (typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null) {
    const id = (selectedEnterpriseId as { id?: number })?.id;
    return typeof id === 'number' ? id : null;
  }
  return typeof selectedEnterpriseId === 'number' ? selectedEnterpriseId : null;
};

export const getRentalNetProfit = async (
  startDate: number,
  endDate: number,
  selectedEnterpriseId: unknown,
  token: string,
): Promise<RentalNetProfitResponse> => {
  const config = { headers: { Authorization: `Bearer ${token}` } };

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/rentalNetProfit' +
    '?startDate=' +
    startDate +
    '&endDate=' +
    endDate;

  const enterpriseId = resolveEnterpriseId(selectedEnterpriseId);
  if (enterpriseId != null) {
    url += '&enterpriseId=' + enterpriseId;
  }

  const response = await axios.get(url, config);
  return response.data;
};
