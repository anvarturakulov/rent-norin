import { mutate } from 'swr';
import { Maindata } from '@/app/context/app.context.interfaces';
import { DocumentType } from '@/app/interfaces/document.interface';
import { emptyReadyRentalOrders } from './rentalOrders';
import { fetchReadyRentalOrders, readyRentalOrdersKey } from './rentalOrdersApi';

const RENTAL_REFRESH_TYPES = new Set<string>([
  DocumentType.ReceiveToolsFromClient,
  DocumentType.TransferToolsToClient,
  DocumentType.OrderToolsToClient,
]);

export const maybeAlertReadyRentalOrders = async (
  mainData: Maindata,
  setMainData: Function | undefined,
  documentType?: DocumentType | string,
): Promise<void> => {
  if (!setMainData || !documentType || !RENTAL_REFRESH_TYPES.has(documentType)) {
    return;
  }
  const token = mainData.users.user?.token;
  const enterpriseId =
    mainData.report?.selectedEnterpriseId ??
    mainData.users.user?.enterpriseId ??
    null;
  try {
    const payload = await fetchReadyRentalOrders(token, enterpriseId);
    const next = payload.orders?.length ? payload : emptyReadyRentalOrders();
    setMainData('rentalReadyOrders', next);
    if (
      documentType === DocumentType.ReceiveToolsFromClient &&
      next.orders.length
    ) {
      setMainData('showReadyRentalOrdersModal', true);
    }
    const key = readyRentalOrdersKey(token, enterpriseId);
    if (key) {
      await mutate(key, next, false);
    }
  } catch (error) {
    console.error('Ready rental orders check failed', error);
  }
};
