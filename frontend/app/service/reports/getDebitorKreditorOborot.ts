import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';

export type DebitorKreditorOborotResponse = {
  reportType: string;
  values: Array<{
    innerReportType: string;
    schet?: string;
    totalDebitOborot?: number;
    totalKreditOborot?: number;
    innersDebitOborot?: Array<{ id: number; name: string; value: number }>;
    innersKreditOborot?: Array<{ id: number; name: string; value: number }>;
  }>;
};

export async function fetchDebitorKreditorOborot(
  mainData: Maindata,
): Promise<DebitorKreditorOborotResponse> {
  const { user } = mainData.users;
  const { interval } = mainData.journal;
  const { selectedEnterpriseId } = mainData.report;

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/debitorKreditorOborot' +
    '?startDate=' +
    interval.dateStart +
    '&endDate=' +
    interval.dateEnd;

  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    const enterpriseId =
      typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
        ? (selectedEnterpriseId as { id?: number })?.id
        : selectedEnterpriseId;
    if (
      enterpriseId !== null &&
      enterpriseId !== undefined &&
      typeof enterpriseId === 'number'
    ) {
      url += '&enterpriseId=' + enterpriseId;
    }
  }

  const config = {
    headers: { Authorization: `Bearer ${user?.token}` },
  };

  const response = await axios.get<DebitorKreditorOborotResponse>(url, config);
  return response.data;
}
