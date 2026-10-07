import { showMessage } from '../common/showMessage';
import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';
import { isGlobalRole } from '@/app/utils/roleHelpers';

export type GetInformationOptions = {
  firstSubcontoId?: number | null;
};

export const getInformation = (
  setMainData: Function | undefined, 
  mainData: Maindata,
  endDate?: number,
  options?: GetInformationOptions,
  ) => {
    console.log('📡 [getInformation] Начало загрузки данных');
  
  const { user } = mainData.users
  const { interval } = mainData.journal
  const { dashboardCurrentReportType, selectedEnterpriseId } = mainData.report
  let reportType = dashboardCurrentReportType
  
  const backendReportType = reportType;
  const hasEndDateOverride =
    endDate !== undefined && endDate !== null && Number(endDate) > 0;
  const effectiveEndDate = hasEndDateOverride
    ? Number(endDate)
    : interval.dateEnd;
  const effectiveStartDate = hasEndDateOverride
    ? Math.min(Number(interval.dateStart) || 0, effectiveEndDate)
    : interval.dateStart;
  
  const config = {
    headers: { Authorization: `Bearer ${user?.token}` }
  };

  setMainData && setMainData('uploadingDashboard', true)

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/information' +
    '?startDate=' +
    effectiveStartDate +
    '&endDate=' +
    effectiveEndDate +
    '&reportType=' +
    backendReportType +
    '&user=' +
    user?.name;
  
  console.log('📡 [getInformation] URL:', url);
  
  // enterpriseId: выбранная корхона; «Барча корхоналар» (null) для GLOBAL/superKassir — без фильтра
  const canSelectEnterprise =
    !!(user?.role && isGlobalRole(user.role)) || user?.superKassir === true;
  const rawSelected =
    selectedEnterpriseId !== null && selectedEnterpriseId !== undefined
      ? typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
        ? (selectedEnterpriseId as { id?: number }).id
        : selectedEnterpriseId
      : null;
  let enterpriseId =
    rawSelected !== null && rawSelected !== undefined && Number(rawSelected) > 0
      ? Number(rawSelected)
      : null;
  if (
    enterpriseId == null &&
    !canSelectEnterprise &&
    user?.enterpriseId != null &&
    Number(user.enterpriseId) > 0
  ) {
    enterpriseId = Number(user.enterpriseId);
  }
  if (enterpriseId != null) {
    url += '&enterpriseId=' + enterpriseId;
  }

  if (
    options?.firstSubcontoId != null &&
    Number(options.firstSubcontoId) > 0
  ) {
    url += '&firstSubcontoId=' + Number(options.firstSubcontoId);
  }
  
  axios.get(url, config)
    .then(function (response) {
      if (setMainData && !response.data?.user) {
        setMainData('informData', [ ...response.data ]);
        setMainData && setMainData('uploadingDashboard', false)
      } else {
      }
    })
    .catch(function (error) {
      console.error('❌ [getInformation] Ошибка:', error);
      if (setMainData) {
        setMainData('uploadingDashboard', false);
        showMessage(error.message, 'error', setMainData)
      }
    });

  setMainData && setMainData('loading', false);

}