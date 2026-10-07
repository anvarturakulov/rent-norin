import { DocTableItemDto } from "src/documents/dto/docTableItem.dto";
import { DocValuesDto } from "src/documents/dto/docValues.dto";
import { UpdateCreateDocumentDto } from "src/documents/dto/updateCreateDocument.dto";
import { DocSTATUS } from "src/interfaces/document.interface";

export const convertJsonDocs = (jsonRow: any): UpdateCreateDocumentDto => {
  const docTableItems: DocTableItemDto[] = [];
  if (jsonRow.tableItems && jsonRow.tableItems.length) {
    const docTItems = [...jsonRow.tableItems];
    if (docTItems && docTItems.length) {
      for (const item of docTItems) {
        const result: DocTableItemDto = {
          docId: BigInt(1),
          analiticId: 13957,
          balance: item.balance,
          count: item.count,
          price: item.price,
          total: item.total,
          costPrice: item.costPrice || 0, // Используем costPrice из данных или 0
          costTotal: item.costTotal || 0, // Используем costTotal из данных или 0
          countByBox: item.countByBox || undefined, // Используем countByBox из данных или undefined
        };
        if (result) docTableItems.push(result);
      }
    }
  }

  const docValues: DocValuesDto = {
    docId: BigInt(1),
    senderId: 13957,
    receiverId: 13957,
    analiticId: 13957,
    productForChargeId: 13957,
    isWorker: jsonRow.isWorker,
    isPartner: jsonRow.isPartner,
    isClient: jsonRow.isClient,
    isDepartment: jsonRow.isDepartment,
    isFounder: jsonRow.isFounder,
    count: jsonRow.count,
    price: jsonRow.price,
    total: jsonRow.total,
    cashFromPartner: jsonRow.jsonRow,
    comment: jsonRow.comment,
    currency: jsonRow.currency,
    usd: jsonRow.usd,
  };
  const doc: UpdateCreateDocumentDto = {
    date: jsonRow.date,
    userId: 13,
    userOldId: jsonRow.user,
    documentType: jsonRow.documentType,
    docStatus: jsonRow?.deleted == true ? DocSTATUS.DELETED : DocSTATUS.OPEN,
    docValues: { ...docValues },
    docTableItems: [...docTableItems],
  };

  return doc;
};
