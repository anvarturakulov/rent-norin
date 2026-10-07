import axios from 'axios';

export type AktSverkaPartnerType = 'CLIENTS' | 'SUPPLIERS' | 'DEPARTMENTS';

export type AktSverkaResponse = {
  reportType: 'AKT_SVERKA';
  values: any[];
};

export const getAktSverkaInform = async (
  partnerType: AktSverkaPartnerType,
  firstReferenceId: number | null | undefined,
  startDate: number,
  endDate: number,
  selectedEnterpriseId: unknown,
  token: string,
): Promise<AktSverkaResponse> => {
  const config = { headers: { Authorization: `Bearer ${token}` } };

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/aktSverka' +
    '?startDate=' +
    startDate +
    '&endDate=' +
    endDate +
    '&partnerType=' +
    partnerType;

  if (firstReferenceId !== null && firstReferenceId !== undefined) {
    const sectionId = Number(firstReferenceId);
    if (!Number.isNaN(sectionId)) {
      url += '&sectionId=' + sectionId;
    }
  }

  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    const enterpriseId =
      typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
        ? (selectedEnterpriseId as { id?: number })?.id
        : selectedEnterpriseId;

    if (typeof enterpriseId === 'number') {
      url += '&enterpriseId=' + enterpriseId;
    }
  }

  const response = await axios.get(url, config);
  return response.data;
};
