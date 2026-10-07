import { Schet } from "src/interfaces/report.interface";
import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocumentType } from "src/interfaces/document.interface";
import { objectForEntry } from "./objectForEntry";
import {
  TypeReference,
  TypeSECTION,
  TypeTMZ,
} from "src/interfaces/reference.interface";
import { ReferencesService } from "src/references/references.service";
import { SettingsService } from "src/settings/settings.service";
import { StocksService } from "src/stocks/stocks.service";
import {
  getOsAccumulatedDepreciationAtDate,
  resolveOsAmortizationChargeId,
  resolveOsAmortizationCommonStorageId,
} from "../osAmortization.helper";
import {
  resolveProductionReceiptHalfstuffChargeId,
  resolveProductionReceiptProductChargeId,
} from "../materialWriteoff.helper";
import { buildReceiveMediatorBonusEntry } from "../mediatorBonus.helper";
import { buildClientCashPaymentEntries } from "./buildClientCashPaymentEntries";

export interface ResultgetValuesForEntry {
  debet: Schet;
  debetFirstSubcontoId: number | null;
  debetSecondSubcontoId: number | null;
  debetThirdSubcontoId?: number | null;
  kredit: Schet;
  kreditFirstSubcontoId: number | null;
  kreditSecondSubcontoId: number | null;
  kreditThirdSubcontoId?: number | null;
  count: number;
  total: number;
  usd: number;
  description?: string;
  fullDescription?: string;
  targetEnterpriseId?: number | null;
}

// Константа даты для определения использования новых счетов (31 декабря 2024, 23:59:59 UTC)
const REMAIND_DATE = 1735671599000;

/**
 * Получает значение из tableItem, если оно существует
 */
const getTableItemValue = <T>(
  tableItem: DocTableItems | null,
  doc: Document,
  field: keyof DocTableItems,
  defaultValue: T,
): T => {
  if (
    tableItem !== null &&
    doc.docTableItems?.length &&
    tableItem[field] !== null &&
    tableItem[field] !== undefined
  ) {
    return tableItem[field] as T;
  }
  return defaultValue;
};

/**
 * Проверяет, нужно ли использовать новый счет на основе даты документа
 */
const shouldUseNewAccount = (docDate: bigint): boolean => {
  return docDate > REMAIND_DATE;
};

/**
 * Получает id COMMON справочника STORAGES по id другого справочника STORAGES того же предприятия
 * @param id - id справочника типа STORAGES (может быть null)
 * @param referencesService - сервис для работы со справочниками
 * @returns id справочника STORAGES с typeSection COMMON или null, если id был null
 * @throws Error если справочник не найден или отсутствует enterpriseId
 */
async function getCommonStorageIdByStorageId(
  id: number | null,
  referencesService: ReferencesService,
): Promise<number | null> {
  // Если id null, возвращаем null
  if (id === null) {
    return null;
  }

  // 1. Найти справочник по id
  const reference = await referencesService.getReferenceById(id);

  if (!reference || reference.typeReference !== TypeReference.STORAGES) {
    throw new Error(`Справочник STORAGES с id ${id} не найден`);
  }

  // 2. Получить enterpriseId организации
  const enterpriseId = reference.enterpriseId;

  if (enterpriseId == null || enterpriseId === undefined) {
    throw new Error(
      `У справочника STORAGES с id ${id} отсутствует enterpriseId`,
    );
  }

  // 3. Найти COMMON справочник с совпадающим enterpriseId
  const commonReference =
    await referencesService.findCommonStorageByEnterpriseId(enterpriseId);

  if (!commonReference) {
    throw new Error(
      `Не найден справочник STORAGES с typeSection COMMON для enterpriseId ${enterpriseId}`,
    );
  }

  return commonReference.id;
}

const parseNumberOrFallback = (value: any, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const TOOLS_RENT_PAYMENT_DESCRIPTION = "ускуна ижарасидан тушум";
const TOOLS_RENT_INCOME_DESCRIPTION = "ускуналарни ижарасидан даромад";
const TOOLS_CHANGE_TO_CLIENT_DESCRIPTION = "кайтим";
const SALE_TOVAR_PAYMENT_DESCRIPTION = "товар сотувидан тушум";
const SALE_TOOLS_PAYMENT_DESCRIPTION = "ускуна сотувидан тушум";
const TOOLS_DELIVERY_DESCRIPTION = "етказиб бериш хақи";
const TOOLS_DEFECT_COST_DESCRIPTION = "брак буйича харажат";

const buildToolsDeliveryEntry = (
  clientId: number | null | undefined,
  delivererId: number | null | undefined,
  deliverySum: number,
  fullDescriptionWithParties: string,
): ResultgetValuesForEntry | null => {
  if (deliverySum <= 0) {
    return null;
  }
  if (!clientId) {
    throw new Error("Доставка: не указан клиент");
  }
  if (!delivererId) {
    throw new Error("Доставка: не указан доставщик");
  }
  const description = TOOLS_DELIVERY_DESCRIPTION;
  const fullDescription = fullDescriptionWithParties
    ? `${TOOLS_DELIVERY_DESCRIPTION} | ${fullDescriptionWithParties}`.substring(
        0,
        255,
      )
    : description;
  return {
    debet: Schet.S40,
    kredit: Schet.S64,
    debetFirstSubcontoId: clientId,
    debetSecondSubcontoId: delivererId,
    kreditFirstSubcontoId: delivererId,
    kreditSecondSubcontoId: clientId,
    count: 0,
    total: deliverySum,
    usd: 0,
    description,
    fullDescription,
  };
};

const buildToolsDefectCostEntry = (
  clientId: number | null | undefined,
  warehouseId: number | null | undefined,
  defectCost: number,
  fullDescriptionWithParties: string,
): ResultgetValuesForEntry | null => {
  if (defectCost <= 0) {
    return null;
  }
  if (!clientId) {
    throw new Error("Брак буйича харажатлар: не указан клиент");
  }
  const description = TOOLS_DEFECT_COST_DESCRIPTION;
  const fullDescription = fullDescriptionWithParties
    ? `${TOOLS_DEFECT_COST_DESCRIPTION} | ${fullDescriptionWithParties}`.substring(
        0,
        255,
      )
    : description;
  return {
    debet: Schet.S40,
    kredit: Schet.S90,
    debetFirstSubcontoId: clientId,
    debetSecondSubcontoId: warehouseId ?? null,
    kreditFirstSubcontoId: warehouseId ?? clientId,
    kreditSecondSubcontoId: null,
    count: 0,
    total: defectCost,
    usd: 0,
    description,
    fullDescription,
  };
};

const buildToolsRentPaymentEntryDescription = (
  fullDescriptionWithParties: string,
): { description: string; fullDescription: string } => {
  const description = TOOLS_RENT_PAYMENT_DESCRIPTION;
  const fullDescription = fullDescriptionWithParties
    ? `${TOOLS_RENT_PAYMENT_DESCRIPTION} | ${fullDescriptionWithParties}`.substring(
        0,
        255,
      )
    : description;
  return { description, fullDescription };
};

const buildToolsChangeToClientEntryDescription = (
  fullDescriptionWithParties: string,
): { description: string; fullDescription: string } => {
  const description = TOOLS_CHANGE_TO_CLIENT_DESCRIPTION;
  const fullDescription = fullDescriptionWithParties
    ? `${TOOLS_CHANGE_TO_CLIENT_DESCRIPTION} | ${fullDescriptionWithParties}`.substring(
        0,
        255,
      )
    : description;
  return { description, fullDescription };
};

const buildToolsRentIncomeEntryDescription = (
  fullDescriptionWithParties: string,
): { description: string; fullDescription: string } => {
  const description = TOOLS_RENT_INCOME_DESCRIPTION;
  const fullDescription = fullDescriptionWithParties
    ? `${TOOLS_RENT_INCOME_DESCRIPTION} | ${fullDescriptionWithParties}`.substring(
        0,
        255,
      )
    : description;
  return { description, fullDescription };
};

export const getValuesForEntry = async (
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
): Promise<ResultgetValuesForEntry | ResultgetValuesForEntry[] | null> => {
  if (doc && doc.docValues) {
    const documentType = doc.documentType;
    const {
      receiverId,
      senderId,
      analiticId,
      productForChargeId,
      count,
      total,
      isPartner,
      isWorker,
      cashFromPartner,
      isDepartment,
      isClient,
      isFounder,
      isMediator,
      isDeliverer,
      usd,
    } = doc.docValues;

    const {
      leaveMaterialWithTable,
      comeMaterialWithTable,
      moveMaterialWithTable,
    } = objectForEntry(doc, tableItem, entryType, isGlobalDocument, isSender);

    const useNewAccount = shouldUseNewAccount(doc.date);

    let senderName = "";
    if (senderId) {
      try {
        const senderReference =
          await referencesService.getReferenceById(senderId);
        senderName = senderReference?.name || "";
      } catch (error) {
        // Если не удалось получить название, оставляем пустым
        senderName = "";
      }
    }

    let analiticName = "";
    if (analiticId) {
      try {
        const analiticReference =
          await referencesService.getReferenceById(analiticId);
        analiticName = analiticReference?.name || "";
      } catch (error) {
        // Если не удалось получить название, оставляем пустым
        analiticName = "";
      }
    }

    let receiverName = "";
    if (receiverId) {
      try {
        const receiverReference =
          await referencesService.getReferenceById(receiverId);
        receiverName = receiverReference?.name || "";
      } catch (error) {
        // Если не удалось получить название, оставляем пустым
        receiverName = "";
      }
    }

    // Формируем описание с названием sender
    const baseDescription = doc.docValues?.comment || "";
    const descriptionWithSenderAndAnalitic =
      senderName || analiticName || receiverName
        ? `олувчи: ${receiverName} | жунатувчи: ${senderName} | ким учун: ${analiticName} | ${baseDescription} ${usd ? `| - : ${usd} $` : ""}`.substring(
            0,
            255,
          )
        : baseDescription.substring(0, 255) || "";

    const descriptionWithSenderReciever =
      senderName || receiverName
        ? `олувчи: ${total && total > 0 ? receiverName : senderName} | жунатувчи: ${total && total > 0 ? senderName : receiverName} | ${baseDescription} ${usd ? `| - : ${usd} $` : ""}`.substring(
            0,
            255,
          )
        : baseDescription.substring(0, 255) || "";

    const descriptionWithSender = senderName
      ? `${baseDescription} | ${senderName} ${usd ? `| - : ${usd} $` : ""}`.substring(
          0,
          255,
        )
      : baseDescription.substring(0, 255) || "";

    const descriptionWithUSD = usd
      ? `${baseDescription} | - : ${usd} $`.substring(0, 255)
      : baseDescription.substring(0, 255) || "";

    switch (documentType) {
      case DocumentType.OrderToolsToClient:
        return null;

      case DocumentType.ComeCashFromClients:
        if (isPartner) {
          return {
            debet: useNewAccount ? Schet.S50 : Schet.S00,
            kredit: useNewAccount ? Schet.S60 : Schet.S00,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: receiverId,
            count: count ?? 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: baseDescription,
            fullDescription: descriptionWithSenderAndAnalitic,
          };
        }

        // Загружаем справочник получателя для проверки isOffice
        const receiverReference = receiverId
          ? await referencesService.getReferenceById(receiverId)
          : null;
        const isOffice = receiverReference?.refValues?.isOffice === true;

        if (isOffice) {
          // Межпредприятийная операция - создаем три проводки
          const analiticIdValue = doc.docValues?.analiticId;

          // Проверяем, что analiticId заполнен (он нужен в субконто)
          if (!analiticIdValue || analiticIdValue <= 0) {
            throw new Error(
              "Для межпредприятийной проводки (isOffice=true) необходимо заполнить analiticId",
            );
          }

          // Получаем sourceEnterpriseId из analiticId (отправитель)
          const analiticReference =
            await referencesService.getReferenceById(analiticIdValue);
          if (
            !analiticReference ||
            analiticReference.typeReference !== TypeReference.STORAGES
          ) {
            throw new Error(
              `Справочник STORAGES с id ${analiticIdValue} не найден`,
            );
          }
          const sourceEnterpriseId = analiticReference.enterpriseId;
          if (sourceEnterpriseId == null || sourceEnterpriseId === undefined) {
            throw new Error(
              `У справочника STORAGES с id ${analiticIdValue} отсутствует enterpriseId`,
            );
          }

          // Получаем targetEnterpriseId из receiverId (получатель)
          const targetEnterpriseId = receiverReference?.enterpriseId;
          if (targetEnterpriseId == null || targetEnterpriseId === undefined) {
            throw new Error(
              `У справочника с id ${receiverId} отсутствует enterpriseId`,
            );
          }

          // Находим COMMON справочник предприятия получателя по receiverId
          const commonStorageId = await getCommonStorageIdByStorageId(
            receiverId,
            referencesService,
          );
          if (!commonStorageId) {
            throw new Error(
              `Не удалось найти COMMON справочник для receiverId ${receiverId}`,
            );
          }

          // Возвращаем массив из трех проводок
          // Первые 2 проводки создаются у отправителя (targetEnterpriseId: sourceEnterpriseId)
          // Третья проводка создается у получателя (targetEnterpriseId: targetEnterpriseId)
          return [
            // Проводка 1: Дебет S50 (analiticId, senderId) - Кредит S40 (senderId, analiticId) - у отправителя
            {
              debet: useNewAccount ? Schet.S50 : Schet.S00,
              debetFirstSubcontoId: analiticIdValue,
              debetSecondSubcontoId: senderId,
              kredit: Schet.S40,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticIdValue,
              count: count ?? 0,
              total: total ?? 0,
              usd: usd ?? 0,
              targetEnterpriseId: sourceEnterpriseId, // Создается у отправителя
              description: baseDescription,
              fullDescription: descriptionWithSenderAndAnalitic,
            },
            // Проводка 2: Дебет S41 (commonStorageId, senderId) - Кредит S50 (analiticId, senderId) - у отправителя
            {
              debet: Schet.S41,
              debetFirstSubcontoId: commonStorageId,
              debetSecondSubcontoId: senderId,
              kredit: useNewAccount ? Schet.S50 : Schet.S00,
              kreditFirstSubcontoId: analiticIdValue,
              kreditSecondSubcontoId: senderId,
              count: count ?? 0,
              total: total ?? 0,
              usd: usd ?? 0,
              targetEnterpriseId: sourceEnterpriseId, // Создается у отправителя
              description: baseDescription,
              fullDescription: descriptionWithSenderAndAnalitic,
            },
            // Проводка 3: Дебет S50 (receiverId, analiticId) - Кредит S41 (analiticId, senderId) - у получателя
            {
              debet: useNewAccount ? Schet.S50 : Schet.S00,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: analiticIdValue,
              kredit: Schet.S41,
              kreditFirstSubcontoId: analiticIdValue,
              kreditSecondSubcontoId: senderId,
              count: count ?? 0,
              total: total ?? 0,
              usd: usd ?? 0,
              targetEnterpriseId: targetEnterpriseId, // Создается у получателя
              description: baseDescription,
              fullDescription: descriptionWithSenderAndAnalitic,
            },
          ];
        }

        // Стандартная проводка для случая, когда isOffice не установлен
        return {
          debet: useNewAccount ? Schet.S50 : Schet.S00,
          kredit: Schet.S40,
          debetFirstSubcontoId: receiverId,
          debetSecondSubcontoId: senderId,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: receiverId,
          count: count ?? 0,
          total: total ?? 0,
          usd: usd ?? 0,
          description: baseDescription,
          fullDescription: descriptionWithSenderAndAnalitic,
        };

      case DocumentType.ComeHalfstuff: {
        const productId = productForChargeId || analiticId;
        const isOrderReceipt = productForChargeId != null && productForChargeId > 0;
        const kreditSecondSubcontoId = isOrderReceipt
          ? await resolveProductionReceiptHalfstuffChargeId(
              settingsService,
              doc.enterpriseId,
            )
          : analiticId || null;
        return {
          debet: Schet.S21,
          kredit: Schet.S20,
          debetFirstSubcontoId: receiverId,
          debetSecondSubcontoId: productId || null,
          kreditFirstSubcontoId: isOrderReceipt ? senderId : receiverId,
          kreditSecondSubcontoId,
          count: count ?? 0,
          total: total ?? 0,
          usd: usd ?? 0,
        };
      }

      case DocumentType.ComeMaterial: {
        const tmzItemId =
          tableItem !== null &&
          doc.docTableItems?.length &&
          entryType === "primaryEntry" &&
          Number(tableItem?.analiticId) > 0
            ? tableItem.analiticId
            : null;

        let debetSchet = Schet.S10;
        let tmzRef: Awaited<
          ReturnType<ReferencesService["getReferenceById"]>
        > | null = null;

        if (tmzItemId) {
          tmzRef = await referencesService.getReferenceById(tmzItemId);
          if (tmzRef?.refValues?.typeTMZ === TypeTMZ.HALFSTUFF) {
            debetSchet = Schet.S21;
          }
        }

        const comeMaterialEntry = {
          debet: debetSchet,
          kredit: useNewAccount
            ? isDepartment || !isSender
              ? Schet.S41
              : Schet.S60
            : Schet.S00,
          ...comeMaterialWithTable,
        };

        // Листовой материал: количество в проводке = count * area из карточки ТМЗ
        const tmzRefValues = tmzRef?.refValues;
        if (tmzItemId && tmzRefValues?.isSheetMaterial) {
          const area = parseNumberOrFallback(tmzRefValues.area, 0);
          if (!area || area <= 0) {
            throw new Error(
              `Для листового материала "${tmzRef?.name ?? tmzItemId}" необходимо заполнить площадь (area) в карточке ТМЗ`,
            );
          }
          comeMaterialEntry.count =
            parseNumberOrFallback(comeMaterialEntry.count, 0) * area;
        }

        return comeMaterialEntry;
      }

      case DocumentType.ComeTools: {
        const tmzItemId =
          tableItem !== null &&
          doc.docTableItems?.length &&
          entryType === "primaryEntry" &&
          Number(tableItem?.analiticId) > 0
            ? tableItem.analiticId
            : null;

        let tmzRef: Awaited<
          ReturnType<ReferencesService["getReferenceById"]>
        > | null = null;

        if (tmzItemId) {
          tmzRef = await referencesService.getReferenceById(tmzItemId);
        }

        const comeToolsEntry = {
          debet: Schet.S11,
          kredit: useNewAccount
            ? isDepartment || !isSender
              ? Schet.S41
              : Schet.S60
            : Schet.S00,
          ...comeMaterialWithTable,
        };

        const tmzRefValues = tmzRef?.refValues;
        if (tmzItemId && tmzRefValues?.isSheetMaterial) {
          const area = parseNumberOrFallback(tmzRefValues.area, 0);
          if (!area || area <= 0) {
            throw new Error(
              `Для листового материала "${tmzRef?.name ?? tmzItemId}" необходимо заполнить площадь (area) в карточке ТМЗ`,
            );
          }
          comeToolsEntry.count =
            parseNumberOrFallback(comeToolsEntry.count, 0) * area;
        }

        return comeToolsEntry;
      }

      case DocumentType.ComeTovar: {
        const tmzItemId =
          tableItem !== null &&
          doc.docTableItems?.length &&
          entryType === "primaryEntry" &&
          Number(tableItem?.analiticId) > 0
            ? tableItem.analiticId
            : null;

        let tmzRef: Awaited<
          ReturnType<ReferencesService["getReferenceById"]>
        > | null = null;

        if (tmzItemId) {
          tmzRef = await referencesService.getReferenceById(tmzItemId);
        }

        const comeTovarEntry = {
          debet: Schet.S29,
          kredit: useNewAccount
            ? isDepartment || !isSender
              ? Schet.S41
              : Schet.S60
            : Schet.S00,
          ...comeMaterialWithTable,
        };

        const tmzRefValues = tmzRef?.refValues;
        if (tmzItemId && tmzRefValues?.isSheetMaterial) {
          const area = parseNumberOrFallback(tmzRefValues.area, 0);
          if (!area || area <= 0) {
            throw new Error(
              `Для листового материала "${tmzRef?.name ?? tmzItemId}" необходимо заполнить площадь (area) в карточке ТМЗ`,
            );
          }
          comeTovarEntry.count =
            parseNumberOrFallback(comeTovarEntry.count, 0) * area;
        }

        return comeTovarEntry;
      }

      case DocumentType.ComeOS:
        return {
          debet: Schet.S01,
          kredit: useNewAccount
            ? isDepartment || !isSender
              ? Schet.S41
              : Schet.S60
            : Schet.S00,
          ...comeMaterialWithTable,
        };

      case DocumentType.SaleHalfStuff:
        if (entryType == "primaryEntry") {
          return {
            debet: Schet.S60,
            kredit: Schet.S21,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: analiticId || null,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: count ?? 0,
            total: total ?? 0,
            usd: usd ?? 0,
          };
        } else if (entryType == "crossEntry") {
          return {
            debet: Schet.S50,
            kredit: Schet.S60,
            debetFirstSubcontoId: senderId,
            debetSecondSubcontoId: analiticId || null,
            kreditFirstSubcontoId: receiverId,
            kreditSecondSubcontoId: analiticId || null,
            count: count ?? 0,
            total: total ?? 0,
            usd: usd ?? 0,
          };
        }

      case DocumentType.ComeProduct:
        if (entryType !== "primaryEntry") {
          return null;
        }
        if (productForChargeId != null && productForChargeId > 0) {
          const chargeId = await resolveProductionReceiptProductChargeId(
            settingsService,
            doc.enterpriseId,
          );
          return {
            debet: Schet.S28,
            kredit: useNewAccount ? Schet.S20 : Schet.S00,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: productForChargeId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: chargeId,
            kreditThirdSubcontoId: null,
            count: count ?? 0,
            total: total ?? 0,
            usd: usd ?? 0,
          };
        }
        return {
          debet: Schet.S28,
          kredit: useNewAccount ? Schet.S20 : Schet.S00,
          debetFirstSubcontoId: receiverId,
          debetSecondSubcontoId: analiticId || null,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: 20825,
          kreditThirdSubcontoId: analiticId || null,
          count: count ?? 0,
          total: total ?? 0,
          usd: usd ?? 0,
        };

      case DocumentType.LeaveCash:
        // Получаем название sender для добавления в описание проводок

        // Только комментарий документа; аналитика уже в субконто проводки
        const descriptionForLeaveCash = baseDescription.substring(0, 255) || "";

        if (isGlobalDocument && isFounder) {
          throw new Error(
            "Межпредприятийский LeaveCash с выплатой учредителю не поддерживается",
          );
        }

        // Если LeaveCash используется для межпредприятийного перевода
        if (isGlobalDocument) {
          const commonReceiverId = await getCommonStorageIdByStorageId(
            receiverId,
            referencesService,
          );
          const commonSenderId = await getCommonStorageIdByStorageId(
            senderId,
            referencesService,
          );

          // Проводка #1: создается у отправителя (isSender=true)
          if (isSender) {
            return {
              debet: Schet.S41,
              kredit: useNewAccount ? Schet.S50 : Schet.S00,
              debetFirstSubcontoId: receiverId, // COMMON получателя
              debetSecondSubcontoId: analiticId || null, // аналитика (ким учун) для отображения в кассовых отчётах
              kreditFirstSubcontoId: senderId, // Касса/банк отправителя
              kreditSecondSubcontoId: null,
              count: 0,
              total: total ?? 0,
              usd: usd ?? 0,
              description: descriptionForLeaveCash,
              fullDescription: descriptionWithSenderAndAnalitic,
            };
          }

          // Проводки #2 и #3: создаются у получателя (isSender=false)
          const entries: ResultgetValuesForEntry[] = [];

          // Проводка #2: Dt S50 (receiverId) - Ct S41 (commonSenderId)
          entries.push({
            debet: useNewAccount ? Schet.S50 : Schet.S00,
            debetFirstSubcontoId: receiverId, // COMMON получателя
            debetSecondSubcontoId: commonSenderId,
            kredit: Schet.S41,
            kreditFirstSubcontoId: commonSenderId, // COMMON отправителя
            kreditSecondSubcontoId: analiticId || null,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            targetEnterpriseId: null, // Будет установлен в prepareEntrysList
            description: descriptionForLeaveCash,
            fullDescription: descriptionWithSenderAndAnalitic,
          });

          // Проводка #3: создается только если заполнен analiticId
          if (analiticId) {
            let debetSchet: Schet;
            let debetFirstSubcontoId: number | null;
            let debetSecondSubcontoId: number | null;
            let debetThirdSubcontoId: number | null = null;

            // Определяем дебетовый счет по галочкам (как в обычном LeaveCash)
            if (isWorker) {
              debetSchet = Schet.S67;
              debetFirstSubcontoId = analiticId;
              debetSecondSubcontoId = senderId;
            } else if (isMediator) {
              debetSchet = Schet.S65;
              debetFirstSubcontoId = analiticId;
              debetSecondSubcontoId = senderId;
            } else if (isDeliverer) {
              debetSchet = Schet.S64;
              debetFirstSubcontoId = analiticId;
              debetSecondSubcontoId = senderId;
            } else if (isPartner) {
              debetSchet = Schet.S60;
              debetFirstSubcontoId = analiticId;
              debetSecondSubcontoId = senderId;
            } else if (isClient) {
              debetSchet = Schet.S40;
              debetFirstSubcontoId = analiticId;
              debetSecondSubcontoId = senderId;
            } else {
              debetSchet = Schet.S20;
              debetFirstSubcontoId = receiverId;
              debetSecondSubcontoId = analiticId;
              debetThirdSubcontoId = productForChargeId ?? null;
            }

            entries.push({
              debet: debetSchet,
              debetFirstSubcontoId,
              debetSecondSubcontoId,
              debetThirdSubcontoId,
              kredit: useNewAccount ? Schet.S50 : Schet.S00,
              kreditFirstSubcontoId: receiverId,
              kreditSecondSubcontoId: commonSenderId,
              count: 0,
              total: total ?? 0,
              usd: usd ?? 0,
              targetEnterpriseId: null,
              description: descriptionForLeaveCash,
              fullDescription: descriptionWithSenderAndAnalitic,
            });
          }

          return entries.length > 0 ? entries : null;
        }

        if (isPartner) {
          return {
            debet: Schet.S60,
            kredit: useNewAccount ? Schet.S50 : Schet.S00,
            debetFirstSubcontoId: analiticId || null,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: descriptionForLeaveCash,
            fullDescription: descriptionWithSenderAndAnalitic,
          };
        }
        if (isWorker) {
          return {
            debet: Schet.S67,
            kredit: useNewAccount ? Schet.S50 : Schet.S00,
            debetFirstSubcontoId: analiticId || null, // Сотрудник
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: descriptionForLeaveCash,
            fullDescription: descriptionWithSenderAndAnalitic,
          };
        }

        if (isMediator) {
          return {
            debet: Schet.S65,
            kredit: useNewAccount ? Schet.S50 : Schet.S00,
            debetFirstSubcontoId: analiticId || null,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: descriptionForLeaveCash,
            fullDescription: descriptionWithSenderAndAnalitic,
          };
        }

        if (isDeliverer) {
          return {
            debet: Schet.S64,
            kredit: useNewAccount ? Schet.S50 : Schet.S00,
            debetFirstSubcontoId: analiticId || null,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: descriptionForLeaveCash,
            fullDescription: descriptionWithSenderAndAnalitic,
          };
        }

        if (isDepartment) {
          throw new Error("isDepartment is not implemented");
        }

        if (isClient) {
          return {
            debet: Schet.S40,
            kredit: useNewAccount ? Schet.S50 : Schet.S00,
            debetFirstSubcontoId: analiticId || null,
            debetSecondSubcontoId: senderId,
            debetThirdSubcontoId: null,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: descriptionForLeaveCash,
            fullDescription: descriptionWithSenderAndAnalitic,
          };
        }

        if (isFounder) {
          if (!receiverId) {
            throw new Error(
              "LeaveCash (учредитель): выберите получателя — кошелёк учредителя (typeSection FOUNDER)",
            );
          }
          return {
            debet: Schet.S66,
            kredit: useNewAccount ? Schet.S50 : Schet.S00,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: null,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: receiverId,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: descriptionForLeaveCash,
            fullDescription: descriptionWithSenderAndAnalitic,
          };
        }

        return {
          debet: Schet.S20,
          kredit: Schet.S50,
          debetFirstSubcontoId: receiverId,
          debetSecondSubcontoId: analiticId || null,
          debetThirdSubcontoId: productForChargeId,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: analiticId || null,
          count: 0,
          total: total ?? 0,
          usd: usd ?? 0,
          description: descriptionForLeaveCash,
          fullDescription: descriptionWithSenderAndAnalitic,
        };

      case DocumentType.LeaveHalfstuff: {
        if (tableItem != null && Number(tableItem.count) <= 0) {
          return null;
        }
        const halfstuffAnaliticId =
          tableItem != null &&
          doc.docTableItems?.length &&
          entryType === "primaryEntry" &&
          tableItem?.analiticId
            ? tableItem.analiticId
            : analiticId || null;
        const halfstuffCount =
          tableItem != null &&
          doc.docTableItems?.length &&
          entryType === "primaryEntry" &&
          tableItem?.count
            ? tableItem.count
            : (count ?? 0);
        const halfstuffTotal =
          tableItem != null &&
          doc.docTableItems?.length &&
          entryType === "primaryEntry" &&
          tableItem?.total
            ? tableItem.total
            : (total ?? 0);
        return {
          debet: Schet.S20,
          kredit: Schet.S21,
          debetFirstSubcontoId: senderId,
          debetSecondSubcontoId: receiverId,
          debetThirdSubcontoId: productForChargeId,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: halfstuffAnaliticId,
          count: halfstuffCount,
          total: halfstuffTotal,
          usd: usd ?? 0,
        };
      }

      case DocumentType.LeaveMaterial:
        if (tableItem != null && Number(tableItem.count) <= 0) {
          return null;
        }
        return {
          //debet: Schet.S20,
          debet: useNewAccount ? Schet.S20 : Schet.S00,
          kredit: Schet.S10,
          ...leaveMaterialWithTable,
        };

      case DocumentType.LeaveTools:
        return {
          debet: useNewAccount ? Schet.S20 : Schet.S00,
          kredit: Schet.S11,
          ...leaveMaterialWithTable,
        };

      case DocumentType.LeaveTovar:
        return {
          debet: useNewAccount ? Schet.S20 : Schet.S00,
          kredit: Schet.S29,
          ...leaveMaterialWithTable,
        };

      case DocumentType.LeaveOS:
        if (entryType === "crossEntry" && tableItem && stocksService) {
          const osId = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          if (!osId) return null;
          const accum = await getOsAccumulatedDepreciationAtDate(
            stocksService,
            senderId,
            osId,
            Number(doc.date),
            doc.enterpriseId,
          );
          if (accum <= 0) return null;
          return {
            debet: Schet.S02,
            kredit: Schet.S01,
            debetFirstSubcontoId: senderId,
            debetSecondSubcontoId: osId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: osId,
            count: getTableItemValue<number>(tableItem, doc, "count", 0) || 1,
            total: accum,
            usd: usd ?? 0,
          };
        }
        {
          const gross = getTableItemValue<number>(tableItem, doc, "total", 0);
          let residual = gross;
          if (tableItem && stocksService) {
            const osId = getTableItemValue<number | null>(
              tableItem,
              doc,
              "analiticId",
              null,
            );
            if (osId) {
              const accum = await getOsAccumulatedDepreciationAtDate(
                stocksService,
                senderId,
                osId,
                Number(doc.date),
                doc.enterpriseId,
              );
              residual = Math.max(0, gross - accum);
            }
          }
          return {
            debet: Schet.S20,
            kredit: Schet.S01,
            ...leaveMaterialWithTable,
            total: residual,
          };
        }

      case DocumentType.AmortizasiyaOS: {
        if (entryType !== "primaryEntry" || !tableItem) return null;
        const enterpriseId = doc.enterpriseId;
        if (!enterpriseId) {
          throw new Error("enterpriseId обязателен для AmortizasiyaOS");
        }
        const chargeId = await resolveOsAmortizationChargeId(
          settingsService,
          enterpriseId,
        );
        const commonStorageId = await resolveOsAmortizationCommonStorageId(
          senderId,
          enterpriseId,
          referencesService,
          settingsService,
        );
        const osId = getTableItemValue<number | null>(
          tableItem,
          doc,
          "analiticId",
          null,
        );
        let osName = "";
        if (osId) {
          try {
            const osRef = await referencesService.getReferenceById(osId);
            osName = osRef?.name?.trim() || "";
          } catch {
            osName = "";
          }
        }
        const entryDescription = (
          osName && baseDescription
            ? `${osName} | ${baseDescription}`
            : osName || baseDescription
        ).substring(0, 255);
        return {
          debet: Schet.S20,
          kredit: Schet.S02,
          debetFirstSubcontoId: commonStorageId,
          debetSecondSubcontoId: chargeId,
          debetThirdSubcontoId: null,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: osId,
          kreditThirdSubcontoId: null,
          count: 1,
          total: getTableItemValue<number>(tableItem, doc, "total", 0),
          usd: usd ?? 0,
          description: entryDescription,
          fullDescription: entryDescription,
        };
      }

      case DocumentType.LeaveOnlyOneMaterial:
        return {
          debet: Schet.S20,
          kredit: Schet.S10,
          debetFirstSubcontoId: receiverId,
          debetSecondSubcontoId: analiticId || null,
          debetThirdSubcontoId: productForChargeId,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: productForChargeId || null,
          count: count ?? 0,
          total: total ?? 0,
          usd: usd ?? 0,
        };

      case DocumentType.LeaveProd:
        return {
          debet: Schet.S20,
          kredit: Schet.S28,
          debetFirstSubcontoId: senderId,
          debetSecondSubcontoId: receiverId,
          debetThirdSubcontoId: productForChargeId,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          ),
          count: getTableItemValue<number>(tableItem, doc, "count", 0),
          total: getTableItemValue<number>(tableItem, doc, "total", 0),
          usd: usd ?? 0,
        };

      case DocumentType.MoveCash:
        let moveCashEntry: ResultgetValuesForEntry;

        if (isGlobalDocument) {
          const commonReceiverId = await getCommonStorageIdByStorageId(
            receiverId,
            referencesService,
          );
          const commonSenderId = await getCommonStorageIdByStorageId(
            senderId,
            referencesService,
          );
          moveCashEntry = {
            debet: !isSender ? Schet.S50 : Schet.S41,
            kredit: useNewAccount
              ? !isSender
                ? Schet.S41
                : Schet.S50
              : Schet.S00,
            debetFirstSubcontoId: !isSender ? receiverId : commonReceiverId,
            debetSecondSubcontoId: commonSenderId,
            kreditFirstSubcontoId: !isSender ? commonSenderId : senderId,
            kreditSecondSubcontoId: commonReceiverId,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: descriptionWithUSD,
            fullDescription: descriptionWithSenderReciever,
          };
        } else {
          moveCashEntry = {
            debet: Schet.S50,
            kredit: useNewAccount ? Schet.S50 : Schet.S00,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: receiverId,
            count: 0,
            total: total ?? 0,
            usd: usd ?? 0,
            description: descriptionWithUSD,
            fullDescription: descriptionWithSenderReciever,
          };
        }

        // Если сумма отрицательная, делаем swap дебет/кредит и субконто
        if (moveCashEntry.total < 0) {
          moveCashEntry.total = Math.abs(moveCashEntry.total);
          moveCashEntry.usd = Math.abs(moveCashEntry.usd);

          // Меняем местами дебет и кредит счета
          const tempDebet = moveCashEntry.debet;
          moveCashEntry.debet = moveCashEntry.kredit;
          moveCashEntry.kredit = tempDebet;

          // Меняем местами субконто
          const tempDebetFirst = moveCashEntry.debetFirstSubcontoId;
          moveCashEntry.debetFirstSubcontoId =
            moveCashEntry.kreditFirstSubcontoId;
          moveCashEntry.kreditFirstSubcontoId = tempDebetFirst;

          const tempDebetSecond = moveCashEntry.debetSecondSubcontoId;
          moveCashEntry.debetSecondSubcontoId =
            moveCashEntry.kreditSecondSubcontoId;
          moveCashEntry.kreditSecondSubcontoId = tempDebetSecond;

          // Если есть третье субконто, тоже меняем местами
          if (
            moveCashEntry.debetThirdSubcontoId !== undefined ||
            moveCashEntry.kreditThirdSubcontoId !== undefined
          ) {
            const tempDebetThird = moveCashEntry.debetThirdSubcontoId;
            moveCashEntry.debetThirdSubcontoId =
              moveCashEntry.kreditThirdSubcontoId;
            moveCashEntry.kreditThirdSubcontoId = tempDebetThird;
          }
        }

        return moveCashEntry;
      case DocumentType.MoveHalfstuff:
        if (isGlobalDocument) {
          // Межпредприятийное перемещение полуфабрикатов
          const commonReceiverId = await getCommonStorageIdByStorageId(
            receiverId,
            referencesService,
          );
          const commonSenderId = await getCommonStorageIdByStorageId(
            senderId,
            referencesService,
          );

          if (isSender) {
            // Проводки у отправителя: расход полуфабриката в счет межпредприятийных расчетов
            // Дебет 41 (общий склад получателя) - Кредит 21 (полуфабрикаты на складе отправителя)
            return {
              debet: Schet.S41,
              kredit: Schet.S21,
              debetFirstSubcontoId: commonReceiverId,
              debetSecondSubcontoId: analiticId || null,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticId || null,
              count: count ?? 0,
              total: total ?? 0,
              usd: usd ?? 0,
            };
          } else {
            // Проводки у получателя: приход полуфабриката от другого предприятия
            // Дебет 21 (полуфабрикаты на складе получателя) - Кредит 41 (общий склад отправителя)
            return {
              debet: Schet.S21,
              kredit: useNewAccount ? Schet.S41 : Schet.S00,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: analiticId || null,
              kreditFirstSubcontoId: commonSenderId,
              kreditSecondSubcontoId: analiticId || null,
              count: count ?? 0,
              total: total ?? 0,
              usd: usd ?? 0,
            };
          }
        } else {
          // Обычное перемещение внутри предприятия
          return {
            debet: Schet.S21,
            kredit: useNewAccount ? Schet.S21 : Schet.S00,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: analiticId || null,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: count ?? 0,
            total: total ?? 0,
            usd: usd ?? 0,
          };
        }

      case DocumentType.MoveMaterial:
        if (isGlobalDocument) {
          // Межпредприятийное перемещение материалов
          const analiticIdFromTable =
            tableItem !== null &&
            doc.docTableItems?.length &&
            tableItem?.analiticId
              ? tableItem.analiticId
              : null;
          const countFromTable =
            tableItem !== null && doc.docTableItems?.length && tableItem?.count
              ? tableItem.count
              : 0;
          const totalFromTable =
            tableItem !== null && doc.docTableItems?.length && tableItem?.total
              ? tableItem.total
              : 0;

          const commonReceiverId = await getCommonStorageIdByStorageId(
            receiverId,
            referencesService,
          );
          const commonSenderId = await getCommonStorageIdByStorageId(
            senderId,
            referencesService,
          );

          if (isSender) {
            // Проводки у отправителя: расход материала в счет межпредприятийных расчетов
            // Дебет 41 (общий склад получателя) - Кредит 10 (материалы на складе отправителя)
            return {
              debet: Schet.S41,
              kredit: Schet.S10,
              debetFirstSubcontoId: commonReceiverId,
              debetSecondSubcontoId: analiticIdFromTable,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticIdFromTable,
              count: countFromTable,
              total: totalFromTable,
              usd: usd || 0,
            };
          } else {
            // Проводки у получателя: приход материала от другого предприятия
            // Дебет 10 (материалы на складе получателя) - Кредит 41 (общий склад отправителя)
            return {
              debet: Schet.S10,
              kredit: useNewAccount ? Schet.S41 : Schet.S00,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: analiticIdFromTable,
              kreditFirstSubcontoId: commonSenderId,
              kreditSecondSubcontoId: analiticIdFromTable,
              count: countFromTable,
              total: totalFromTable,
              usd: usd || 0,
            };
          }
        } else {
          // Обычное перемещение внутри предприятия
          return {
            debet: Schet.S10,
            kredit: Schet.S10,
            ...moveMaterialWithTable,
          };
        }

      case DocumentType.MoveTools:
        if (isGlobalDocument) {
          const analiticIdFromTable =
            tableItem !== null &&
            doc.docTableItems?.length &&
            tableItem?.analiticId
              ? tableItem.analiticId
              : null;
          const countFromTable =
            tableItem !== null && doc.docTableItems?.length && tableItem?.count
              ? tableItem.count
              : 0;
          const totalFromTable =
            tableItem !== null && doc.docTableItems?.length && tableItem?.total
              ? tableItem.total
              : 0;

          const commonReceiverId = await getCommonStorageIdByStorageId(
            receiverId,
            referencesService,
          );
          const commonSenderId = await getCommonStorageIdByStorageId(
            senderId,
            referencesService,
          );

          if (isSender) {
            return {
              debet: Schet.S41,
              kredit: Schet.S11,
              debetFirstSubcontoId: commonReceiverId,
              debetSecondSubcontoId: analiticIdFromTable,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticIdFromTable,
              count: countFromTable,
              total: totalFromTable,
              usd: usd || 0,
            };
          } else {
            return {
              debet: Schet.S11,
              kredit: useNewAccount ? Schet.S41 : Schet.S00,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: analiticIdFromTable,
              kreditFirstSubcontoId: commonSenderId,
              kreditSecondSubcontoId: analiticIdFromTable,
              count: countFromTable,
              total: totalFromTable,
              usd: usd || 0,
            };
          }
        } else {
          return {
            debet: Schet.S11,
            kredit: Schet.S11,
            ...moveMaterialWithTable,
          };
        }

      case DocumentType.MoveOS:
        if (isGlobalDocument) {
          const analiticIdFromTable =
            tableItem !== null &&
            doc.docTableItems?.length &&
            tableItem?.analiticId
              ? tableItem.analiticId
              : null;
          const countFromTable =
            tableItem !== null && doc.docTableItems?.length && tableItem?.count
              ? tableItem.count
              : 0;
          const totalFromTable =
            tableItem !== null && doc.docTableItems?.length && tableItem?.total
              ? tableItem.total
              : 0;

          const commonReceiverId = await getCommonStorageIdByStorageId(
            receiverId,
            referencesService,
          );
          const commonSenderId = await getCommonStorageIdByStorageId(
            senderId,
            referencesService,
          );

          if (isSender) {
            return {
              debet: Schet.S41,
              kredit: Schet.S01,
              debetFirstSubcontoId: commonReceiverId,
              debetSecondSubcontoId: analiticIdFromTable,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticIdFromTable,
              count: countFromTable,
              total: totalFromTable,
              usd: usd || 0,
            };
          } else {
            return {
              debet: Schet.S01,
              kredit: useNewAccount ? Schet.S41 : Schet.S00,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: analiticIdFromTable,
              kreditFirstSubcontoId: commonSenderId,
              kreditSecondSubcontoId: analiticIdFromTable,
              count: countFromTable,
              total: totalFromTable,
              usd: usd || 0,
            };
          }
        } else {
          return {
            debet: Schet.S01,
            kredit: Schet.S01,
            ...moveMaterialWithTable,
          };
        }

      case DocumentType.MoveProd:
        if (isGlobalDocument) {
          // Межпредприятийное перемещение готовой продукции
          const commonReceiverId = await getCommonStorageIdByStorageId(
            receiverId,
            referencesService,
          );
          const commonSenderId = await getCommonStorageIdByStorageId(
            senderId,
            referencesService,
          );

          if (isSender) {
            // Проводки у отправителя: расход продукции в счет межпредприятийных расчетов
            // Дебет 41 (общий склад получателя) - Кредит 28 (готовая продукция на складе отправителя)
            return {
              debet: Schet.S41,
              kredit: Schet.S28,
              debetFirstSubcontoId: commonReceiverId,
              debetSecondSubcontoId: analiticId || null,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticId || null,
              count: count ?? 0,
              total: count ?? 0,
              usd: usd ?? 0,
            };
          } else {
            // Проводки у получателя: приход продукции от другого предприятия
            // Дебет 28 (готовая продукция на складе получателя) - Кредит 41 (общий склад отправителя)
            return {
              debet: Schet.S28,
              kredit: useNewAccount ? Schet.S41 : Schet.S00,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: analiticId || null,
              kreditFirstSubcontoId: commonSenderId,
              kreditSecondSubcontoId: analiticId || null,
              count: count ?? 0,
              total: total ?? 0,
              usd: usd ?? 0,
            };
          }
        } else {
          // Обычное перемещение внутри предприятия
          return {
            debet: Schet.S28,
            kredit: Schet.S28,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: analiticId || null,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: count ?? 0,
            total: total ?? 0,
            usd: usd ?? 0,
          };
        }

      case DocumentType.SaleMaterial:
        if (entryType == "primaryEntry") {
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          return {
            debet: Schet.S91,
            kredit: Schet.S10,
            debetFirstSubcontoId: senderId,
            debetSecondSubcontoId: analiticIdFromTable,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable || null,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: getTableItemValue<number>(tableItem, doc, "costTotal", 0),
            usd: usd ?? 0,
          };
        } else if (entryType == "crossEntry") {
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          // Ходим: Dt67–Ct90; таъминотчи: Dt60–Ct90; ички корхона: Dt41–Ct90; клиент: Dt40–Ct90
          if (isWorker) {
            return {
              debet: Schet.S67,
              kredit: Schet.S90,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: senderId,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticIdFromTable || null,
              count: getTableItemValue<number>(tableItem, doc, "count", 0),
              total: getTableItemValue<number>(tableItem, doc, "total", 0),
              usd: usd ?? 0,
            };
          }
          if (isPartner) {
            return {
              debet: Schet.S60,
              kredit: Schet.S90,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: senderId,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticIdFromTable || null,
              count: getTableItemValue<number>(tableItem, doc, "count", 0),
              total: getTableItemValue<number>(tableItem, doc, "total", 0),
              usd: usd ?? 0,
            };
          }
          return {
            debet: isDepartment ? Schet.S41 : Schet.S40,
            kredit: Schet.S90,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable || null,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: getTableItemValue<number>(tableItem, doc, "total", 0),
            usd: usd ?? 0,
          };
        }

      case DocumentType.SaleOS:
        if (entryType === "crossEntry" && tableItem && stocksService) {
          const osId = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          if (!osId) return null;
          const accum = await getOsAccumulatedDepreciationAtDate(
            stocksService,
            senderId,
            osId,
            Number(doc.date),
            doc.enterpriseId,
          );
          if (accum <= 0) return null;
          return {
            debet: Schet.S02,
            kredit: Schet.S01,
            debetFirstSubcontoId: senderId,
            debetSecondSubcontoId: osId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: osId,
            count: getTableItemValue<number>(tableItem, doc, "count", 0) || 1,
            total: accum,
            usd: usd ?? 0,
          };
        }
        if (entryType == "primaryEntry") {
          return {
            debet: Schet.S40,
            kredit: Schet.S01,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: analiticId || null,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticId || null,
            count: count ?? 0,
            total: total ?? 0,
            usd: usd ?? 0,
          };
        }

      case DocumentType.SaleProd:
        if (entryType == "primaryEntry") {
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          return {
            debet: Schet.S91,
            kredit: Schet.S28,
            debetFirstSubcontoId: senderId,
            debetSecondSubcontoId: analiticIdFromTable,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable || null,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: getTableItemValue<number>(tableItem, doc, "costTotal", 0),
            usd: usd ?? 0,
          };
        } else if (entryType == "crossEntry") {
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          return {
            debet: isDepartment ? Schet.S41 : Schet.S40,
            kredit: Schet.S90,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable || null,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: getTableItemValue<number>(tableItem, doc, "total", 0),
            usd: usd ?? 0,
          };
        }

      case DocumentType.SaleTovar:
      case DocumentType.SaleTools: {
        const isSaleTools = documentType === DocumentType.SaleTools;
        const costSchet = isSaleTools ? Schet.S11 : Schet.S29;
        const paymentDescription = isSaleTools
          ? SALE_TOOLS_PAYMENT_DESCRIPTION
          : SALE_TOVAR_PAYMENT_DESCRIPTION;
        const errorPrefix = isSaleTools ? "SaleTools" : "SaleTovar";
        if (entryType == "primaryEntry") {
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          return {
            debet: Schet.S91,
            kredit: costSchet,
            debetFirstSubcontoId: senderId,
            debetSecondSubcontoId: analiticIdFromTable,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable || null,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: getTableItemValue<number>(tableItem, doc, "costTotal", 0),
            usd: usd ?? 0,
          };
        } else if (entryType == "crossEntry" && !tableItem) {
          return buildClientCashPaymentEntries({
            doc,
            clientId: receiverId,
            senderId,
            cashFromPartner,
            usd,
            useNewAccount,
            descriptionWithParties: descriptionWithSenderAndAnalitic,
            paymentDescription,
            errorPrefix,
            referencesService,
          });
        } else if (entryType == "crossEntry") {
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          return {
            debet: isDepartment ? Schet.S41 : Schet.S40,
            kredit: Schet.S90,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable || null,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: getTableItemValue<number>(tableItem, doc, "total", 0),
            usd: usd ?? 0,
          };
        }
        return null;
      }

      case DocumentType.TransferToolsToClient:
        if (entryType === "primaryEntry" && tableItem) {
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          // Продажа товаров (S29) вместе с передачей инструментов — как SaleTovar
          if (tableItem.tableType === "sale") {
            return {
              debet: Schet.S91,
              kredit: Schet.S29,
              debetFirstSubcontoId: senderId,
              debetSecondSubcontoId: analiticIdFromTable,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: analiticIdFromTable || null,
              count: getTableItemValue<number>(tableItem, doc, "count", 0),
              total: getTableItemValue<number>(tableItem, doc, "costTotal", 0),
              usd: usd ?? 0,
            };
          }
          return {
            debet: Schet.S12,
            kredit: Schet.S11,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: analiticIdFromTable,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: getTableItemValue<number>(tableItem, doc, "costTotal", 0),
            usd: usd ?? 0,
          };
        }
        // Выручка по строкам продажи товаров (S40 / S90)
        if (
          entryType === "crossEntry" &&
          tableItem &&
          tableItem.tableType === "sale"
        ) {
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          return {
            debet: isDepartment ? Schet.S41 : Schet.S40,
            kredit: Schet.S90,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: senderId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable || null,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: getTableItemValue<number>(tableItem, doc, "total", 0),
            usd: usd ?? 0,
          };
        }
        if (entryType === "crossEntry" && !tableItem) {
          return buildClientCashPaymentEntries({
            doc,
            clientId: receiverId,
            senderId,
            cashFromPartner,
            usd,
            useNewAccount,
            descriptionWithParties: descriptionWithSenderAndAnalitic,
            paymentDescription: TOOLS_RENT_PAYMENT_DESCRIPTION,
            errorPrefix: "TransferToolsToClient",
            referencesService,
          });
        }
        if (entryType === "deliveryEntry" && !tableItem) {
          return buildToolsDeliveryEntry(
            receiverId,
            doc.docValues?.delivererId,
            parseNumberOrFallback(doc.docValues?.deliverySum, 0),
            descriptionWithSenderAndAnalitic,
          );
        }
        if (entryType === "defectCostEntry" && !tableItem) {
          return buildToolsDefectCostEntry(
            receiverId,
            senderId,
            parseNumberOrFallback(doc.docValues?.defectCost, 0),
            descriptionWithSenderAndAnalitic,
          );
        }
        return null;

      case DocumentType.ReceiveToolsFromClient: {
        if (entryType === "primaryEntry" && tableItem) {
          const tableType = tableItem.tableType || "return";
          const toolId = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          const count = getTableItemValue<number>(tableItem, doc, "count", 0);
          const costTotal = getTableItemValue<number>(
            tableItem,
            doc,
            "costTotal",
            0,
          );

          if (tableType === "return") {
            return {
              debet: Schet.S11,
              kredit: Schet.S12,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: toolId,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: toolId,
              count,
              total: costTotal,
              usd: usd ?? 0,
            };
          }
          if (tableType === "brak") {
            let brakStorageId = analiticId || receiverId;
            if (!analiticId) {
              let enterpriseId: number | null = doc.enterpriseId ?? null;
              if (!enterpriseId && receiverId) {
                const receiverRef =
                  await referencesService.getReferenceById(receiverId);
                enterpriseId = receiverRef?.enterpriseId ?? null;
              }
              if (enterpriseId) {
                const defectStorage =
                  await referencesService.findDefectStorageByEnterpriseId(
                    enterpriseId,
                  );
                if (defectStorage) {
                  brakStorageId = defectStorage.id;
                }
              }
            }
            return {
              debet: Schet.S11,
              kredit: Schet.S11,
              debetFirstSubcontoId: brakStorageId,
              debetSecondSubcontoId: toolId,
              kreditFirstSubcontoId: receiverId,
              kreditSecondSubcontoId: toolId,
              count,
              total: costTotal,
              usd: usd ?? 0,
            };
          }
          if (tableType === "sale") {
            // sale — подраспределение return: товар уже на складе (S11), списываем с S11
            const saleTotal = getTableItemValue<number>(tableItem, doc, "total", 0);
            const markup = round2(saleTotal - costTotal);
            const entries: ResultgetValuesForEntry[] = [
              {
                debet: Schet.S40,
                kredit: Schet.S11,
                debetFirstSubcontoId: senderId,
                debetSecondSubcontoId: receiverId,
                kreditFirstSubcontoId: receiverId,
                kreditSecondSubcontoId: toolId,
                count,
                total: costTotal,
                usd: usd ?? 0,
              },
            ];
            if (markup > 0.0001) {
              entries.push({
                debet: Schet.S40 ?? ("S40" as Schet),
                kredit: Schet.S93 ?? ("S93" as Schet),
                debetFirstSubcontoId: senderId,
                debetSecondSubcontoId: receiverId,
                kreditFirstSubcontoId: senderId,
                kreditSecondSubcontoId: toolId,
                count,
                total: markup,
                usd: usd ?? 0,
                description: "мижозга сотишдан даромад",
              });
            }
            return entries;
          }
          if (tableType === "tovar") {
            // Продажа товаров S29 со склада приёма (receiverId) — как SaleTovar
            return {
              debet: Schet.S91,
              kredit: Schet.S29,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: toolId,
              kreditFirstSubcontoId: receiverId,
              kreditSecondSubcontoId: toolId || null,
              count,
              total: costTotal,
              usd: usd ?? 0,
            };
          }
          return null;
        }

        if (entryType === "crossEntry" && tableItem) {
          const tableType = tableItem.tableType || "return";
          const analiticIdFromTable = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );

          if (tableType === "tovar") {
            return {
              debet: isDepartment ? Schet.S41 : Schet.S40,
              kredit: Schet.S90,
              debetFirstSubcontoId: senderId,
              debetSecondSubcontoId: receiverId,
              kreditFirstSubcontoId: receiverId,
              kreditSecondSubcontoId: analiticIdFromTable || null,
              count: getTableItemValue<number>(tableItem, doc, "count", 0),
              total: getTableItemValue<number>(tableItem, doc, "total", 0),
              usd: usd ?? 0,
            };
          }

          // Построчный доход аренды: Dt40–Ct90, 2-е субконто Кт = инструмент
          if (tableType !== "return") return null;
          if (!analiticIdFromTable) return null;
          const rentSum = parseNumberOrFallback(
            getTableItemValue(tableItem, doc, "rentSum", 0),
            0,
          );
          const discount = parseNumberOrFallback(
            getTableItemValue(tableItem, doc, "price", 0),
            0,
          );
          const rentNet = Math.max(0, rentSum - discount);
          if (rentNet <= 0) return null;
          const { description, fullDescription } =
            buildToolsRentIncomeEntryDescription(
              descriptionWithSenderAndAnalitic,
            );
          return {
            debet: Schet.S40,
            kredit: Schet.S90,
            debetFirstSubcontoId: senderId,
            debetSecondSubcontoId: receiverId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: analiticIdFromTable,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: rentNet,
            usd: usd ?? 0,
            description,
            fullDescription,
          };
        }

        if (entryType === "thirdEntry" && !tableItem) {
          const cashPayment =
            parseNumberOrFallback(doc.docValues?.initialPayment, 0) ||
            parseNumberOrFallback(doc.docValues?.cashReceived, 0);
          const plasticPayment =
            parseNumberOrFallback(cashFromPartner, 0) ||
            parseNumberOrFallback(doc.docValues?.plasticReceived, 0);
          const usdAmount = parseNumberOrFallback(usd, 0);
          const currencyRate = parseNumberOrFallback(
            doc.docValues?.currency,
            0,
          );
          const changeToClient = parseNumberOrFallback(
            doc.docValues?.changeToClient,
            0,
          );

          if (
            cashPayment <= 0 &&
            plasticPayment <= 0 &&
            (usdAmount <= 0 || currencyRate <= 0) &&
            changeToClient <= 0
          ) {
            return null;
          }

          let enterpriseId: number | null = doc.enterpriseId ?? null;
          if (!enterpriseId && receiverId) {
            const receiverRef =
              await referencesService.getReferenceById(receiverId);
            enterpriseId = receiverRef?.enterpriseId ?? null;
          }
          if (!enterpriseId) {
            throw new Error(
              "ReceiveToolsFromClient: не удалось определить enterpriseId для подбора кассы",
            );
          }

          const entries: ResultgetValuesForEntry[] = [];

          const pushReceivePaymentEntry = (
            storageId: number,
            totalAmount: number,
            entryUsd: number,
          ) => {
            const { description, fullDescription } =
              buildToolsRentPaymentEntryDescription(
                descriptionWithSenderAndAnalitic,
              );
            entries.push({
              debet: useNewAccount ? Schet.S50 : Schet.S00,
              kredit: Schet.S40,
              debetFirstSubcontoId: storageId,
              debetSecondSubcontoId: senderId,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: storageId,
              count: 0,
              total: totalAmount,
              usd: entryUsd,
              description,
              fullDescription,
            });
          };

          const resolveReceiveCashStorageId = async (): Promise<number> => {
            if (analiticId) {
              return analiticId;
            }
            const cashStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "cash",
              );
            if (!cashStorage) {
              throw new Error(
                "ReceiveToolsFromClient: не найдена касса «Накд» (TypeSECTION.CASH)",
              );
            }
            return cashStorage.id;
          };

          if (cashPayment > 0) {
            pushReceivePaymentEntry(
              await resolveReceiveCashStorageId(),
              cashPayment,
              usd ?? 0,
            );
          }

          if (plasticPayment > 0) {
            const plasticStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "plastic",
              );
            if (!plasticStorage) {
              throw new Error(
                "ReceiveToolsFromClient: не найдена касса «Пластик» (TypeSECTION.PLASTIK)",
              );
            }
            pushReceivePaymentEntry(
              plasticStorage.id,
              plasticPayment,
              usd ?? 0,
            );
          }

          if (usdAmount > 0 && currencyRate > 0) {
            const foreignStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "foreignCash",
              );
            if (!foreignStorage) {
              throw new Error(
                "ReceiveToolsFromClient: не найдена валютная касса (CASH + Валюта х.р)",
              );
            }
            pushReceivePaymentEntry(
              foreignStorage.id,
              currencyRate * usdAmount,
              usdAmount,
            );
          }

          if (changeToClient > 0) {
            const cashStorageId = await resolveReceiveCashStorageId();
            const { description, fullDescription } =
              buildToolsChangeToClientEntryDescription(
                descriptionWithSenderAndAnalitic,
              );
            entries.push({
              debet: Schet.S40,
              kredit: useNewAccount ? Schet.S50 : Schet.S00,
              debetFirstSubcontoId: senderId,
              debetSecondSubcontoId: cashStorageId,
              kreditFirstSubcontoId: cashStorageId,
              kreditSecondSubcontoId: senderId,
              count: 0,
              total: changeToClient,
              usd: 0,
              description,
              fullDescription,
            });
          }

          return entries.length ? entries : null;
        }

        if (entryType === "fourthEntry" && !tableItem) {
          return buildReceiveMediatorBonusEntry(
            doc,
            settingsService,
            referencesService,
          );
        }
        if (entryType === "deliveryEntry" && !tableItem) {
          return buildToolsDeliveryEntry(
            senderId,
            doc.docValues?.delivererId,
            parseNumberOrFallback(doc.docValues?.deliverySum, 0),
            descriptionWithSenderAndAnalitic,
          );
        }
        if (entryType === "defectCostEntry" && !tableItem) {
          return buildToolsDefectCostEntry(
            senderId,
            receiverId,
            parseNumberOrFallback(doc.docValues?.defectCost, 0),
            descriptionWithSenderAndAnalitic,
          );
        }
        return null;
      }

      case DocumentType.TransferSubleaseToolsToClient:
        if (entryType === "primaryEntry" && tableItem) {
          const toolId = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          return {
            debet: Schet.S13,
            kredit: Schet.S00,
            debetFirstSubcontoId: senderId,
            debetSecondSubcontoId: toolId,
            kreditFirstSubcontoId: senderId,
            kreditSecondSubcontoId: toolId,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: 0,
            usd: usd ?? 0,
          };
        }
        if (entryType === "crossEntry" && !tableItem) {
          const cashPayment = parseNumberOrFallback(
            doc.docValues?.initialPayment,
            0,
          );
          const plasticPayment = parseNumberOrFallback(cashFromPartner, 0);
          const usdAmount = parseNumberOrFallback(usd, 0);
          const currencyRate = parseNumberOrFallback(
            doc.docValues?.currency,
            0,
          );
          const changeToClient = parseNumberOrFallback(
            doc.docValues?.changeToClient,
            0,
          );

          if (
            cashPayment <= 0 &&
            plasticPayment <= 0 &&
            (usdAmount <= 0 || currencyRate <= 0) &&
            changeToClient <= 0
          ) {
            return null;
          }

          let enterpriseId: number | null = doc.enterpriseId ?? null;
          if (!enterpriseId && senderId) {
            const senderRef =
              await referencesService.getReferenceById(senderId);
            enterpriseId = senderRef?.enterpriseId ?? null;
          }
          if (!enterpriseId) {
            throw new Error(
              "TransferSubleaseToolsToClient: не удалось определить enterpriseId для подбора кассы",
            );
          }

          const entries: ResultgetValuesForEntry[] = [];
          const pushPaymentEntry = (
            storageId: number,
            totalAmount: number,
            entryUsd: number,
          ) => {
            const { description, fullDescription } =
              buildToolsRentPaymentEntryDescription(
                descriptionWithSenderAndAnalitic,
              );
            entries.push({
              debet: useNewAccount ? Schet.S50 : Schet.S00,
              kredit: Schet.S40,
              debetFirstSubcontoId: storageId,
              debetSecondSubcontoId: receiverId,
              kreditFirstSubcontoId: receiverId,
              kreditSecondSubcontoId: storageId,
              count: 0,
              total: totalAmount,
              usd: entryUsd,
              description,
              fullDescription,
            });
          };

          const resolveCashStorageId = async (): Promise<number> => {
            const cashStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "cash",
              );
            if (!cashStorage) {
              throw new Error(
                "TransferSubleaseToolsToClient: не найдена касса «Накд»",
              );
            }
            return cashStorage.id;
          };

          if (cashPayment > 0) {
            pushPaymentEntry(await resolveCashStorageId(), cashPayment, 0);
          }
          if (plasticPayment > 0) {
            const plasticStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "plastic",
              );
            if (!plasticStorage) {
              throw new Error(
                "TransferSubleaseToolsToClient: не найдена касса «Пластик»",
              );
            }
            pushPaymentEntry(plasticStorage.id, plasticPayment, 0);
          }
          if (usdAmount > 0 && currencyRate > 0) {
            const foreignStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "foreignCash",
              );
            if (!foreignStorage) {
              throw new Error(
                "TransferSubleaseToolsToClient: не найдена валютная касса",
              );
            }
            pushPaymentEntry(
              foreignStorage.id,
              currencyRate * usdAmount,
              usdAmount,
            );
          }
          if (changeToClient > 0) {
            const cashStorageId = await resolveCashStorageId();
            const { description, fullDescription } =
              buildToolsChangeToClientEntryDescription(
                descriptionWithSenderAndAnalitic,
              );
            entries.push({
              debet: Schet.S40,
              kredit: useNewAccount ? Schet.S50 : Schet.S00,
              debetFirstSubcontoId: receiverId,
              debetSecondSubcontoId: cashStorageId,
              kreditFirstSubcontoId: cashStorageId,
              kreditSecondSubcontoId: receiverId,
              count: 0,
              total: changeToClient,
              usd: 0,
              description,
              fullDescription,
            });
          }
          return entries.length ? entries : null;
        }
        return null;

      case DocumentType.ReceiveSubleaseToolsFromClient: {
        if (entryType === "primaryEntry" && tableItem) {
          const toolId = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          return {
            debet: Schet.S00,
            kredit: Schet.S13,
            debetFirstSubcontoId: receiverId,
            debetSecondSubcontoId: toolId,
            kreditFirstSubcontoId: receiverId,
            kreditSecondSubcontoId: toolId,
            count: getTableItemValue<number>(tableItem, doc, "count", 0),
            total: 0,
            usd: usd ?? 0,
          };
        }

        if (entryType === "crossEntry" && tableItem) {
          if ((tableItem.tableType || "return") !== "return") return null;
          const toolId = getTableItemValue<number | null>(
            tableItem,
            doc,
            "analiticId",
            null,
          );
          if (!toolId) return null;

          const rentSum = parseNumberOrFallback(
            getTableItemValue(tableItem, doc, "rentSum", 0),
            0,
          );
          const discount = parseNumberOrFallback(
            getTableItemValue(tableItem, doc, "price", 0),
            0,
          );
          const rentNet = Math.max(0, rentSum - discount);
          const partnerRentSum = parseNumberOrFallback(
            getTableItemValue(tableItem, doc, "partnerRentSum", 0),
            0,
          );
          const partnerId = doc.docValues?.partnerId;

          const entries: ResultgetValuesForEntry[] = [];
          if (rentNet > 0) {
            const { description, fullDescription } =
              buildToolsRentIncomeEntryDescription(
                descriptionWithSenderAndAnalitic,
              );
            entries.push({
              debet: Schet.S40,
              kredit: Schet.S90,
              debetFirstSubcontoId: senderId,
              debetSecondSubcontoId: receiverId,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: toolId,
              count: getTableItemValue<number>(tableItem, doc, "count", 0),
              total: rentNet,
              usd: usd ?? 0,
              description,
              fullDescription,
            });
          }
          if (partnerRentSum > 0 && partnerId) {
            entries.push({
              debet: Schet.S91,
              kredit: Schet.S60,
              debetFirstSubcontoId: partnerId,
              debetSecondSubcontoId: toolId,
              kreditFirstSubcontoId: partnerId,
              kreditSecondSubcontoId: toolId,
              count: getTableItemValue<number>(tableItem, doc, "count", 0),
              total: partnerRentSum,
              usd: usd ?? 0,
              description: (
                senderName
                  ? `субаренда | мижоз: ${senderName}`
                  : "субаренда"
              ).substring(0, 255),
            });
          }
          return entries.length ? entries : null;
        }

        if (entryType === "thirdEntry" && !tableItem) {
          const cashPayment =
            parseNumberOrFallback(doc.docValues?.initialPayment, 0) ||
            parseNumberOrFallback(doc.docValues?.cashReceived, 0);
          const plasticPayment =
            parseNumberOrFallback(cashFromPartner, 0) ||
            parseNumberOrFallback(doc.docValues?.plasticReceived, 0);
          const usdAmount = parseNumberOrFallback(usd, 0);
          const currencyRate = parseNumberOrFallback(
            doc.docValues?.currency,
            0,
          );
          const changeToClient = parseNumberOrFallback(
            doc.docValues?.changeToClient,
            0,
          );

          if (
            cashPayment <= 0 &&
            plasticPayment <= 0 &&
            (usdAmount <= 0 || currencyRate <= 0) &&
            changeToClient <= 0
          ) {
            return null;
          }

          let enterpriseId: number | null = doc.enterpriseId ?? null;
          if (!enterpriseId && receiverId) {
            const receiverRef =
              await referencesService.getReferenceById(receiverId);
            enterpriseId = receiverRef?.enterpriseId ?? null;
          }
          if (!enterpriseId) {
            throw new Error(
              "ReceiveSubleaseToolsFromClient: не удалось определить enterpriseId",
            );
          }

          const entries: ResultgetValuesForEntry[] = [];
          const pushReceivePaymentEntry = (
            storageId: number,
            totalAmount: number,
            entryUsd: number,
          ) => {
            const { description, fullDescription } =
              buildToolsRentPaymentEntryDescription(
                descriptionWithSenderAndAnalitic,
              );
            entries.push({
              debet: useNewAccount ? Schet.S50 : Schet.S00,
              kredit: Schet.S40,
              debetFirstSubcontoId: storageId,
              debetSecondSubcontoId: senderId,
              kreditFirstSubcontoId: senderId,
              kreditSecondSubcontoId: storageId,
              count: 0,
              total: totalAmount,
              usd: entryUsd,
              description,
              fullDescription,
            });
          };

          const resolveReceiveCashStorageId = async (): Promise<number> => {
            if (analiticId) return analiticId;
            const cashStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "cash",
              );
            if (!cashStorage) {
              throw new Error(
                "ReceiveSubleaseToolsFromClient: не найдена касса «Накд»",
              );
            }
            return cashStorage.id;
          };

          if (cashPayment > 0) {
            pushReceivePaymentEntry(
              await resolveReceiveCashStorageId(),
              cashPayment,
              0,
            );
          }
          if (plasticPayment > 0) {
            const plasticStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "plastic",
              );
            if (!plasticStorage) {
              throw new Error(
                "ReceiveSubleaseToolsFromClient: не найдена касса «Пластик»",
              );
            }
            pushReceivePaymentEntry(plasticStorage.id, plasticPayment, 0);
          }
          if (usdAmount > 0 && currencyRate > 0) {
            const foreignStorage =
              await referencesService.findCashStorageByEnterpriseId(
                enterpriseId,
                "foreignCash",
              );
            if (!foreignStorage) {
              throw new Error(
                "ReceiveSubleaseToolsFromClient: не найдена валютная касса",
              );
            }
            pushReceivePaymentEntry(
              foreignStorage.id,
              currencyRate * usdAmount,
              usdAmount,
            );
          }
          if (changeToClient > 0) {
            const cashStorageId = await resolveReceiveCashStorageId();
            const { description, fullDescription } =
              buildToolsChangeToClientEntryDescription(
                descriptionWithSenderAndAnalitic,
              );
            entries.push({
              debet: Schet.S40,
              kredit: useNewAccount ? Schet.S50 : Schet.S00,
              debetFirstSubcontoId: senderId,
              debetSecondSubcontoId: cashStorageId,
              kreditFirstSubcontoId: cashStorageId,
              kreditSecondSubcontoId: senderId,
              count: 0,
              total: changeToClient,
              usd: 0,
              description,
              fullDescription,
            });
          }
          return entries.length ? entries : null;
        }
        return null;
      }

      case DocumentType.ZpCalculate:
        return {
          debet: Schet.S20,
          kredit: Schet.S67,
          debetFirstSubcontoId: receiverId,
          debetSecondSubcontoId: analiticId || null,
          debetThirdSubcontoId: productForChargeId,
          kreditFirstSubcontoId: analiticId || null,
          kreditSecondSubcontoId: receiverId,
          count: count ?? 0,
          total: total ?? 0,
          usd: usd ?? 0,
          targetEnterpriseId: doc.targetEnterpriseId ?? null,
        };

      case DocumentType.TakeProfit:
        return {
          debet: Schet.S00,
          kredit: Schet.S66,
          debetFirstSubcontoId: null,
          debetSecondSubcontoId: null,
          kreditFirstSubcontoId: receiverId,
          kreditSecondSubcontoId: null,
          count: count ?? 0,
          total: total ?? 0,
          usd: usd ?? 0,
        };

      case DocumentType.ServicesFromPartners:
        return {
          debet: Schet.S20,
          kredit: isDepartment || !isSender ? Schet.S41 : Schet.S60,
          debetFirstSubcontoId: receiverId,
          debetSecondSubcontoId: analiticId || null,
          debetThirdSubcontoId: productForChargeId,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: receiverId,
          count: count ?? 0,
          total: total ?? 0,
          usd: usd ?? 0,
        };

      case DocumentType.ServicesToClients:
        return {
          debet: Schet.S40,
          kredit: Schet.S90,
          debetFirstSubcontoId: receiverId,
          debetSecondSubcontoId: senderId,
          kreditFirstSubcontoId: senderId,
          kreditSecondSubcontoId: analiticId || null,
          count: count ?? 0,
          total: total ?? 0,
          usd: usd ?? 0,
        };
    }
  }

  return {
    debet: Schet.S00,
    debetFirstSubcontoId: null,
    debetSecondSubcontoId: null,
    debetThirdSubcontoId: null,
    kredit: Schet.S00,
    kreditFirstSubcontoId: null,
    kreditSecondSubcontoId: null,
    kreditThirdSubcontoId: null,
    count: 0,
    total: 0,
    description: "",
    usd: 0,
  };
};
