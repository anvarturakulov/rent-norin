import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { EntryCreationAttrs } from "src/entries/entry.model";
import { getValuesForEntry } from "./getValuesForEntry";
import { ReferencesService } from "src/references/references.service";
import { SettingsService } from "src/settings/settings.service";
import { StocksService } from "src/stocks/stocks.service";
import { DocumentType } from "src/interfaces/document.interface";

// Документы списания и отгрузки, для которых orderId сохраняется на проводке.
// Пустой orderId сохраняется как NULL = общие/накладные расходы или продажа без заказа.
const ORDER_AWARE_DOCUMENT_TYPES = new Set<DocumentType>([
  DocumentType.LeaveCash,
  DocumentType.LeaveMaterial,
  DocumentType.LeaveTools,
  DocumentType.LeaveTovar,
  DocumentType.LeaveOnlyOneMaterial,
  DocumentType.AmortizasiyaOS,
  DocumentType.ZpCalculate,
  DocumentType.ServicesFromPartners,
  DocumentType.ServicesToClients,
  DocumentType.LeaveOS,
  DocumentType.LeaveHalfstuff,
  DocumentType.ComeProduct,
  DocumentType.SaleProd,
  DocumentType.SaleTovar,
  DocumentType.SaleTools,
]);

export const prepareEntry = async (
  doc: Document,
  entryType:
    | "primaryEntry"
    | "crossEntry"
    | "thirdEntry"
    | "fourthEntry"
    | "deliveryEntry"
    | "defectCostEntry",
  tableItem: DocTableItems | null,
  isGlobalDocument: boolean,
  isSender: boolean,
  referencesService: ReferencesService,
  settingsService: SettingsService,
  stocksService?: StocksService,
): Promise<EntryCreationAttrs | EntryCreationAttrs[] | null> => {
  const docDescription = doc.docValues?.comment
    ? doc.docValues.comment.substring(0, 255)
    : "";
  const entryValues = await getValuesForEntry(
    doc,
    entryType,
    tableItem,
    isGlobalDocument,
    isSender,
    referencesService,
    settingsService,
    stocksService,
  );
  // Если getValuesForEntry возвращает null, возвращаем null
  if (!entryValues) {
    return null;
  }

  // Заказ как сквозная аналитика: для документов списания и отгрузки.
  // Пусто / 0 -> NULL (общие расходы или продажа без заказа).
  const rawOrderId = doc.docValues?.orderId;
  const orderId = ORDER_AWARE_DOCUMENT_TYPES.has(doc.documentType)
    ? rawOrderId != null && rawOrderId > 0
      ? rawOrderId
      : null
    : null;

  // Если getValuesForEntry возвращает массив проводок, маппим каждую
  if (Array.isArray(entryValues)) {
    return entryValues.map((entryValue) => {
      const description =
        entryValue.description !== undefined && entryValue.description !== null
          ? entryValue.description
          : docDescription;

      return {
        ...entryValue,
        date: doc.date,
        documentType: doc.documentType,
        docId: doc.id,
        description,
        fullDescription: entryValue.fullDescription ?? description,
        orderId,
      };
    });
  }

  // Если entryValues - одиночный объект, возвращаем одну проводку
  const description =
    entryValues.description !== undefined && entryValues.description !== null
      ? entryValues.description
      : docDescription;

  return {
    ...entryValues,
    date: doc.date,
    documentType: doc.documentType,
    docId: doc.id,
    description,
    fullDescription: entryValues.fullDescription ?? description,
    orderId,
  };
};
