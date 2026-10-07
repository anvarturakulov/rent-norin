import { useCallback, useMemo } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { adminAndHeadCompany } from '@/app/interfaces/user.interface';
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { MainData } from '../types';

export const useInform = () => {
  const { mainData } = useAppContext();
  const { uploadingDashboard } = mainData.window;
  const { user } = mainData.users;
  const { informData, dashboardCurrentReportType } = mainData.report;
  const { dateStart, dateEnd } = mainData.journal.interval;

  // Мемоизированные значения
  const dateStartInStr = useMemo(() => dateNumberToString(dateStart), [dateStart]);
  const dateEndInStr = useMemo(() => dateNumberToString(dateEnd), [dateEnd]);
  
  const isAdminOrHeadCompany = useMemo(() => {
    const role = user?.role;
    return role && adminAndHeadCompany.includes(role);
  }, [user?.role]);

  const showPdfButton = useMemo(() => {
    return dashboardCurrentReportType === 'All' && isAdminOrHeadCompany;
  }, [dashboardCurrentReportType, isAdminOrHeadCompany]);

  return {
    uploadingDashboard,
    user,
    informData,
    dashboardCurrentReportType,
    dateStartInStr,
    dateEndInStr,
    isAdminOrHeadCompany,
    showPdfButton,
  };
}; 