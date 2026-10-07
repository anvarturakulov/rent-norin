import axios from 'axios';

export type RentalExpectedIncomeToolRow = {
  toolId: number;
  toolName: string;
  count: number;
  settlementDate: number;
  hourlyTariff: number;
  rentHours: number;
  rentSum: number;
  transferDocId: number;
};

export type RentalExpectedIncomeClientRow = {
  clientId: number;
  clientName: string;
  totalRentSum: number;
  tools: RentalExpectedIncomeToolRow[];
};

export type RentalExpectedIncomeResponse = {
  reportType: 'RENTAL_EXPECTED_INCOME';
  asOf: number;
  grandTotal: number;
  clients: RentalExpectedIncomeClientRow[];
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

export const getRentalExpectedIncome = async (
  asOf: number,
  selectedEnterpriseId: unknown,
  token: string,
  clientId?: number | null,
): Promise<RentalExpectedIncomeResponse> => {
  const config = { headers: { Authorization: `Bearer ${token}` } };

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/rentalExpectedIncome' +
    '?asOf=' +
    asOf;

  const enterpriseId = resolveEnterpriseId(selectedEnterpriseId);
  if (enterpriseId != null) {
    url += '&enterpriseId=' + enterpriseId;
  }

  if (clientId != null && clientId > 0) {
    url += '&clientId=' + clientId;
  }

  const response = await axios.get(url, config);
  return response.data;
};
