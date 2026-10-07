import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";

export const objectForEntry = (
  doc: Document,
  tableItem: DocTableItems | null,
  entryType:
    | "primaryEntry"
    | "crossEntry"
    | "thirdEntry"
    | "fourthEntry"
    | "deliveryEntry"
    | "defectCostEntry",
  isGlobalDocument: boolean,
  isSender: boolean,
) => {
  const {
    receiverId,
    senderId,
    analiticId: analiticIdRaw,
    productForChargeId,
    count,
    total,
    isPartner,
    isWorker,
    cashFromPartner,
    isDepartment,
    usd,
  } = doc.docValues;
  // Преобразуем analiticId из undefined в null для совместимости с типами
  const analiticId: number | null =
    analiticIdRaw !== undefined ? analiticIdRaw : null;

  const leaveMaterialWithTable = {
    debetFirstSubcontoId: receiverId,
    debetSecondSubcontoId: analiticId,
    debetThirdSubcontoId: productForChargeId,
    kreditFirstSubcontoId: senderId,
    kreditSecondSubcontoId:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.analiticId
        ? tableItem.analiticId
        : null,
    count:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.count
        ? tableItem.count
        : 0,
    total:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.total
        ? tableItem.total
        : 0,
    usd: usd || 0,
  };

  const tableOsOrMaterialId =
    tableItem !== null &&
    doc.docTableItems?.length &&
    entryType == "primaryEntry" &&
    Number(tableItem?.analiticId) > 0
      ? tableItem.analiticId
      : null;

  const comeMaterialWithTable = {
    debetFirstSubcontoId: receiverId,
    debetSecondSubcontoId: tableOsOrMaterialId,
    debetThirdSubcontoId: null,
    kreditFirstSubcontoId: senderId,
    kreditSecondSubcontoId: receiverId,
    count:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.count
        ? tableItem.count
        : 0,
    total:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.total
        ? tableItem.total
        : 0,
    usd: usd || 0,
  };

  const moveMaterialWithTable = {
    debetFirstSubcontoId: receiverId,
    debetSecondSubcontoId:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.analiticId
        ? tableItem.analiticId
        : null,
    debetThirdSubcontoId: null,
    kreditFirstSubcontoId: senderId,
    kreditSecondSubcontoId:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.analiticId
        ? tableItem.analiticId
        : null,
    count:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.count
        ? tableItem.count
        : 0,
    total:
      tableItem !== null &&
      doc.docTableItems?.length &&
      entryType == "primaryEntry" &&
      tableItem?.total
        ? tableItem.total
        : 0,
    usd: usd || 0,
  };

  return {
    leaveMaterialWithTable,
    comeMaterialWithTable,
    moveMaterialWithTable,
  };
};
