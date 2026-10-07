import { DocumentModel } from '@/app/interfaces/document.interface';
import { fetchReceiveToolsPreview } from '@/app/service/documents/fetchReceiveToolsPreview';
import { buildReceiveToolsReturnRow, getReceiveToolsReturnDateTime } from '@/app/service/documents/receiveToolsRent';
import { getReturnItems, getTovarItems } from '@/app/interfaces/document.interface';
import { showMessage } from '../common/showMessage';

export const FILL_RECEIVE_TOOLS_CONFIRM =
  'Жадваллар (кабул, брак, сотиш) тозаланади ва кабул қисми тўлдирилади. Товар сотиш қаторлари сақланади. Давом этасизми?';

const hasFilledTableRows = (docTableItems: DocumentModel['docTableItems']) =>
  (docTableItems || []).some((item) => Number(item.analiticId) > 0);

export const fillReceiveToolsTable = async (
  currentDocument: DocumentModel,
  setMainData: Function | undefined,
  token: string | undefined,
  enterpriseId: number | null | undefined,
) => {
  const returnDateTime = getReceiveToolsReturnDateTime(currentDocument);
  const clientId = currentDocument?.docValues?.senderId;
  const warehouseId = currentDocument?.docValues?.receiverId;
  const isSublease =
    currentDocument?.documentType === 'ReceiveSubleaseToolsFromClient';

  if (!clientId || !returnDateTime || (!isSublease && !warehouseId)) {
    showMessage(
      isSublease
        ? 'Клиент и дата возврата обязательны'
        : 'Клиент, склад и дата возврата обязательны',
      'error',
      setMainData,
    );
    return;
  }

  const hasExistingRows = hasFilledTableRows(currentDocument.docTableItems);
  if (hasExistingRows && !window.confirm(FILL_RECEIVE_TOOLS_CONFIRM)) {
    return;
  }

  try {
    const returnRows = await fetchReceiveToolsPreview(currentDocument, token, enterpriseId);
    if (!returnRows.length) {
      showMessage('У клиента нет открытых ускуналар', 'error', setMainData);
      return;
    }

    const normalizedReturnRows = returnRows.map((row) =>
      buildReceiveToolsReturnRow(row, Number(row.count) || 0, returnDateTime),
    );

    const tovarItems = getTovarItems(currentDocument.docTableItems || []);

    setMainData?.('currentDocument', {
      ...currentDocument,
      docTableItems: [...normalizedReturnRows, ...tovarItems],
    });
  } catch (error: any) {
    showMessage(
      error?.response?.data?.message || error.message || 'Ошибка',
      'error',
      setMainData,
    );
  }
};

export const getTotalRentFromReturnRows = (items: DocumentModel['docTableItems']) =>
  getReturnItems(items || []).reduce((s, r) => s + (Number(r.total) || 0), 0);
