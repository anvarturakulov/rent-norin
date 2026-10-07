import { Maindata } from '@/app/context/app.context.interfaces';
import { ReportType } from '@/app/interfaces/report.interface';
import { showMessage } from '@/app/service/common/showMessage';
import { getMatOborot } from './getMatOborot';
import { getOsOborot } from './getOsOborot';
import { getOborotka } from './getOborotka';
import { getPersonal } from './getPersonal';
import { getMediatorPersonal } from './getMediatorPersonal';
import { getDelivererPersonal } from './getDelivererPersonal';
import { getClients } from './getClients';
import { getAktSverka } from './getAktSverka';

export const generateSimpleReport = (
  setMainData: Function | undefined,
  mainData: Maindata,
) => {
  const { contentName } = mainData.document;
  const { reportOption } = mainData.report;
  const { startDate, endDate, firstReferenceId } = reportOption;

  if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
    showMessage('Санани тулдиринг', 'error', setMainData);
    return;
  }

  if (startDate > endDate) {
    showMessage('Бошлангич сана охирги санадан катта бўлмаслиги керак', 'error', setMainData);
    return;
  }

  if (contentName == ReportType.AktSverka) {
    if (firstReferenceId === null || firstReferenceId === undefined || firstReferenceId === 0) {
      showMessage('Хамкорни танланг', 'error', setMainData);
      return;
    }
  }

  setMainData && setMainData('uploadingDashboard', true);

  if (contentName == ReportType.MatOborot) getMatOborot(setMainData, mainData);
  if (contentName == ReportType.OsOborot) getOsOborot(setMainData, mainData);
  if (contentName == ReportType.Oborotka) getOborotka(setMainData, mainData);
  if (contentName == ReportType.Personal) getPersonal(setMainData, mainData);
  if (contentName == ReportType.MediatorPersonal) getMediatorPersonal(setMainData, mainData);
  if (contentName == ReportType.DelivererPersonal) getDelivererPersonal(setMainData, mainData);
  if (contentName == ReportType.Clients) getClients(setMainData, mainData);
  if (contentName == ReportType.AktSverka) getAktSverka(setMainData, mainData);
};
