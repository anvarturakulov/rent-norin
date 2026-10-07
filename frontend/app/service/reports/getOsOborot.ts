import { showMessage } from '../common/showMessage';
import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';
import { ReportOptions } from '@/app/interfaces/report.interface';

const resolveSectionId = (
  firstReferenceId: number | string | null | undefined,
): number | null => {
  if (
    firstReferenceId === null ||
    firstReferenceId === undefined ||
    firstReferenceId === 0 ||
    firstReferenceId === -1 ||
    firstReferenceId === '-1'
  ) {
    return null;
  }
  const n = Number(firstReferenceId);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const getOsOborot = (
  setMainData: Function | undefined,
  mainData: Maindata,
) => {
  const { user } = mainData.users;
  const { reportOption, selectedEnterpriseId } = mainData.report;
  const { startDate, endDate, firstReferenceId } = reportOption;

  const config = {
    headers: { Authorization: `Bearer ${user?.token}` },
  };

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/osOborot' +
    '?startDate=' +
    startDate +
    '&endDate=' +
    endDate;

  const sectionId = resolveSectionId(firstReferenceId);
  if (sectionId) {
    url += '&sectionId=' + sectionId;
  }

  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    const enterpriseId =
      typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
        ? (selectedEnterpriseId as any)?.id
        : selectedEnterpriseId;
    if (
      enterpriseId !== null &&
      enterpriseId !== undefined &&
      typeof enterpriseId === 'number'
    ) {
      url += '&enterpriseId=' + enterpriseId;
    }
  }

  axios
    .get(url, config)
    .then(function (response) {
      if (setMainData) {
        const newReportOptions: ReportOptions = {
          ...reportOption,
          startReport: true,
        };
        setMainData('reportOption', { ...newReportOptions });
        setMainData('osOborot', [response.data]);
        setMainData('uploadingDashboard', false);
      }
    })
    .catch(function (error) {
      if (setMainData) {
        const msg =
          error.response?.data?.message ||
          error.message ||
          'Хисоботни шакллантириб бўлмади';
        showMessage(msg, 'error', setMainData);
        setMainData('uploadingDashboard', false);
      }
    })
    .finally(() => {
      setMainData && setMainData('loading', false);
    });
};
