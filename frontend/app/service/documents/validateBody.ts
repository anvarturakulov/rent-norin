import {
  DocumentModel,
  DocumentType,
  documentsWithTableItems,
  getIncomeItems,
  getReturnItems,
  getSaleItems,
  getTovarItems,
} from "../../interfaces/document.interface";
import { getReceiveToolsCopyRemainQty } from '@/app/service/documents/copyReceiveToolsFromReturn';
import { advanceLineError, filterAdvanceLines } from './advanceLines';

/** Строки таблицы с выбранным ТМЗ (без пустых placeholder). */
export const getFilledDocTableItems = (docTableItems: DocumentModel['docTableItems']) =>
  (docTableItems || []).filter((item) => Number(item.analiticId) > 0);

export const getValidateBodyError = (body: DocumentModel): string | null => {
  const { date, documentType, docTableItems } = body;
  const {
    analiticId,
    senderId,
    receiverId,
    total,
    count,
    orderId,
    workId,
  } = body.docValues || {};

  if (!date || date <= 0) {
    return 'Хужжат санасини киритинг';
  }
  if (!documentType || documentType === DocumentType.Error) {
    return 'Хужжат тури аниқ эмас';
  }

  if (documentType === DocumentType.GateIncome) {
    const { carId } = body.docValues || {};
    if (!carId || carId === 0) {
      return 'Автомашинани танланг';
    }
    return null;
  }

  if (documentType === DocumentType.Advance) {
    if (!senderId || !analiticId || analiticId <= 0 || !total) {
      return 'Касса, ходим ва суммани тўлдиринг';
    }
    const lines = filterAdvanceLines(docTableItems);
    for (let index = 0; index < lines.length; index += 1) {
      const lineError = advanceLineError(lines[index], index);
      if (lineError) return lineError;
    }
    return null;
  }

  if (documentType === DocumentType.ZpCalculate) {
    if (!receiverId || !analiticId || analiticId <= 0 || !total) {
      return 'Олувчи, ходим ва суммани тўлдиринг';
    }
    return null;
  }

  if (documentType === DocumentType.ServicesToClients) {
    if (!senderId || !receiverId || !analiticId || analiticId <= 0 || !total) {
      return 'Жўнатувчи бўлим, мижоз, хизмат тури ва суммани тўлдиринг';
    }
    return null;
  }

  if (documentType === DocumentType.AmortizasiyaOS) {
    if (!senderId) {
      return 'Омбор (ОС)ни танланг';
    }
  } else if (!senderId || !receiverId) {
    return 'Жўнатувчи ва қабул қилувчини танланг';
  }

  if (
    senderId === receiverId &&
    documentType !== DocumentType.LeaveMaterial &&
    documentType !== DocumentType.LeaveTools &&
    documentType !== DocumentType.LeaveTovar &&
    documentType !== DocumentType.LeaveOnlyOneMaterial &&
    documentType !== DocumentType.AmortizasiyaOS
  ) {
    return 'Олувчи ва жунатувчи бир хил бўлмайди';
  }

  if (documentsWithTableItems.includes(documentType) && documentType !== DocumentType.SaleProd && documentType !== DocumentType.SaleMaterial && documentType !== DocumentType.SaleTovar && documentType !== DocumentType.SaleTools && documentType !== DocumentType.TransferToolsToClient && documentType !== DocumentType.OrderToolsToClient && documentType !== DocumentType.ReceiveToolsFromClient && documentType !== DocumentType.TransferSubleaseToolsToClient && documentType !== DocumentType.ReceiveSubleaseToolsFromClient) {
    const filledItems = getFilledDocTableItems(docTableItems);
    if (!filledItems.length) {
      return 'Жадвалга камида битта асосий восита қўшинг';
    }
    for (const item of filledItems) {
      if (Number(item.count) <= 0) {
        return 'Жадвалда миқдор нотўғри (0 дан катта бўлиши керак)';
      }
      if (Number(item.price) <= 0) {
        return 'Жадвалда нархни киритинг (асосий восита учун нарх мажбурий)';
      }
      if (Number(item.total) <= 0) {
        return 'Жадвалда сумма нотўғри';
      }
    }
  }

  if (!documentsWithTableItems.includes(documentType)) {
    if (!total) {
      return 'Суммани киритинг';
    }
  }

  if (documentType === DocumentType.LeaveOnlyOneMaterial) {
    const remainCount = Number(body.docValues?.remainCount || 0);
    const countValue = Number(count || 0);
    if (countValue > remainCount) {
      return `Миқдор қолдиқдан (${remainCount}) ортиқ бўлмаслиги керак`;
    }
    if (!body.docValues?.productForChargeId || body.docValues.productForChargeId <= 0) {
      return 'Харажат учун материални танланг';
    }
    if (!orderId || orderId <= 0 || !workId || workId <= 0) {
      return 'Буюртма ва ишни танланг';
    }
  }

  if (documentType === DocumentType.OrderToolsToClient) {
    const allFilled = getFilledDocTableItems(docTableItems);
    const toolItems = getIncomeItems(allFilled);
    if (!toolItems.length) {
      return 'Жадвалга ускуна қўшинг';
    }
    for (const item of toolItems) {
      if (Number(item.count) <= 0) {
        return 'Ускуналар жадвалида миқдор нотўғри';
      }
    }
    return null;
  }

  if (documentType === DocumentType.TransferToolsToClient) {
    const allFilled = getFilledDocTableItems(docTableItems);
    const toolItems = getIncomeItems(allFilled);
    const saleItems = getSaleItems(allFilled);

    if (!toolItems.length && !saleItems.length) {
      return 'Жадвалга ускуна ёки товар қўшинг';
    }

    if (toolItems.length > 0) {
      const settlementDate = Number(body.docValues?.settlementDate || 0);
      if (!settlementDate || settlementDate <= 0) {
        return 'Ҳисоблаш санасини киритинг';
      }
      for (const item of toolItems) {
        if (Number(item.count) <= 0) {
          return 'Ускуналар жадвалида миқдор нотўғри';
        }
        if (Number(item.costTotal) <= 0) {
          return 'Ускуналар жадвалида себестоимость топилмади';
        }
      }
    }

    for (const item of saleItems) {
      if (Number(item.count) <= 0) {
        return 'Товарлар жадвалида миқдор нотўғри';
      }
      if (Number(item.total) <= 0) {
        return 'Товарлар жадвалида сотиш суммаси топилмади';
      }
      if (Number(item.costTotal) <= 0) {
        return 'Товарлар жадвалида себестоимость топилмади';
      }
    }

    const deliverySum = Number(body.docValues?.deliverySum || 0);
    if (deliverySum > 0 && !Number(body.docValues?.delivererId || 0)) {
      return 'Доставка учун доставщикни танланг';
    }
    return null;
  }

  if (documentType === DocumentType.ReceiveToolsFromClient) {
    const returnDateTime =
      Number(body.docValues?.returnDateTime) || Number(date);
    if (!returnDateTime || returnDateTime <= 0) {
      return 'Дату и время возврата укажите';
    }
    const hasRows = getFilledDocTableItems(docTableItems).length > 0;
    if (!hasRows) {
      return 'Жадвални тўлдиринг ёки «Тулдириш» тугмасини босинг';
    }
    const allItems = docTableItems || [];
    for (const returnItem of getReturnItems(allItems)) {
      const rentSum = Number(returnItem.rentSum) || 0;
      const price = Number(returnItem.price) || 0;
      if (price < -0.0001 || price - rentSum > 0.0001) {
        return 'Скидка ижара суммасидан ошмаслиги керак';
      }
      if (!returnItem.sourceTransferDocId || !returnItem.analiticId) continue;
      const remain = getReceiveToolsCopyRemainQty(returnItem, allItems);
      if (remain < -0.0001) {
        return 'Брак/сотиш miqdori qaytarish miqdoridan oshib ketdi';
      }
    }
    const deliverySum = Number(body.docValues?.deliverySum || 0);
    if (deliverySum > 0 && !Number(body.docValues?.delivererId || 0)) {
      return 'Доставка учун доставщикни танланг';
    }
    for (const saleItem of getSaleItems(allItems)) {
      const price = Number(saleItem.price) || 0;
      const costPrice = Number(saleItem.costPrice) || 0;
      if (price < costPrice - 0.0001) {
        return 'Мижозга сотиш: нарх себестоимостьдан паст бўлмаслиги керак';
      }
    }
    for (const tovarItem of getTovarItems(allItems)) {
      if (Number(tovarItem.count) <= 0) {
        return 'Товарлар жадвалида миқдор нотўғри';
      }
      if (Number(tovarItem.total) <= 0) {
        return 'Товарлар жадвалида сотиш суммаси топилмади';
      }
      if (Number(tovarItem.costTotal) <= 0) {
        return 'Товарлар жадвалида себестоимость топилмади';
      }
    }
    return null;
  }

  if (documentType === DocumentType.TransferSubleaseToolsToClient) {
    if (!senderId || !receiverId) {
      return 'Ҳамкор омбори ва мижозни танланг';
    }
    if (!Number(body.docValues?.partnerId || 0)) {
      return 'Омборда ҳамкор кўрсатилмаган';
    }
    const settlementDate = Number(body.docValues?.settlementDate || 0);
    if (!settlementDate || settlementDate <= 0) {
      return 'Ҳисоблаш санасини киритинг';
    }
    const toolItems = getFilledDocTableItems(docTableItems);
    if (!toolItems.length) {
      return 'Жадвалга ускуна қўшинг';
    }
    for (const item of toolItems) {
      if (Number(item.count) <= 0) {
        return 'Ускуналар жадвалида миқдор нотўғри';
      }
    }
    return null;
  }

  if (documentType === DocumentType.ReceiveSubleaseToolsFromClient) {
    if (!senderId || !receiverId) {
      return 'Мижоз ва ҳамкор омборини танланг';
    }
    if (!Number(body.docValues?.partnerId || 0)) {
      return 'Омборда ҳамкор кўрсатилмаган';
    }
    const returnDateTime =
      Number(body.docValues?.returnDateTime) || Number(date);
    if (!returnDateTime || returnDateTime <= 0) {
      return 'Дату и время возврата укажите';
    }
    const hasRows = getFilledDocTableItems(docTableItems).length > 0;
    if (!hasRows) {
      return 'Жадвални тўлдиринг ёки «Тулдириш» тугмасини босинг';
    }
    return null;
  }

  if (documentType === DocumentType.LeaveCash) {
    if (!senderId || !analiticId || analiticId <= 0 || !total || !receiverId) {
      return 'Касса хужжати майдонларини тўлдиринг';
    }
  }

  if (documentType === DocumentType.SaleTools) {
    if (!senderId || !receiverId) {
      return 'Жунатувчи склад ва мижозни танланг';
    }
    const filledItems = getFilledDocTableItems(docTableItems);
    if (!filledItems.length) {
      return 'Жадвалга камида битта ускуна қўшинг';
    }
    for (const item of filledItems) {
      if (Number(item.count) <= 0) {
        return 'Жадвалда миқдор нотўғри (0 дан катта бўлиши керак)';
      }
      if (Number(item.total) <= 0) {
        return 'Жадвалда сотиш суммасини киритинг';
      }
    }
  }

  if (documentType === DocumentType.SaleMaterial) {
    if (!senderId || !receiverId) {
      return 'Жунатувчи склад ва олувчини танланг';
    }
    const filledItems = getFilledDocTableItems(docTableItems);
    if (!filledItems.length) {
      return 'Жадвалга камида битта хом ашё қўшинг';
    }
    for (const item of filledItems) {
      if (Number(item.count) <= 0) {
        return 'Жадвалда миқдор нотўғри (0 дан катта бўлиши керак)';
      }
      if (Number(item.total) <= 0) {
        return 'Жадвалда сотиш суммасини киритинг';
      }
    }
  }

  return null;
};

export const validateBody = (body: DocumentModel): Boolean =>
  getValidateBodyError(body) === null;
