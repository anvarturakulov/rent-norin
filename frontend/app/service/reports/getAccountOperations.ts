import axios from 'axios';

export const getAccountOperations = async (
  schet: string,
  startDate: number,
  endDate: number,
  selectedEnterpriseId: any,
  token: string
) => {
  const config = { headers: { Authorization: `Bearer ${token}` } };

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/account-operations' +
    '?schet=' + schet +
    '&startDate=' + startDate +
    '&endDate=' + endDate;

  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    const enterpriseId =
      typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
        ? (selectedEnterpriseId as any)?.id
        : selectedEnterpriseId;

    if (typeof enterpriseId === 'number') {
      url += '&enterpriseId=' + enterpriseId;
    }
  }

  const response = await axios.get(url, config);
  return response.data;
};

