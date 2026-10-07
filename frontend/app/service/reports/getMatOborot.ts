import { showMessage } from '../common/showMessage';
import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';
import { ReportOptions } from '@/app/interfaces/report.interface';
import { isMatOborotSchet } from './matOborotTypes';

export const getMatOborot = (
  setMainData: Function | undefined,
  mainData: Maindata
) => {

  const { user } = mainData.users;
  const { reportOption, selectedEnterpriseId } = mainData.report;
  const { startDate, endDate, firstReferenceId, secondReferenceId, schet } = reportOption;

  if (!isMatOborotSchet(schet)) {
    if (setMainData) {
      showMessage('ТМБ турини танланг', 'error', setMainData);
      setMainData('uploadingDashboard', false);
    }
    return;
  }

  const config = {
    headers: { Authorization: `Bearer ${user?.token}` }
  };

  let url = process.env.NEXT_PUBLIC_DOMAIN + '/api/reports/matOborot' + '?startDate=' + startDate + '&endDate=' + endDate + '&schet=' + schet;
  if (firstReferenceId) {
    url += '&sectionId=' + firstReferenceId;
  }
  if (secondReferenceId) {
    url += '&tmzId=' + secondReferenceId;
  }
  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    const enterpriseId = typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null 
      ? (selectedEnterpriseId as any)?.id 
      : selectedEnterpriseId;
    if (enterpriseId !== null && enterpriseId !== undefined && typeof enterpriseId === 'number') {
      url += '&enterpriseId=' + enterpriseId;
    }
  }

  axios.get(url, config)
    .then(function (response) {
      if (setMainData) {
        let newReportOptions: ReportOptions = {
          ...reportOption,
          startReport: true,
        }

        setMainData('reportOption', { ...newReportOptions });
        setMainData('matOborot', [...response.data]);
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

}
