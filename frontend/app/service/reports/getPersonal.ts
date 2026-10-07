import { showMessage } from '../common/showMessage';
import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';
import { ReportOptions, Schet } from '@/app/interfaces/report.interface';

export const getPersonal = (
  setMainData: Function | undefined,
  mainData: Maindata
) => {

  const {report, users} = mainData
  const { reportOption, selectedEnterpriseId } = report;
  const {firstReferenceId} = reportOption
  const {user} = users

  const { startDate, endDate, schet } = reportOption;

  const config = {
    headers: { Authorization: `Bearer ${user?.token}` }
  };
  let url = process.env.NEXT_PUBLIC_DOMAIN + '/api/reports/personal' + '?startDate=' + startDate + '&endDate='+endDate;
  
  if (firstReferenceId) url = url + '&firstSubcontoId='+firstReferenceId
  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    // Извлекаем ID, если selectedEnterpriseId является объектом
    const enterpriseId = typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null 
      ? (selectedEnterpriseId as any)?.id 
      : selectedEnterpriseId;
    // Добавляем в URL только если это валидное число
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
        setMainData('personal', response.data);
        setMainData('uploadingDashboard', false);
      }

    })
    .catch(function (error) {
      if (setMainData) {
        showMessage(error.message, 'error', setMainData)
      }
    });

  setMainData && setMainData('loading', false);

}