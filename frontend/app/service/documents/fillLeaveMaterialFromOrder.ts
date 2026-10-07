import { DocSTATUS, DocTableItem, DocumentModel, getLeaveMaterialCatalogItems } from '@/app/interfaces/document.interface';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { getMaterialCostPriceClient } from '@/app/service/productCalculations/calculateMaterialsClient';
import { resolveOrderMaterialWriteoffQty } from '@/app/components/furnitureOrders/productionWorkBoard/workExecutionHelpers';
import { showMessage } from '../common/showMessage';

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const fillLeaveMaterialFromOrder = async (
  currentDocument: DocumentModel,
  setMainData: Function | undefined,
  token: string | undefined,
  enterpriseId: number | null | undefined,
) => {
  if (!token) {
    showMessage('Нет авторизации', 'error', setMainData);
    return;
  }
  if (currentDocument?.docStatus !== DocSTATUS.OPEN) {
    showMessage('Заполнение доступно только для открытого документа', 'error', setMainData);
    return;
  }

  const orderId = Number(currentDocument?.docValues?.orderId || 0);
  const senderId = Number(currentDocument?.docValues?.senderId || 0);
  const docDate = Number(currentDocument?.date || 0);

  if (!orderId) {
    showMessage('Выберите заказ', 'error', setMainData);
    return;
  }
  if (!senderId) {
    showMessage('Выберите склад отправителя', 'error', setMainData);
    return;
  }
  if (!docDate) {
    showMessage('Укажите дату документа', 'error', setMainData);
    return;
  }

  const existingCatalog = getLeaveMaterialCatalogItems(currentDocument.docTableItems || []);
  if (existingCatalog.length > 0) {
    const ok = window.confirm(
      'Таблица уже содержит строки. Заменить их материалами выбранного заказа?',
    );
    if (!ok) return;
  }

  try {
    const orderMaterials = await foApi.getMaterialsByOrder(token, orderId);
    if (!orderMaterials?.length) {
      showMessage('У заказа нет материалов', 'error', setMainData);
      return;
    }

    const otherItems = (currentDocument.docTableItems || []).filter(
      (item) =>
        item.tableType === 'return' ||
        item.tableType === 'brak' ||
        item.tableType === 'sale' ||
        item.tableType === 'tovar',
    );

    let cappedCount = 0;
    let noStockCount = 0;

    const filledRows: DocTableItem[] = await Promise.all(
      orderMaterials.map(async (m) => {
        const materialId = Number(m.materialId);
        const planned = round3(resolveOrderMaterialWriteoffQty(m));
        const { costPrice, balance } = await getMaterialCostPriceClient(
          docDate,
          materialId,
          senderId,
          token,
          enterpriseId ?? undefined,
        );
        const safeBalance = Math.max(0, Number(balance) || 0);
        const price = Number(costPrice) || Number(m.price) || 0;
        const count = round3(Math.min(planned, safeBalance));
        const total = round2(count * price);

        if (planned > 0 && safeBalance <= 0) noStockCount += 1;
        else if (planned > count && count > 0) cappedCount += 1;

        return {
          analiticId: materialId,
          balance: safeBalance,
          count,
          price,
          total,
          costPrice: price,
          costTotal: total,
          plannedCount: planned,
        };
      }),
    );

    setMainData?.('currentDocument', {
      ...currentDocument,
      docTableItems: [...filledRows, ...otherItems],
    });

    const parts = [`Заполнено строк: ${filledRows.length}`];
    if (cappedCount > 0) parts.push(`урезано по остатку: ${cappedCount}`);
    if (noStockCount > 0) parts.push(`без остатка: ${noStockCount}`);
    showMessage(parts.join('; '), 'success', setMainData);
  } catch (error: any) {
    showMessage(
      error?.message || 'Ошибка заполнения из заказа',
      'error',
      setMainData,
    );
  }
};
