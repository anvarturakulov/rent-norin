import { Injectable } from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/sequelize";
import { Sequelize, Transaction, Op } from "sequelize"; // Импорт из sequelize
import { Schet } from "src/interfaces/report.interface";
import { Oborot } from "./oborot.model";
import { EntryCreationAttrs } from "src/entries/entry.model";

@Injectable()
export class OborotsService {
  private schetsWithOneSubconto = [
    Schet.S40,
    Schet.S50,
    Schet.S60,
    Schet.S66,
    Schet.S67,
    Schet.S65,
    Schet.S64,
    Schet.S68,
  ];

  constructor(
    @InjectModel(Oborot) private oborotRepository: typeof Oborot,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  private getWhereClause(entry: EntryCreationAttrs) {
    const {
      date,
      debet,
      debetFirstSubcontoId,
      debetSecondSubcontoId,
      debetThirdSubcontoId,
      kredit,
      kreditFirstSubcontoId,
      kreditSecondSubcontoId,
      kreditThirdSubcontoId,
      enterpriseId,
      orderId,
    } = entry;

    const where: any = { date };
    if (debet) where.debet = debet;
    // Добавляем фильтр только если значение не null и не undefined
    // null значения не добавляются в where, что позволяет найти записи с любым значением
    if (debetFirstSubcontoId !== null && debetFirstSubcontoId !== undefined) {
      where.debetFirstSubcontoId = debetFirstSubcontoId;
    }
    if (debetSecondSubcontoId !== null && debetSecondSubcontoId !== undefined) {
      where.debetSecondSubcontoId = debetSecondSubcontoId;
    }
    if (debetThirdSubcontoId !== null && debetThirdSubcontoId !== undefined) {
      where.debetThirdSubcontoId = debetThirdSubcontoId;
    }
    if (kredit) where.kredit = kredit;
    if (kreditFirstSubcontoId !== null && kreditFirstSubcontoId !== undefined) {
      where.kreditFirstSubcontoId = kreditFirstSubcontoId;
    }
    if (
      kreditSecondSubcontoId !== null &&
      kreditSecondSubcontoId !== undefined
    ) {
      where.kreditSecondSubcontoId = kreditSecondSubcontoId;
    }
    if (kreditThirdSubcontoId !== null && kreditThirdSubcontoId !== undefined) {
      where.kreditThirdSubcontoId = kreditThirdSubcontoId;
    }
    // Заказ — отдельное измерение оборота. NULL (общие расходы) не схлопываем
    // с проводками конкретных заказов, поэтому фильтруем явно (в т.ч. по IS NULL).
    where.orderId =
      orderId !== null && orderId !== undefined ? orderId : null;
    if (enterpriseId) where.enterpriseId = enterpriseId;

    return where;
  }

  async addEntry(
    entry: EntryCreationAttrs,
    transaction?: Transaction,
  ): Promise<Oborot> {
    try {
      if (!entry.enterpriseId) {
        throw new Error(
          "Entry enterpriseId is required for creating oborot entries",
        );
      }

      const where = this.getWhereClause(entry);
      const {
        date,
        debet,
        debetFirstSubcontoId,
        debetSecondSubcontoId,
        debetThirdSubcontoId,
        kredit,
        kreditFirstSubcontoId,
        kreditSecondSubcontoId,
        kreditThirdSubcontoId,
        count,
        total,
        usd,
        enterpriseId,
        orderId,
      } = entry;

      const [oborot, created] = await this.oborotRepository.findOrCreate({
        where,
        defaults: {
          date,
          debet,
          debetFirstSubcontoId,
          debetSecondSubcontoId,
          debetThirdSubcontoId,
          kredit,
          kreditFirstSubcontoId,
          kreditSecondSubcontoId,
          kreditThirdSubcontoId,
          count,
          total,
          usd,
          enterpriseId,
          orderId: orderId ?? null,
        },
        transaction,
      });

      if (!oborot) {
        throw new Error(
          `Failed to find or create oborot for entry (docId=${entry.docId}, debet=${debet}, kredit=${kredit})`,
        );
      }

      if (!created) {
        oborot.count += count;
        oborot.total += total;
        oborot.usd += usd;
        const updatedOborot = await oborot.save({ transaction });
        if (!updatedOborot) {
          throw new Error(
            `Failed to update oborot for entry (docId=${entry.docId}, debet=${debet}, kredit=${kredit})`,
          );
        }
      }

      return oborot;
    } catch (error) {
      console.error("Error in addEntry:", error.message);
      throw new Error(
        `Failed to add oborot entry for docId=${entry.docId}, debet=${entry.debet}, kredit=${entry.kredit}: ${error.message}`,
      );
    }
  }

  async deleteEntry(entry: EntryCreationAttrs, transaction: Transaction) {
    if (!entry.enterpriseId) {
      throw new Error(
        "Entry enterpriseId is required for deleting oborot entries",
      );
    }

    const where = this.getWhereClause(entry);
    const oborot = await this.oborotRepository.findOne({ where, transaction });
    const { count, total, usd } = entry;

    if (!oborot) {
      throw new Error(`Oborot not found for entry (docId) ${entry.docId} 
                      debetFirstSubcontoId ${entry.debetFirstSubcontoId}
                      debetSecondSubcontoId ${entry.debetSecondSubcontoId}
                      kreditFirstSubcontoId ${entry.kreditFirstSubcontoId}
                      kreditSecondSubcontoId ${entry.kreditSecondSubcontoId}
                      `);
    }

    oborot.count -= count;
    oborot.total -= total;
    oborot.usd -= usd;

    try {
      const updatedOborot = await oborot.save({ transaction });
      if (!updatedOborot) {
        throw new Error(`Failed to update oborot for where=${where}`);
      }
    } catch (error) {
      console.error(`Failed to save oborot for docId=${entry.docId}:`, error);
      throw new Error(`Failed to save oborot: ${error.message}`);
    }
  }

  async getClientPaymentsByPeriod(
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ) {
    const where: any = {
      debet: Schet.S50,
      kredit: Schet.S40,
      date: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    return this.oborotRepository.findAll({ where });
  }

  async getOborotByDate(
    typeResult: "COUNT" | "TOTAL" | "USD",
    startDate: number | null,
    endDate: number | null,
    debet: Schet | null,
    debetFirstSubcontoId: number | null,
    debetSecondSubcontoId: number | null,
    debetThirdSubcontoId: number | null,
    kredit: Schet | null,
    kreditFirstSubcontoId: number | null,
    kreditSecondSubcontoId: number | null,
    kreditThirdSubcontoId: number | null,
    transaction?: Transaction,
    enterpriseId?: number | null,
    // undefined = не фильтровать по заказу (сумма по всем заказам),
    // null = только общие расходы (orderId IS NULL),
    // number = конкретный заказ
    orderId?: number | null,
  ) {
    const where: any = {};
    if (debet) where.debet = debet;
    // Добавляем фильтр только если значение не null и не undefined
    // Если null, не фильтруем по этому полю (любое значение)
    if (debetFirstSubcontoId !== null && debetFirstSubcontoId !== undefined) {
      where.debetFirstSubcontoId = debetFirstSubcontoId;
    }
    if (debetSecondSubcontoId !== null && debetSecondSubcontoId !== undefined) {
      where.debetSecondSubcontoId = debetSecondSubcontoId;
    }
    if (debetThirdSubcontoId !== null && debetThirdSubcontoId !== undefined) {
      where.debetThirdSubcontoId = debetThirdSubcontoId;
    }
    if (kredit) where.kredit = kredit;
    if (kreditFirstSubcontoId !== null && kreditFirstSubcontoId !== undefined) {
      where.kreditFirstSubcontoId = kreditFirstSubcontoId;
    }
    if (
      kreditSecondSubcontoId !== null &&
      kreditSecondSubcontoId !== undefined
    ) {
      where.kreditSecondSubcontoId = kreditSecondSubcontoId;
    }
    if (kreditThirdSubcontoId !== null && kreditThirdSubcontoId !== undefined) {
      where.kreditThirdSubcontoId = kreditThirdSubcontoId;
    }

    // Если enterpriseId указан, фильтруем по нему
    // Если enterpriseId = null, не фильтруем (для общего отчета)
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    // Фильтр по заказу: undefined - не фильтруем; null - только общие расходы;
    // число - конкретный заказ
    if (orderId !== undefined) {
      where.orderId = orderId;
    }

    const columnToSum =
      typeResult === "COUNT"
        ? "count"
        : typeResult === "TOTAL"
          ? "total"
          : "usd";

    const finalWhere: any = {
      ...where,
    };

    // Добавляем фильтрацию по датам только если они указаны
    if (
      startDate !== null &&
      startDate !== undefined &&
      endDate !== null &&
      endDate !== undefined
    ) {
      finalWhere.date = {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      };
    }

    const sumResult = await this.oborotRepository.aggregate(
      columnToSum,
      "SUM",
      {
        where: finalWhere,
        dataType: "integer",
        transaction,
      },
    );

    const result = sumResult ? Number(sumResult) : 0;

    return {
      date: null,
      result,
    };
  }

  /**
   * Возвращает список orderId, по которым есть расходы на счёте debet за период.
   * NULL (общие расходы) не включается — он считается отдельно в отчёте.
   */
  async getOrderIdsWithExpenses(
    debet: Schet,
    startDate: number | null,
    endDate: number | null,
    enterpriseId?: number | null,
  ): Promise<number[]> {
    const where: any = { debet, orderId: { [Op.ne]: null } };

    if (
      startDate !== null &&
      startDate !== undefined &&
      endDate !== null &&
      endDate !== undefined
    ) {
      where.date = { [Op.gte]: startDate, [Op.lte]: endDate };
    }
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const rows = await this.oborotRepository.findAll({
      where,
      attributes: ["orderId"],
      group: ["orderId"],
      raw: true,
    });

    return rows
      .map((r: any) => Number(r.orderId))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  async getSubcontosBySchet(
    schet: Schet,
    startDate: number | null,
    endDate: number | null,
    enterpriseId?: number | null,
  ): Promise<{
    firstList: (number | null)[];
    secondList: (number | null)[];
    thirdList: (number | null)[];
  }> {
    const where: any = {
      [Op.or]: [{ debet: schet }, { kredit: schet }],
    };

    // Не фильтруем по датам здесь - фильтрация по датам должна происходить в query функциях
    // Список subcontos должен быть полным, чтобы включить все возможные значения
    // Фильтрация по датам происходит при запросе данных через TDSUM, TKSUM и т.д.

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const oborots = await this.oborotRepository.findAll({ where });

    const firstList = new Set<number | null>();
    const secondList = new Set<number | null>();
    const thirdList = new Set<number | null>();

    oborots.forEach((item) => {
      if (item.debet === schet) {
        if (
          item.debetFirstSubcontoId !== null &&
          item.debetFirstSubcontoId !== undefined
        ) {
          firstList.add(item.debetFirstSubcontoId);
        }
        if (
          item.debetSecondSubcontoId !== null &&
          item.debetSecondSubcontoId !== undefined
        ) {
          secondList.add(item.debetSecondSubcontoId);
        }
        if (
          item.debetThirdSubcontoId !== null &&
          item.debetThirdSubcontoId !== undefined
        ) {
          thirdList.add(item.debetThirdSubcontoId);
        }
      }
      if (item.kredit === schet) {
        if (
          item.kreditFirstSubcontoId !== null &&
          item.kreditFirstSubcontoId !== undefined
        ) {
          firstList.add(item.kreditFirstSubcontoId);
        }
        if (
          item.kreditSecondSubcontoId !== null &&
          item.kreditSecondSubcontoId !== undefined
        ) {
          secondList.add(item.kreditSecondSubcontoId);
        }
        if (
          item.kreditThirdSubcontoId !== null &&
          item.kreditThirdSubcontoId !== undefined
        ) {
          thirdList.add(item.kreditThirdSubcontoId);
        }
      }
    });

    const result = {
      firstList: [...firstList],
      secondList: [...secondList],
      thirdList: [...thirdList],
    };

    return result;
  }

  /**
   * ID ОС (второе субконто S01/S02), по которым есть обороты на складе за период.
   * Используется в отчёте «движение ОС», чтобы не пропускать позиции с проводками.
   */
  async getOsIdsWithMovementAtStorage(
    storageId: number,
    startDate: number | null,
    endDate: number | null,
    enterpriseId?: number | null,
  ): Promise<number[]> {
    if (!storageId) return [];

    const where: any = {
      [Op.or]: [
        {
          debet: Schet.S01,
          debetFirstSubcontoId: storageId,
          debetSecondSubcontoId: { [Op.ne]: null },
        },
        {
          debet: Schet.S02,
          debetFirstSubcontoId: storageId,
          debetSecondSubcontoId: { [Op.ne]: null },
        },
        {
          kredit: Schet.S01,
          kreditFirstSubcontoId: storageId,
          kreditSecondSubcontoId: { [Op.ne]: null },
        },
        {
          kredit: Schet.S02,
          kreditFirstSubcontoId: storageId,
          kreditSecondSubcontoId: { [Op.ne]: null },
        },
      ],
    };

    if (
      startDate !== null &&
      startDate !== undefined &&
      endDate !== null &&
      endDate !== undefined
    ) {
      where.date = { [Op.gte]: startDate, [Op.lte]: endDate };
    }

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const rows = await this.oborotRepository.findAll({
      where,
      attributes: [
        "debet",
        "debetFirstSubcontoId",
        "debetSecondSubcontoId",
        "kredit",
        "kreditFirstSubcontoId",
        "kreditSecondSubcontoId",
      ],
    });

    const ids = new Set<number>();
    for (const row of rows) {
      if (
        row.debet === Schet.S01 &&
        row.debetFirstSubcontoId === storageId &&
        row.debetSecondSubcontoId
      ) {
        ids.add(row.debetSecondSubcontoId);
      }
      if (
        row.debet === Schet.S02 &&
        row.debetFirstSubcontoId === storageId &&
        row.debetSecondSubcontoId
      ) {
        ids.add(row.debetSecondSubcontoId);
      }
      if (
        row.kredit === Schet.S01 &&
        row.kreditFirstSubcontoId === storageId &&
        row.kreditSecondSubcontoId
      ) {
        ids.add(row.kreditSecondSubcontoId);
      }
      if (
        row.kredit === Schet.S02 &&
        row.kreditFirstSubcontoId === storageId &&
        row.kreditSecondSubcontoId
      ) {
        ids.add(row.kreditSecondSubcontoId);
      }
    }

    return [...ids];
  }

  /** ID второго субконто по счёту с оборотами для первого субконто за период. */
  async getSecondSubcontoIdsWithMovementForSchet(
    schet: Schet,
    firstSubcontoId: number,
    startDate: number | null,
    endDate: number | null,
    enterpriseId?: number | null,
  ): Promise<number[]> {
    if (!firstSubcontoId) return [];

    const where: any = {
      [Op.or]: [
        {
          debet: schet,
          debetFirstSubcontoId: firstSubcontoId,
          debetSecondSubcontoId: { [Op.ne]: null },
        },
        {
          kredit: schet,
          kreditFirstSubcontoId: firstSubcontoId,
          kreditSecondSubcontoId: { [Op.ne]: null },
        },
      ],
    };

    if (
      startDate !== null &&
      startDate !== undefined &&
      endDate !== null &&
      endDate !== undefined
    ) {
      where.date = { [Op.gte]: startDate, [Op.lte]: endDate };
    }

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const rows = await this.oborotRepository.findAll({
      where,
      attributes: [
        "debet",
        "debetFirstSubcontoId",
        "debetSecondSubcontoId",
        "kredit",
        "kreditFirstSubcontoId",
        "kreditSecondSubcontoId",
      ],
    });

    const ids = new Set<number>();
    for (const row of rows) {
      if (
        row.debet === schet &&
        row.debetFirstSubcontoId === firstSubcontoId &&
        row.debetSecondSubcontoId
      ) {
        ids.add(row.debetSecondSubcontoId);
      }
      if (
        row.kredit === schet &&
        row.kreditFirstSubcontoId === firstSubcontoId &&
        row.kreditSecondSubcontoId
      ) {
        ids.add(row.kreditSecondSubcontoId);
      }
    }

    return [...ids];
  }
}
