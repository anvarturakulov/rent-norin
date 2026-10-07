import {
  TypeReference,
  TypeTMZ,
  ProductionType,
} from "src/interfaces/reference.interface";
import { Sequelize } from "sequelize-typescript";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { DocumentsService } from "src/documents/documents.service";
import { DocumentType, DocSTATUS } from "src/interfaces/document.interface";
import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocValues } from "src/docValues/docValues.model";
import { Pereodic } from "src/pereodic/pereodic.model";
import { Op } from "sequelize";
import { getComeProductIncomeLines } from "../svod/helpers";

const BETON_WORKSHOP_ID = 22399;

export interface IncomeDetailByDocument {
  docType: string;
  docId: number;
  docDate: number;
  productId: number;
  productName: string;
  count: number;
  price: number;
  total: number;
  priceSource?: "refValues" | "pereodic";
  pereodicDate?: number;
  usedThirdPrice?: number;
}

export interface IncomeDetailByProduct {
  productId: number;
  productName: string;
  totalCount: number;
  avgPrice: number;
  totalSum: number;
  detailsCount: number;
}

export interface IncomeDetailsResult {
  summary: number;
  byDocuments: IncomeDetailByDocument[];
  byProducts: IncomeDetailByProduct[];
}

/**
 * Получает детализацию дохода для цеха "Бетон цех" на основе продаж
 */
const getBetonWorkshopIncomeDetails = async (
  workshopId: number,
  references: Reference[],
  startDate: number | null,
  endDate: number | null,
  documentsService: DocumentsService,
  sequelize: Sequelize,
  enterpriseId?: number | null,
): Promise<IncomeDetailsResult> => {
  const result: IncomeDetailsResult = {
    summary: 0,
    byDocuments: [],
    byProducts: [],
  };

  if (!startDate || !endDate) {
    return result;
  }

  try {
    // Получаем товары бетона напрямую из базы данных, независимо от массива references
    // который может быть отфильтрован по правам доступа пользователя
    // ВАЖНО: Товары бетона выбираем БЕЗ фильтра по enterpriseId, так как они могут быть
    // заведены на уровне ADMINGLOBAL (enterpriseId = null) и должны использоваться для всех предприятий
    const betonProductWhere: any = {
      typeReference: TypeReference.TMZ,
    };

    const betonProducts = await Reference.findAll({
      where: betonProductWhere,
      include: [
        {
          model: RefValues,
          as: "refValues",
          required: true,
          where: {
            typeTMZ: TypeTMZ.PRODUCT,
            productionType: ProductionType.BETON,
            [Op.or]: [{ markToDeleted: false }, { markToDeleted: null }],
          },
        },
      ],
      attributes: ["id", "name", "enterpriseId"],
    });

    const betonProductIds = new Set<number>();
    const productsById = new Map<number, Reference>();

    for (const product of betonProducts) {
      if (product.id) {
        betonProductIds.add(product.id);
        productsById.set(product.id, product);
      }
    }

    if (betonProductIds.size === 0) {
      console.log(
        `[getBetonWorkshopIncomeDetails] Нет товаров с productionType=BETON, возвращаем пустой результат`,
      );
      return result;
    }

    // Получаем все документы SaleProd
    // ВАЖНО: Фильтруем документы аналогично getAllDocumentsByType - учитываем межпредприятийные документы
    let saleWhere: any;

    if (enterpriseId !== undefined && enterpriseId !== null) {
      // Для конкретного предприятия учитываем:
      // 1. Обычные документы с enterpriseId = выбранное предприятие
      // 2. Межпредприятийные документы, где выбранное предприятие - отправитель
      // 3. Межпредприятийные документы, где выбранное предприятие - получатель (через documentTypeForReceiver)
      saleWhere = {
        [Op.or]: [
          // Обычные документы пользователя
          { enterpriseId: enterpriseId, documentType: DocumentType.SaleProd },
          // Межпредприятийные документы, где пользователь - отправитель (ищем по documentType)
          {
            isInterEnterprise: true,
            sourceEnterpriseId: enterpriseId,
            documentType: DocumentType.SaleProd,
          },
          // Межпредприятийные документы, где пользователь - получатель (ищем по documentTypeForReceiver)
          // Исключаем документы со статусом OPEN (отмененные отправки)
          {
            isInterEnterprise: true,
            targetEnterpriseId: enterpriseId,
            documentTypeForReceiver: DocumentType.SaleProd,
            docStatus: { [Op.ne]: DocSTATUS.OPEN },
          },
        ],
      };
    } else {
      // Для ADMINGLOBAL (enterpriseId = null) показываем все документы SaleProd
      saleWhere = {
        [Op.or]: [
          { documentType: DocumentType.SaleProd },
          {
            isInterEnterprise: true,
            documentTypeForReceiver: DocumentType.SaleProd,
          },
          { isInterEnterprise: true, documentType: DocumentType.SaleProd },
        ],
      };
    }

    const saleProdDocs = await Document.findAll({
      where: saleWhere,
      include: [
        {
          model: DocValues,
          as: "docValues",
        },
        {
          model: DocTableItems,
          as: "docTableItems",
        },
      ],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    });

    // Фильтруем по статусу PROVEDEN и по дате периода отчета
    const provedenSaleProdDocs = saleProdDocs.filter((doc: any) => {
      const docDate = Number(doc.date);
      const isDateInRange = docDate >= startDate && docDate <= endDate;
      const isProveden = doc.docStatus === DocSTATUS.PROVEDEN;
      return isDateInRange && isProveden;
    });

    console.log(
      `[getBetonWorkshopIncomeDetails] Найдено документов SaleProd со статусом PROVEDEN: ${provedenSaleProdDocs.length}`,
    );

    // Собираем детализацию
    const productDetailsMap = new Map<
      number,
      {
        totalCount: number;
        totalSum: number;
        detailsCount: number;
        prices: number[];
      }
    >();

    for (const doc of provedenSaleProdDocs) {
      if (!doc.docTableItems || doc.docTableItems.length === 0) {
        continue;
      }

      for (const tableItem of doc.docTableItems) {
        const productId = tableItem.analiticId;
        if (!productId || !betonProductIds.has(productId)) {
          continue;
        }

        const product = productsById.get(productId);
        const count = Number(tableItem.count) || 0;
        const price = Number(tableItem.price) || 0;
        const total = Number(tableItem.total) || 0;

        // Пропускаем нулевые и отрицательные суммы
        if (total <= 0) {
          continue;
        }

        // Добавляем в детализацию по документам
        result.byDocuments.push({
          docType: "SaleProd",
          docId: Number(doc.id),
          docDate: Number(doc.date),
          productId: productId,
          productName: product?.name || `Товар ID: ${productId}`,
          count: count,
          price: price,
          total: total,
        });

        // Обновляем агрегацию по продуктам
        if (!productDetailsMap.has(productId)) {
          productDetailsMap.set(productId, {
            totalCount: 0,
            totalSum: 0,
            detailsCount: 0,
            prices: [],
          });
        }

        const productDetails = productDetailsMap.get(productId)!;
        productDetails.totalCount += count;
        productDetails.totalSum += total;
        productDetails.detailsCount += 1;
        if (price > 0) {
          productDetails.prices.push(price);
        }
      }
    }

    // Формируем агрегацию по продуктам
    for (const [productId, details] of productDetailsMap.entries()) {
      const product = productsById.get(productId);
      const avgPrice =
        details.prices.length > 0
          ? details.prices.reduce((sum, p) => sum + p, 0) /
            details.prices.length
          : details.totalCount > 0
            ? details.totalSum / details.totalCount
            : 0;

      result.byProducts.push({
        productId: productId,
        productName: product?.name || `Товар ID: ${productId}`,
        totalCount: details.totalCount,
        avgPrice: avgPrice,
        totalSum: details.totalSum,
        detailsCount: details.detailsCount,
      });
    }

    // Сортируем по дате документа
    result.byDocuments.sort((a, b) => a.docDate - b.docDate);

    // Сортируем по сумме (убывание)
    result.byProducts.sort((a, b) => b.totalSum - a.totalSum);

    // Рассчитываем итоговую сумму
    result.summary = result.byDocuments.reduce(
      (sum, item) => sum + item.total,
      0,
    );

    return result;
  } catch (error) {
    console.error("[getBetonWorkshopIncomeDetails] Ошибка:", error);
    return result;
  }
};

/**
 * Получает детализацию дохода для обычных цехов на основе ComeProduct
 */
const getRegularWorkshopIncomeDetails = async (
  workshopId: number,
  references: Reference[],
  startDate: number | null,
  endDate: number | null,
  documentsService: DocumentsService,
  sequelize: Sequelize,
  enterpriseId?: number | null,
): Promise<IncomeDetailsResult> => {
  const result: IncomeDetailsResult = {
    summary: 0,
    byDocuments: [],
    byProducts: [],
  };

  if (!startDate || !endDate) {
    return result;
  }

  try {
    // Получаем все документы ComeProduct
    const where: any = {
      documentType: DocumentType.ComeProduct,
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const comeProductDocs = await Document.findAll({
      where,
      include: [
        {
          model: DocValues,
          as: "docValues",
        },
        {
          model: DocTableItems,
          as: "docTableItems",
        },
      ],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    });

    // Фильтруем по дате
    const filteredDocs = comeProductDocs.filter((doc: any) => {
      const docDate = Number(doc.date);
      const isInRange = docDate >= startDate && docDate <= endDate;
      if (!isInRange) {
        console.log(
          `[getRegularWorkshopIncomeDetails] Документ ComeProduct ${doc.id} вне диапазона: docDate=${docDate}, startDate=${startDate}, endDate=${endDate}`,
        );
      }
      return isInRange;
    });

    console.log(
      `[getRegularWorkshopIncomeDetails] Найдено документов ComeProduct в диапазоне: ${filteredDocs.length} из ${comeProductDocs.length}`,
    );

    // Создаем карту товаров
    const productsById = new Map<number, Reference>();
    const productRefs = references.filter(
      (ref: Reference) =>
        ref.typeReference === TypeReference.TMZ &&
        ref.refValues?.typeTMZ === TypeTMZ.PRODUCT,
    );

    for (const product of productRefs) {
      if (product.id) {
        productsById.set(product.id, product);
      }
    }

    // Загружаем периодические значения thirdPrice
    const productIds = Array.from(productsById.keys());
    const thirdPriceMap = new Map<number, Map<number, number>>();

    if (productIds.length > 0 && endDate) {
      try {
        const pereodicWhere: any = {
          referenceId: { [Op.in]: productIds },
          name: "thirdPrice",
          date: { [Op.lte]: endDate },
        };

        if (enterpriseId !== undefined && enterpriseId !== null) {
          pereodicWhere[Op.or] = [
            { enterpriseId: enterpriseId },
            { enterpriseId: null },
          ];
        } else {
          pereodicWhere.enterpriseId = null;
        }

        const allPereodics = await Pereodic.findAll({
          where: pereodicWhere,
          order: [
            ["referenceId", "ASC"],
            ["date", "ASC"],
          ],
        });

        for (const pereodic of allPereodics) {
          const refId = pereodic.referenceId;
          const date = Number(pereodic.date);
          const value = pereodic.value || 0;

          if (!thirdPriceMap.has(refId)) {
            thirdPriceMap.set(refId, new Map());
          }
          thirdPriceMap.get(refId)!.set(date, value);
        }
      } catch (error) {
        console.error(
          "[getRegularWorkshopIncomeDetails] Ошибка загрузки периодических значений:",
          error,
        );
      }
    }

    // Функция для получения thirdPrice
    const getThirdPriceForEndDate = (
      productId: number,
    ): {
      price: number;
      source: "refValues" | "pereodic";
      pereodicDate?: number;
    } => {
      const product = productsById.get(productId);
      if (product?.refValues?.thirdPrice) {
        return { price: product.refValues.thirdPrice, source: "refValues" };
      }

      const pereodicMap = thirdPriceMap.get(productId);
      if (pereodicMap && pereodicMap.size > 0) {
        let lastValue = 0;
        let lastDate = 0;
        for (const [pereodicDate, value] of pereodicMap.entries()) {
          if (pereodicDate <= endDate && pereodicDate > lastDate) {
            lastDate = pereodicDate;
            lastValue = value;
          }
        }
        if (lastValue > 0) {
          return {
            price: lastValue,
            source: "pereodic",
            pereodicDate: lastDate,
          };
        }
      }

      return { price: 0, source: "refValues" };
    };

    // Обрабатываем документы
    const productDetailsMap = new Map<
      number,
      {
        totalCount: number;
        totalSum: number;
        detailsCount: number;
        prices: number[];
      }
    >();

    let docsWithCorrectSenderId = 0;
    let docsWithWrongSenderId = 0;

    for (const doc of filteredDocs) {
      const incomeLines = getComeProductIncomeLines(doc);
      if (!incomeLines.length) {
        console.log(
          `[getRegularWorkshopIncomeDetails] Документ ComeProduct ${doc.id} без позиций прихода`,
        );
        continue;
      }

      const docSenderId = Number(doc.docValues?.senderId);
      const expectedWorkshopId = Number(workshopId);

      if (docSenderId !== expectedWorkshopId) {
        docsWithWrongSenderId++;
        if (docsWithWrongSenderId <= 3) {
          console.log(
            `[getRegularWorkshopIncomeDetails] Документ ComeProduct ${doc.id}: senderId=${docSenderId}, ожидался=${expectedWorkshopId}, date=${doc.date}`,
          );
        }
        continue;
      }

      docsWithCorrectSenderId++;
      if (docsWithCorrectSenderId <= 3) {
        console.log(
          `[getRegularWorkshopIncomeDetails] Найден документ ComeProduct ${doc.id} с правильным senderId=${docSenderId}, date=${doc.date}, позиций=${incomeLines.length}`,
        );
      }

      for (const line of incomeLines) {
        const productId = line.analiticId;
        const count = line.count;

        if (!productId || count === 0) {
          continue;
        }

        const product = productsById.get(productId);
        if (!product) {
          continue;
        }

        const thirdPriceInfo = getThirdPriceForEndDate(productId);
        if (!thirdPriceInfo.price || thirdPriceInfo.price === 0) {
          continue;
        }

        const income = count * thirdPriceInfo.price;

        // Добавляем в детализацию по документам
        result.byDocuments.push({
          docType: "ComeProduct",
          docId: Number(doc.id),
          docDate: Number(doc.date),
          productId: productId,
          productName: product.name,
          count: count,
          price: thirdPriceInfo.price,
          total: income,
          priceSource: thirdPriceInfo.source,
          pereodicDate: thirdPriceInfo.pereodicDate,
          usedThirdPrice: thirdPriceInfo.price,
        });

        // Обновляем агрегацию по продуктам
        if (!productDetailsMap.has(productId)) {
          productDetailsMap.set(productId, {
            totalCount: 0,
            totalSum: 0,
            detailsCount: 0,
            prices: [],
          });
        }

        const productDetails = productDetailsMap.get(productId)!;
        productDetails.totalCount += count;
        productDetails.totalSum += income;
        productDetails.detailsCount += 1;
        productDetails.prices.push(thirdPriceInfo.price);
      }
    }

    console.log(
      `[getRegularWorkshopIncomeDetails] Документов с правильным senderId: ${docsWithCorrectSenderId}, с неправильным: ${docsWithWrongSenderId}`,
    );
    console.log(
      `[getRegularWorkshopIncomeDetails] Найдено документов в детализации: ${result.byDocuments.length}`,
    );

    // Формируем агрегацию по продуктам
    for (const [productId, details] of productDetailsMap.entries()) {
      const product = productsById.get(productId);
      const avgPrice =
        details.prices.length > 0
          ? details.prices.reduce((sum, p) => sum + p, 0) /
            details.prices.length
          : 0;

      result.byProducts.push({
        productId: productId,
        productName: product?.name || `Товар ID: ${productId}`,
        totalCount: details.totalCount,
        avgPrice: avgPrice,
        totalSum: details.totalSum,
        detailsCount: details.detailsCount,
      });
    }

    // Сортируем по дате документа
    result.byDocuments.sort((a, b) => a.docDate - b.docDate);

    // Сортируем по сумме (убывание)
    result.byProducts.sort((a, b) => b.totalSum - a.totalSum);

    // Рассчитываем итоговую сумму
    result.summary = result.byDocuments.reduce(
      (sum, item) => sum + item.total,
      0,
    );

    return result;
  } catch (error) {
    console.error("[getRegularWorkshopIncomeDetails] Ошибка:", error);
    return result;
  }
};

/**
 * Получает детализацию дохода для цеха
 */
export const getIncomeDetails = async (
  workshopId: number,
  references: Reference[],
  startDate: number | null,
  endDate: number | null,
  documentsService: DocumentsService,
  sequelize: Sequelize,
  enterpriseId?: number | null,
): Promise<IncomeDetailsResult> => {
  // Для цеха "Бетон цех" используем специальную логику
  if (workshopId === BETON_WORKSHOP_ID) {
    return await getBetonWorkshopIncomeDetails(
      workshopId,
      references,
      startDate,
      endDate,
      documentsService,
      sequelize,
      enterpriseId,
    );
  } else {
    return await getRegularWorkshopIncomeDetails(
      workshopId,
      references,
      startDate,
      endDate,
      documentsService,
      sequelize,
      enterpriseId,
    );
  }
};
