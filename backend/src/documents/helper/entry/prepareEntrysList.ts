import { Document } from "src/documents/document.model";
import { hasTablePartInDocument } from "./hasDocumentTableType";
import { EntryCreationAttrs } from "src/entries/entry.model";
import { prepareEntry } from "./prepareEntry";
import { DocSTATUS, DocumentType } from "src/interfaces/document.interface";
import { ReferencesService } from "src/references/references.service";
import { SettingsService } from "src/settings/settings.service";
import { StocksService } from "src/stocks/stocks.service";

const appendEntries = (
  list: Array<EntryCreationAttrs>,
  entry: EntryCreationAttrs | EntryCreationAttrs[] | null,
) => {
  if (!entry) {
    return;
  }
  if (Array.isArray(entry)) {
    list.push(...entry);
  } else {
    list.push(entry);
  }
};

export const prepareEntrysList = async (
  document: Document,
  isGlobalDocument: boolean,
  isSender: boolean,
  referencesService: ReferencesService,
  settingsService: SettingsService,
  stocksService?: StocksService,
  force: boolean = false,
): Promise<Array<EntryCreationAttrs>> => {
  const results: Array<EntryCreationAttrs> = [];

  if (document.documentType === DocumentType.OrderToolsToClient) {
    return results;
  }

  console.log(
    `[prepareEntrysList] Start: docId=${document.id}, documentType=${document.documentType}, isGlobalDocument=${isGlobalDocument}, isSender=${isSender}, hasTableItems=${!!document.docTableItems?.length}, docStatus=${document.docStatus}, force=${force}`,
  );

  if (document) {
    if (document.docStatus != DocSTATUS.PROVEDEN || force) {
      if (hasTablePartInDocument(document.documentType)) {
        if (document.docTableItems && document.docTableItems.length > 0) {
          for (const tableItem of document.docTableItems) {
            if (tableItem !== null) {
              const entry = await prepareEntry(
                document,
                "primaryEntry",
                tableItem,
                isGlobalDocument,
                isSender,
                referencesService,
                settingsService,
                stocksService,
              );
              appendEntries(results, entry);

              if (
                document.documentType === DocumentType.LeaveOS ||
                document.documentType === DocumentType.SaleOS
              ) {
                const crossEntry = await prepareEntry(
                  document,
                  "crossEntry",
                  tableItem,
                  isGlobalDocument,
                  isSender,
                  referencesService,
                  settingsService,
                  stocksService,
                );
                appendEntries(results, crossEntry);
              }

              // Продажа товаров в TransferToolsToClient — выручка S40/S90
              if (
                document.documentType === DocumentType.TransferToolsToClient &&
                tableItem.tableType === "sale"
              ) {
                const saleRevenueEntry = await prepareEntry(
                  document,
                  "crossEntry",
                  tableItem,
                  isGlobalDocument,
                  isSender,
                  referencesService,
                  settingsService,
                  stocksService,
                );
                appendEntries(results, saleRevenueEntry);
              }

              // Продажа товаров в ReceiveToolsFromClient — выручка S40/S90
              if (
                document.documentType === DocumentType.ReceiveToolsFromClient &&
                tableItem.tableType === "tovar"
              ) {
                const tovarRevenueEntry = await prepareEntry(
                  document,
                  "crossEntry",
                  tableItem,
                  isGlobalDocument,
                  isSender,
                  referencesService,
                  settingsService,
                  stocksService,
                );
                appendEntries(results, tovarRevenueEntry);
              }

              // Доход аренды по строке возврата — Dt40–Ct90 с toolId
              if (
                document.documentType ===
                  DocumentType.ReceiveToolsFromClient &&
                (tableItem.tableType || "return") === "return"
              ) {
                const rentalRowEntry = await prepareEntry(
                  document,
                  "crossEntry",
                  tableItem,
                  isGlobalDocument,
                  isSender,
                  referencesService,
                  settingsService,
                  stocksService,
                );
                appendEntries(results, rentalRowEntry);
              }

              // Субаренда: доход клиента + себестоимость партнёра
              if (
                document.documentType ===
                  DocumentType.ReceiveSubleaseToolsFromClient &&
                (tableItem.tableType || "return") === "return"
              ) {
                const subleaseRowEntry = await prepareEntry(
                  document,
                  "crossEntry",
                  tableItem,
                  isGlobalDocument,
                  isSender,
                  referencesService,
                  settingsService,
                  stocksService,
                );
                appendEntries(results, subleaseRowEntry);
              }
            }

            if (
              document.documentType == DocumentType.SaleProd ||
              document.documentType == DocumentType.SaleMaterial ||
              document.documentType == DocumentType.SaleTovar ||
              document.documentType == DocumentType.SaleTools
            ) {
              const entry = await prepareEntry(
                document,
                "crossEntry",
                tableItem,
                isGlobalDocument,
                isSender,
                referencesService,
                settingsService,
                stocksService,
              );
              appendEntries(results, entry);
            }
          }
        }

        if (
          document.documentType === DocumentType.TransferToolsToClient ||
          document.documentType === DocumentType.TransferSubleaseToolsToClient ||
          document.documentType === DocumentType.SaleTovar ||
          document.documentType === DocumentType.SaleTools
        ) {
          const advanceEntry = await prepareEntry(
            document,
            "crossEntry",
            null,
            isGlobalDocument,
            isSender,
            referencesService,
            settingsService,
            stocksService,
          );
          appendEntries(results, advanceEntry);

          if (document.documentType === DocumentType.TransferToolsToClient) {
            const deliveryEntry = await prepareEntry(
              document,
              "deliveryEntry",
              null,
              isGlobalDocument,
              isSender,
              referencesService,
              settingsService,
              stocksService,
            );
            appendEntries(results, deliveryEntry);

            const defectCostEntry = await prepareEntry(
              document,
              "defectCostEntry",
              null,
              isGlobalDocument,
              isSender,
              referencesService,
              settingsService,
              stocksService,
            );
            appendEntries(results, defectCostEntry);
          }
        }

        if (
          document.documentType === DocumentType.ReceiveToolsFromClient ||
          document.documentType === DocumentType.ReceiveSubleaseToolsFromClient
        ) {
          const paymentEntries = await prepareEntry(
            document,
            "thirdEntry",
            null,
            isGlobalDocument,
            isSender,
            referencesService,
            settingsService,
            stocksService,
          );
          appendEntries(results, paymentEntries);

          if (document.documentType === DocumentType.ReceiveToolsFromClient) {
            const mediatorEntry = await prepareEntry(
              document,
              "fourthEntry",
              null,
              isGlobalDocument,
              isSender,
              referencesService,
              settingsService,
              stocksService,
            );
            appendEntries(results, mediatorEntry);

            const deliveryEntry = await prepareEntry(
              document,
              "deliveryEntry",
              null,
              isGlobalDocument,
              isSender,
              referencesService,
              settingsService,
              stocksService,
            );
            appendEntries(results, deliveryEntry);

            const defectCostEntry = await prepareEntry(
              document,
              "defectCostEntry",
              null,
              isGlobalDocument,
              isSender,
              referencesService,
              settingsService,
              stocksService,
            );
            appendEntries(results, defectCostEntry);
          }
        }
      } else {
        const entry = await prepareEntry(
          document,
          "primaryEntry",
          null,
          isGlobalDocument,
          isSender,
          referencesService,
          settingsService,
          stocksService,
        );
        appendEntries(results, entry);
      }
    }
  }

  console.log(
    `[prepareEntrysList] End: docId=${document?.id}, documentType=${document?.documentType}, isSender=${isSender}, entriesCount=${results.length}`,
  );

  return results;
};
