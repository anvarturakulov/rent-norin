import axios from 'axios';

export type SubleaseExpectedIncomeToolRow = {
  toolId: number;
  toolName: string;
  partnerId: number;
  partnerName: string;
  count: number;
  settlementDate: number;
  rentHours: number;
  hourlyTariff: number;
  partnerHourlyTariff: number;
  clientRentSum: number;
  partnerCostSum: number;
  margin: number;
  transferDocId: number;
};

export type SubleaseExpectedIncomeClientRow = {
  clientId: number;
  clientName: string;
  totalClientRent: number;
  totalPartnerCost: number;
  totalMargin: number;
  tools: SubleaseExpectedIncomeToolRow[];
};

export type SubleaseExpectedIncomeResponse = {
  reportType: 'SUBLEASE_EXPECTED_INCOME';
  asOf: number;
  grandTotalClientRent: number;
  grandTotalPartnerCost: number;
  grandTotalMargin: number;
  clients: SubleaseExpectedIncomeClientRow[];
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

export const getSubleaseExpectedIncome = async (
  asOf: number,
  selectedEnterpriseId: unknown,
  token: string,
  clientId?: number | null,
): Promise<SubleaseExpectedIncomeResponse> => {
  const config = { headers: { Authorization: `Bearer ${token}` } };

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/subleaseExpectedIncome' +
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
