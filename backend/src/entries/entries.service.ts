import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Entry } from "./entry.model";
import { QueryOperationsBySchet, Schet } from "src/interfaces/report.interface";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";

@Injectable()
export class EntriesService {
  constructor(@InjectModel(Entry) private entryRepository: typeof Entry) {}

  async getAllEntries(enterpriseId?: number | null) {
    const where: any = {};

    // Если enterpriseId указан, фильтруем по нему
    // Если enterpriseId = null, возвращаем все entries (для общего отчета)
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    // Не загружаем связанные Reference, чтобы избежать проблем с BelongsTo связями
    // и ускорить запрос, так как для отчетов oborotka мы используем данные из Oborot
    const references = await this.entryRepository.findAll({
      where: Object.keys(where).length > 0 ? where : undefined,
      // Явно исключаем загрузку связей Reference, чтобы избежать проблем
      // с BelongsTo связями, которые могут фильтровать записи
      attributes: {
        exclude: [], // Загружаем все атрибуты, но не связи
      },
    });
    return references;
  }

  async getAllEntriesBySchet(queryAnalitic: QueryOperationsBySchet) {
    const {
      startDate,
      endDate,
      schet,
      firstSubcontoId,
      enterpriseId,
      includeDocumentUser,
    } = queryAnalitic;

    if (startDate && endDate && schet) {
      const whereConditions: any = {
        date: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
        [Op.or]: [{ debet: schet }, { kredit: schet }],
      };

      const andConditions: any[] = [];

      if (firstSubcontoId) {
        andConditions.push({
          [Op.or]: [
            { debetFirstSubcontoId: firstSubcontoId },
            { kreditFirstSubcontoId: firstSubcontoId },
          ],
        });
      }

      // Добавляем фильтрацию по enterpriseId, если указан
      if (enterpriseId !== undefined && enterpriseId !== null) {
        andConditions.push({ enterpriseId });
      }

      if (andConditions.length > 0) {
        whereConditions[Op.and] = andConditions;
      }

      const include = includeDocumentUser
        ? [
            {
              association: "document",
              attributes: ["id", "userId"],
              required: false,
              include: [
                {
                  association: "user",
                  attributes: ["id", "name"],
                  required: false,
                },
              ],
            },
          ]
        : undefined;

      const result = await this.entryRepository.findAll({
        where: whereConditions,
        include,
      });

      return result;
    }

    return [];
  }

  async getEntriesByExpenseType(
    debet: Schet,
    kredit: Schet,
    startDate: number,
    endDate: number,
    debetFirstSubcontoId: number,
    enterpriseId?: number | null,
  ) {
    const whereConditions: any = {
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
      debet: debet,
      kredit: kredit,
      debetFirstSubcontoId: debetFirstSubcontoId,
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      whereConditions.enterpriseId = enterpriseId;
    }

    const result = await this.entryRepository.findAll({
      where: whereConditions,
      include: [
        { association: "document" },
        { association: "debetFirstSubcontoReference" },
        { association: "kreditFirstSubcontoReference" },
        { association: "debetSecondSubcontoReference" },
        { association: "kreditSecondSubcontoReference" },
      ],
      order: [["date", "ASC"]],
    });

    return result;
  }

  async getEntriesByDebetKredit(
    debet: Schet,
    kredit: Schet,
    startDate: number,
    endDate: number,
    subcontoId: number | null,
    subcontoInDebet: boolean, // true если subcontoId в дебете, false если в кредите
    enterpriseId?: number | null,
  ) {
    const whereConditions: any = {
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
      debet: debet,
      kredit: kredit,
    };

    if (subcontoId !== null && subcontoId !== undefined) {
      if (subcontoInDebet) {
        whereConditions.debetFirstSubcontoId = subcontoId;
      } else {
        whereConditions.kreditFirstSubcontoId = subcontoId;
      }
    }

    if (enterpriseId !== undefined && enterpriseId !== null) {
      whereConditions.enterpriseId = enterpriseId;
    }

    const result = await this.entryRepository.findAll({
      where: whereConditions,
      include: [
        { association: "document" },
        { association: "debetFirstSubcontoReference" },
        { association: "kreditFirstSubcontoReference" },
        { association: "debetSecondSubcontoReference" },
        { association: "kreditSecondSubcontoReference" },
      ],
      order: [["date", "ASC"]],
    });

    return result;
  }

  async getEntriesByDebetKreditBatch(
    debet: Schet,
    kredit: Schet,
    startDate: number,
    endDate: number,
    subcontoIds: number[] | null,
    subcontoInDebet: boolean, // true если subconто в дебете, false если в кредите
    enterpriseId?: number | null,
  ) {
    const whereConditions: any = {
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
      debet: debet,
      kredit: kredit,
    };

    if (Array.isArray(subcontoIds) && subcontoIds.length > 0) {
      if (subcontoInDebet) {
        whereConditions.debetFirstSubcontoId = { [Op.in]: subcontoIds };
      } else {
        whereConditions.kreditFirstSubcontoId = { [Op.in]: subcontoIds };
      }
    }

    if (enterpriseId !== undefined && enterpriseId !== null) {
      whereConditions.enterpriseId = enterpriseId;
    }

    const result = await this.entryRepository.findAll({
      where: whereConditions,
      include: [
        { association: "document" },
        { association: "debetFirstSubcontoReference" },
        { association: "kreditFirstSubcontoReference" },
        { association: "debetSecondSubcontoReference" },
        { association: "kreditSecondSubcontoReference" },
      ],
      order: [["date", "ASC"]],
    });

    return result;
  }

  /**
   * Сумма проводок дохода по заказу: Дт 40/41 — Кт 90 за период.
   * Сначала ищет по entries.orderId; для старых отгрузок — fallback по saleDocId.
   */
  async getOrderSaleIncome(
    orderId: number,
    saleDocId: number | null | undefined,
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ): Promise<number> {
    const dateFilter = {
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    };

    const schetFilter = {
      debet: { [Op.in]: [Schet.S40, Schet.S41] },
      kredit: Schet.S90,
    };

    const orderLink: any[] = [{ orderId }];
    if (saleDocId != null && saleDocId > 0) {
      orderLink.push({ orderId: null, docId: saleDocId });
    }

    const where: any = {
      ...dateFilter,
      ...schetFilter,
      [Op.or]: orderLink,
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const sumResult = await this.entryRepository.sum("total", { where });
    return sumResult ? Number(sumResult) : 0;
  }

  /**
   * Проводки дохода по заказу: Дт 40/41 — Кт 90 за период.
   */
  async getOrderIncomeEntries(
    orderId: number,
    saleDocId: number | null | undefined,
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ) {
    const orderLink: any[] = [{ orderId }];
    if (saleDocId != null && saleDocId > 0) {
      orderLink.push({ orderId: null, docId: saleDocId });
    }

    const where: any = {
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
      debet: { [Op.in]: [Schet.S40, Schet.S41] },
      kredit: Schet.S90,
      [Op.or]: orderLink,
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    return this.entryRepository.findAll({
      where,
      include: [
        { association: "document" },
        { association: "debetFirstSubcontoReference" },
        { association: "kreditFirstSubcontoReference" },
        { association: "debetSecondSubcontoReference" },
        { association: "kreditSecondSubcontoReference" },
      ],
      order: [["date", "ASC"]],
    });
  }

  /**
   * Проводки расходов по заказу: Дт 20 — Кт {kredit} за период.
   * orderId = null — накладные расходы без привязки к заказу.
   */
  async getOrderExpenseEntries(
    debet: Schet,
    kredit: Schet,
    orderId: number | null,
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ) {
    const where: any = {
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
      debet,
      kredit,
      orderId: orderId ?? null,
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    return this.entryRepository.findAll({
      where,
      include: [
        { association: "document" },
        { association: "debetFirstSubcontoReference" },
        { association: "kreditFirstSubcontoReference" },
        { association: "debetSecondSubcontoReference" },
        { association: "kreditSecondSubcontoReference" },
      ],
      order: [["date", "ASC"]],
    });
  }

  /**
   * Заказы с выручкой за период: Дт 40/41 — Кт 90, только проводки с orderId.
   */
  async getOrderIdsWithSaleIncome(
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ): Promise<number[]> {
    const where: any = {
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
      debet: { [Op.in]: [Schet.S40, Schet.S41] },
      kredit: Schet.S90,
      orderId: { [Op.ne]: null },
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const rows = await this.entryRepository.findAll({
      where,
      attributes: ["orderId"],
      group: ["orderId"],
      raw: true,
    });

    return rows
      .map((r: any) => Number(r.orderId))
      .filter((id) => Number.isFinite(id) && id > 0)
      .sort((a, b) => a - b);
  }

  /**
   * saleDocId заказов — чтобы не считать старые отгрузки без orderId дважды
   * (они уже входят в доход заказа через fallback по saleDocId).
   */
  private async getSaleDocIdsToExcludeFromUnallocated(
    enterpriseId?: number | null,
  ): Promise<number[]> {
    const where: any = {
      saleDocId: { [Op.ne]: null },
    };
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }
    const rows = await FurnitureOrder.findAll({
      where,
      attributes: ["saleDocId"],
      raw: true,
    });
    return rows
      .map((r: any) => Number(r.saleDocId))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private unallocatedIncomeWhere(
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
    excludeDocIds: number[] = [],
  ) {
    const where: any = {
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
      debet: { [Op.in]: [Schet.S40, Schet.S41] },
      kredit: Schet.S90,
      orderId: null,
    };
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }
    if (excludeDocIds.length > 0) {
      where.docId = { [Op.notIn]: excludeDocIds };
    }
    return where;
  }

  /**
   * Доход без заказа: Дт 40/41 — Кт 90, orderId IS NULL.
   * Исключает старые отгрузки, привязанные к заказу через saleDocId.
   */
  async getUnallocatedSaleIncome(
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ): Promise<number> {
    const excludeDocIds =
      await this.getSaleDocIdsToExcludeFromUnallocated(enterpriseId);
    const where = this.unallocatedIncomeWhere(
      startDate,
      endDate,
      enterpriseId,
      excludeDocIds,
    );
    const sumResult = await this.entryRepository.sum("total", { where });
    return sumResult ? Number(sumResult) : 0;
  }

  /**
   * Проводки дохода без заказа: Дт 40/41 — Кт 90, orderId IS NULL.
   */
  async getUnallocatedIncomeEntries(
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ) {
    const excludeDocIds =
      await this.getSaleDocIdsToExcludeFromUnallocated(enterpriseId);
    const where = this.unallocatedIncomeWhere(
      startDate,
      endDate,
      enterpriseId,
      excludeDocIds,
    );
    return this.entryRepository.findAll({
      where,
      include: [
        { association: "document" },
        { association: "debetFirstSubcontoReference" },
        { association: "kreditFirstSubcontoReference" },
        { association: "debetSecondSubcontoReference" },
        { association: "kreditSecondSubcontoReference" },
      ],
      order: [["date", "ASC"]],
    });
  }
}
