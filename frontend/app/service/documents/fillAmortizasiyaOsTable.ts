import axios from 'axios';
import { DocumentModel } from '@/app/interfaces/document.interface';
import { showMessage } from '../common/showMessage';

export const fillAmortizasiyaOsTable = async (
  currentDocument: DocumentModel,
  setMainData: Function | undefined,
  token: string | undefined,
  enterpriseId: number | null | undefined,
) => {
  const senderId = currentDocument?.docValues?.senderId;
  const docDate = currentDocument?.date;
  if (!senderId || !docDate) {
    showMessage('Склад (жунатувчи) ва санани танланг', 'error', setMainData);
    return;
  }
  if (!enterpriseId) {
    showMessage('Ташкилот танланмаган', 'error', setMainData);
    return;
  }

  const config = {
    headers: { Authorization: `Bearer ${token}` },
    params: { storageId: senderId, docDate },
  };

  try {
    const { data } = await axios.get(
      `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/amortizasiya-os/preview`,
      config,
    );
    const lines = Array.isArray(data) ? data : [];
    if (!lines.length) {
      showMessage('Амортизация учун ОС топилмади', 'error', setMainData);
      return;
    }
    setMainData?.('currentDocument', {
      ...currentDocument,
      docTableItems: lines,
    });
    showMessage(`${lines.length} та қатор тўлдирилди`, 'success', setMainData);
  } catch (error: any) {
    showMessage(
      error?.response?.data?.message || error.message || 'Хатолик',
      'error',
      setMainData,
    );
  }
};
