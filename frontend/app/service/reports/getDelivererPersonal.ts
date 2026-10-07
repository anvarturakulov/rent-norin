import { showMessage } from '../common/showMessage';
import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';
import { ReportOptions } from '@/app/interfaces/report.interface';

export const getDelivererPersonal = (
  setMainData: Function | undefined,
  mainData: Maindata,
) => {
  const { report, users } = mainData;
  const { reportOption, selectedEnterpriseId } = report;
  const { firstReferenceId } = reportOption;
  const { user } = users;
  const { startDate, endDate } = reportOption;

  const config = {
    headers: { Authorization: `Bearer ${user?.token}` },
  };
  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    `/api/reports/delivererPersonal?startDate=${startDate}&endDate=${endDate}`;

  if (firstReferenceId) url = url + '&firstSubcontoId=' + firstReferenceId;
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
        setMainData('delivererPersonal', response.data);
        setMainData('uploadingDashboard', false);
      }
    })
    .catch(function (error) {
      if (setMainData) {
        showMessage(error.message, 'error', setMainData);
      }
    });

  setMainData && setMainData('loading', false);
};
