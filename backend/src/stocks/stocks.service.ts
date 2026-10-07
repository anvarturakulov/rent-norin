import { Injectable } from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/sequelize";
import { Sequelize, Transaction, Op } from "sequelize";
import { Stock } from "./stock.model";
import { EntryCreationAttrs } from "src/entries/entry.model";
import { DEBETKREDIT, Schet } from "src/interfaces/report.interface";

export interface StockRemainResult {
  date: number | null;
  count: number;
  total: number;
  usd: number;
  remainCount: number;
  remainTotal: number;
  remainUsd: number;
}

@Injectable()
export class StocksService {
  private schetsWithOneSubconto = [
    Schet.S40,
    Schet.S50,
    Schet.S60,
    Schet.S66,
    Schet.S67,
    Schet.S71,
    Schet.S65,
    Schet.S64,
    Schet.S68,
    Schet.S41,
  ];

  constructor(
    @InjectModel(Stock) private stockRepository: typeof Stock,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  private pendingRemainsByTx = new WeakMap<
    Transaction,
    Map<
      string,
      {
        schet: string;
        firstSubcontoId: number | null;
        secondSubcontoId: number | null;
        enterpriseId: number;
        fromDate: bigint;
      }
    >
  >();

  private remainMapKey(
    schet: string,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    enterpriseId: number,
  ) {
    const secondNorm = this.schetsWithOneSubconto.includes(schet as Schet)
      ? null
      : secondSubcontoId;
    return `${enterpriseId}|${schet}|${firstSubcontoId}|${secondNorm}`;
  }

  private trackRemainRecalc(
    transaction: Transaction,
    schet: string,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    date: bigint,
    enterpriseId: number,
  ) {
    let map = this.pendingRemainsByTx.get(transaction);
    if (!map) {
      map = new Map();
      this.pendingRemainsByTx.set(transaction, map);
    }
    const secondNorm = this.schetsWithOneSubconto.includes(schet as Schet)
      ? null
      : secondSubcontoId;
    const key = this.remainMapKey(
      schet,
      firstSubcontoId,
      secondNorm,
      enterpriseId,
    );
    const existing = map.get(key);
    const fromDate = BigInt(date);
    if (!existing || fromDate < existing.fromDate) {
      map.set(key, {
        schet,
        firstSubcontoId,
        secondSubcontoId: secondNorm,
        enterpriseId,
        fromDate,
      });
    }
  }

  async flushPendingRemains(transaction: Transaction): Promise<void> {
    const map = this.pendingRemainsByTx.get(transaction);
    if (!map || map.size === 0) {
      this.pendingRemainsByTx.delete(transaction);
      return;
    }
    this.pendingRemainsByTx.delete(transaction);
    for (const item of map.values()) {
      await this.recalculateRemains(
        item.schet,
        item.firstSubcontoId,
        item.secondSubcontoId,
        item.fromDate,
        item.enterpriseId,
        transaction,
      );
    }
  }

  private checkEntryForDublicate(entry: EntryCreationAttrs) {
    return (
      entry.debet === entry.kredit &&
      entry.debetFirstSubcontoId === entry.kreditFirstSubcontoId
    );
  }

  private getWhereClause(
    schet: Schet,
    date: bigint,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    enterpriseId: number,
  ) {
    const where: any = { schet, date, firstSubcontoId, enterpriseId };
    if (!this.schetsWithOneSubconto.includes(schet)) {
      where.secondSubcontoId = secondSubcontoId;
    } else {
      where.secondSubcontoId = null;
    }
    return where;
  }

  async addEntry(
    schet: Schet,
    date: bigint,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    count: number,
    total: number,
    usd: number,
    debetKredit: DEBETKREDIT,
    comment: string,
    enterpriseId: number,
    transaction: Transaction,
  ): Promise<Stock> {
    try {
      const where = this.getWhereClause(
        schet,
        date,
        firstSubcontoId,
        secondSubcontoId,
        enterpriseId,
      );
      const [stock, created] = await this.stockRepository.findOrCreate({
        where,
        defaults: {
          schet,
          date,
          firstSubcontoId,
          secondSubcontoId: this.schetsWithOneSubconto.includes(schet)
            ? null
            : secondSubcontoId,
          count: debetKredit === DEBETKREDIT.DEBET ? count : -count,
          total: debetKredit === DEBETKREDIT.DEBET ? total : -total,
          usd: debetKredit === DEBETKREDIT.DEBET ? usd : -usd,
          remainCount: 0,
          remainTotal: 0,
          remainUsd: 0,
          comment: comment.length > 255 ? comment.substring(0, 255) : comment,
          enterpriseId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!stock) {
        throw new Error(
          `Failed to find or create stock for schet=${schet}, date=${date}, firstSubcontoId=${firstSubcontoId}, secondSubcontoId=${secondSubcontoId}`,
        );
      }

      if (!created) {
        const oldCount = stock.count;
        const oldRemainCount = stock.remainCount;
        stock.count += debetKredit === DEBETKREDIT.DEBET ? count : -count;
        stock.total += debetKredit === DEBETKREDIT.DEBET ? total : -total;
        stock.usd += debetKredit === DEBETKREDIT.DEBET ? usd : -usd;

        // Обрезаем комментарий до 255 символов для предотвращения ошибок
        const newComment = stock.comment
          ? `${stock.comment.trim()}, ${comment}`
          : comment;
        stock.comment =
          newComment.length > 255 ? newComment.substring(0, 255) : newComment;

        const updatedStock = await stock.save({ transaction });
        if (!updatedStock) {
          throw new Error(
            `Failed to update stock for schet=${schet}, date=${date}, firstSubcontoId=${firstSubcontoId}, secondSubcontoId=${secondSubcontoId}`,
          );
        }
      }

      this.trackRemainRecalc(
        transaction,
        schet,
        firstSubcontoId,
        secondSubcontoId,
        date,
        enterpriseId,
      );

      return stock;
    } catch (error) {
      throw new Error(
        `Failed to add entry for schet=${schet}, date=${date}, firstSubcontoId=${firstSubcontoId}, secondSubcontoId=${secondSubcontoId}: ${error.message}`,
      );
    }
  }

  async addTwoEntries(
    entry: EntryCreationAttrs,
    transaction: Transaction,
  ): Promise<Stock[]> {
    if (this.checkEntryForDublicate(entry)) {
      return []; // Возвращаем пустой массив, если запись является дубликатом
    }

    if (!entry.enterpriseId) {
      throw new Error(
        "Entry enterpriseId is required for creating stock entries",
      );
    }

    const debetStock = await this.addEntry(
      entry.debet,
      entry.date,
      entry.debetFirstSubcontoId,
      entry.debetSecondSubcontoId,
      entry.count,
      entry.total,
      entry.usd,
      DEBETKREDIT.DEBET,
      String(entry.docId),
      entry.enterpriseId,
      transaction,
    );

    const kreditStock = await this.addEntry(
      entry.kredit,
      entry.date,
      entry.kreditFirstSubcontoId,
      entry.kreditSecondSubcontoId,
      entry.count,
      entry.total,
      entry.usd,
      DEBETKREDIT.KREDIT,
      String(entry.docId),
      entry.enterpriseId,
      transaction,
    );

    return [debetStock, kreditStock];
  }

  async addEntrieToTMZ(
    entry: EntryCreationAttrs,
    transaction: Transaction,
  ): Promise<Stock | null> {
    if (this.checkEntryForDublicate(entry)) {
      return null; // Возвращаем null, чтобы указать, что объект не создавался из-за дубликата
    }

    if (!entry.enterpriseId) {
      throw new Error(
        "Entry enterpriseId is required for creating TMZ stock entries",
      );
    }

    const tmzSchets = [Schet.S01, Schet.S10, Schet.S11, Schet.S21, Schet.S28, Schet.S29];
    const tmzInDebet =
      tmzSchets.includes(entry.debet) && !tmzSchets.includes(entry.kredit);
    const tmzInKredit =
      !tmzSchets.includes(entry.debet) && tmzSchets.includes(entry.kredit);

    if (tmzInDebet) {
      return await this.addEntry(
        entry.debet,
        entry.date,
        entry.debetSecondSubcontoId,
        null,
        entry.count,
        entry.total,
        entry.usd,
        DEBETKREDIT.DEBET,
        String(entry.docId),
        entry.enterpriseId,
        transaction,
      );
    }

    if (tmzInKredit) {
      return await this.addEntry(
        entry.kredit,
        entry.date,
        entry.kreditSecondSubcontoId,
        null,
        entry.count,
        entry.total,
        entry.usd,
        DEBETKREDIT.KREDIT,
        String(entry.docId),
        entry.enterpriseId,
        transaction,
      );
    }

    return null; // Возвращаем null, если не было условий для создания записи
  }

  async deleteEntry(
    schet: Schet,
    date: bigint,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    count: number,
    total: number,
    usd: number,
    debetKredit: DEBETKREDIT,
    enterpriseId: number,
    transaction: Transaction,
  ) {
    const where = this.getWhereClause(
      schet,
      date,
      firstSubcontoId,
      secondSubcontoId,
      enterpriseId,
    );

    const stock = await this.stockRepository.findOne({
      where,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stock) {
      throw new Error(
        `Stock not found for( schet = ${schet}, date = ${date} , firstSubcontoId = ${firstSubcontoId}, secondSubcontoId = ${secondSubcontoId}, debetKredit = ${debetKredit})`,
      );
    }

    stock.count -= debetKredit === DEBETKREDIT.DEBET ? count : -count;
    stock.total -= debetKredit === DEBETKREDIT.DEBET ? total : -total;
    stock.usd -= debetKredit === DEBETKREDIT.DEBET ? usd : -usd;

    // await stock.save({ transaction });
    let updatedStock;
    try {
      updatedStock = await stock.save({ transaction });
      if (!updatedStock) {
        throw new Error(
          `Failed to update stock for schet=${schet}, date=${date}, firstSubcontoId=${firstSubcontoId}, secondSubcontoId=${secondSubcontoId}`,
        );
      }
    } catch (error) {
      throw new Error(`Failed to save stock: ${error.message}`);
    }

    this.trackRemainRecalc(
      transaction,
      schet,
      firstSubcontoId,
      secondSubcontoId,
      date,
      enterpriseId,
    );
  }

  async deleteTwoEntries(entry: EntryCreationAttrs, transaction: Transaction) {
    if (this.checkEntryForDublicate(entry)) return;

    if (!entry.enterpriseId) {
      throw new Error(
        "Entry enterpriseId is required for deleting stock entries",
      );
    }

    await this.deleteEntry(
      entry.debet,
      entry.date,
      entry.debetFirstSubcontoId,
      entry.debetSecondSubcontoId,
      entry.count,
      entry.total,
      entry.usd,
      DEBETKREDIT.DEBET,
      entry.enterpriseId,
      transaction,
    );
    await this.deleteEntry(
      entry.kredit,
      entry.date,
      entry.kreditFirstSubcontoId,
      entry.kreditSecondSubcontoId,
      entry.count,
      entry.total,
      entry.usd,
      DEBETKREDIT.KREDIT,
      entry.enterpriseId,
      transaction,
    );
  }

  async deleteEntrieToTMZ(entry: EntryCreationAttrs, transaction: Transaction) {
    if (this.checkEntryForDublicate(entry)) return;

    if (!entry.enterpriseId) {
      throw new Error(
        "Entry enterpriseId is required for deleting TMZ stock entries",
      );
    }

    const tmzSchets = [Schet.S01, Schet.S10, Schet.S11, Schet.S21, Schet.S28, Schet.S29];
    const tmzInDebet =
      tmzSchets.includes(entry.debet) && !tmzSchets.includes(entry.kredit);
    const tmzInKredit =
      !tmzSchets.includes(entry.debet) && tmzSchets.includes(entry.kredit);

    if (tmzInDebet) {
      await this.deleteEntry(
        entry.debet,
        entry.date,
        entry.debetSecondSubcontoId,
        null,
        entry.count,
        entry.total,
        entry.usd,
        DEBETKREDIT.DEBET,
        entry.enterpriseId,
        transaction,
      );
    }

    if (tmzInKredit) {
      await this.deleteEntry(
        entry.kredit,
        entry.date,
        entry.kreditSecondSubcontoId,
        null,
        entry.count,
        entry.total,
        entry.usd,
        DEBETKREDIT.KREDIT,
        entry.enterpriseId,
        transaction,
      );
    }
  }

  async recalculateRemains(
    schet: string,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    fromDate: bigint,
    enterpriseId: number,
    transaction: Transaction,
  ) {
    const where = {
      schet,
      firstSubcontoId,
      secondSubcontoId: this.schetsWithOneSubconto.includes(schet as Schet)
        ? null
        : secondSubcontoId,
      date: { [Op.gte]: fromDate },
      enterpriseId,
    };
    const stocks = await this.stockRepository.findAll({
      where,
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
      transaction,
    });

    let runningCount = 0;
    let runningTotal = 0;
    let runningUsd = 0;

    const previous = await this.stockRepository.findOne({
      where: {
        schet,
        firstSubcontoId,
        secondSubcontoId: this.schetsWithOneSubconto.includes(schet as Schet)
          ? null
          : secondSubcontoId,
        date: { [Op.lt]: fromDate },
        enterpriseId,
      },
      order: [
        ["date", "DESC"],
        ["id", "DESC"],
      ],
      transaction,
    });

    if (previous) {
      runningCount = previous.remainCount;
      runningTotal = previous.remainTotal;
      runningUsd = previous.remainUsd;
    }

    for (const stock of stocks) {
      try {
        runningCount += stock.count;
        runningTotal += stock.total;
        runningUsd += stock.usd;
        stock.remainCount = runningCount;
        stock.remainTotal = runningTotal;
        stock.remainUsd = runningUsd;
        await stock.save({ transaction });
      } catch (error) {
        throw new Error(
          `Failed to save stock in recalculateRemains: ${error.message}`,
        );
      }
    }
  }

  private async getCurrentStock(
    schet: Schet,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    transaction?: Transaction,
  ) {
    let where: any = {
      schet,
      secondSubcontoId: this.schetsWithOneSubconto.includes(schet)
        ? null
        : secondSubcontoId,
    };

    if (firstSubcontoId !== null) {
      where = { ...where, firstSubcontoId };
    }

    const stock = await this.stockRepository.findOne({
      where,
      order: [
        ["date", "DESC"],
        ["id", "DESC"],
      ],
      transaction,
    });

    return stock
      ? {
          date: stock.date,
          count: stock.count,
          total: stock.total,
          usd: stock.usd,
          remainCount: stock.remainCount,
          remainTotal: stock.remainTotal,
          remainUsd: stock.remainUsd,
        }
      : {
          date: null,
          count: 0,
          total: 0,
          usd: 0,
          remainCount: 0,
          remainTotal: 0,
          remainUsd: 0,
        };
  }

  /** ID ОС (secondSubconto) с остатками на S01/S02 по складу. */
  async getOsIdsWithStockAtStorage(
    storageId: number,
    enterpriseId?: number | null,
  ): Promise<number[]> {
    if (!storageId) return [];

    const where: any = {
      schet: { [Op.in]: [Schet.S01, Schet.S02] },
      firstSubcontoId: storageId,
      secondSubcontoId: { [Op.ne]: null },
    };
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const rows = await this.stockRepository.findAll({
      where,
      attributes: ["secondSubcontoId"],
      group: ["secondSubcontoId"],
    });

    return rows
      .map((r) => r.secondSubcontoId)
      .filter((id): id is number => id != null && id > 0);
  }

  /** ID второго субконто с остатками по счёту и первому субконто. */
  async getSecondSubcontoIdsWithStockForSchet(
    schet: Schet,
    firstSubcontoId: number,
    enterpriseId?: number | null,
  ): Promise<number[]> {
    if (!firstSubcontoId) return [];

    const where: any = {
      schet,
      firstSubcontoId,
      secondSubcontoId: { [Op.ne]: null },
    };
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    }

    const rows = await this.stockRepository.findAll({
      where,
      attributes: ["secondSubcontoId"],
      group: ["secondSubcontoId"],
    });

    return rows
      .map((r) => r.secondSubcontoId)
      .filter((id): id is number => id != null && id > 0);
  }

  async getStockByDate(
    schet: Schet,
    firstSubcontoId: number | null,
    secondSubcontoId: number | null,
    targetDate: number,
    transaction?: Transaction,
    enterpriseId?: number | null,
  ): Promise<StockRemainResult> {
    // console.log('getStockByDate', schet, firstSubcontoId, secondSubcontoId, targetDate);
    // Если targetDate - это начало дня (00:00:00), нужно включить все записи за этот день
    // Используем начало следующего дня для правильного запроса остатков
    // Это гарантирует, что мы получим остатки на конец дня документа, включая все обновления за день
    // const oneDay = 24 * 60 * 60 * 1000;
    // const nextDayStart = targetDate + oneDay; // Начало следующего дня

    let where: any = {
      schet,
      secondSubcontoId: this.schetsWithOneSubconto.includes(schet)
        ? null
        : secondSubcontoId,
      date: { [Op.lt]: targetDate }, // Используем lt с началом следующего дня, чтобы включить все записи за день документа
    };

    if (firstSubcontoId !== null) {
      where = { ...where, firstSubcontoId };
    }

    // Если enterpriseId указан — остаток по одной организации
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;

      const lastStocks = await this.stockRepository.findAll({
        where,
        order: [
          ["date", "DESC"],
          ["id", "DESC"],
        ],
        limit: 5,
        transaction,
      });

      const stock = lastStocks[0] || null;
      return this.mapStockRemain(stock);
    }

    // Без enterpriseId — сумма последних остатков по каждой организации (общий отчёт)
    const lastStocks = await this.stockRepository.findAll({
      where,
      order: [
        ["date", "DESC"],
        ["id", "DESC"],
      ],
      transaction,
    });

    const latestByEnterprise = new Map<string, (typeof lastStocks)[0]>();
    for (const row of lastStocks) {
      const key =
        row.enterpriseId === null || row.enterpriseId === undefined
          ? "null"
          : String(row.enterpriseId);
      if (!latestByEnterprise.has(key)) {
        latestByEnterprise.set(key, row);
      }
    }

    if (latestByEnterprise.size === 0) {
      return this.mapStockRemain(null);
    }

    let remainTotal = 0;
    let remainCount = 0;
    let remainUsd = 0;
    let latestDate: number | null = null;

    for (const stock of latestByEnterprise.values()) {
      remainTotal += stock.remainTotal || 0;
      remainCount += stock.remainCount || 0;
      remainUsd += stock.remainUsd || 0;
      const rowDate = stock.date != null ? Number(stock.date) : null;
      if (rowDate != null && (latestDate == null || rowDate > latestDate)) {
        latestDate = rowDate;
      }
    }

    return {
      date: latestDate,
      count: 0,
      total: 0,
      usd: 0,
      remainCount,
      remainTotal,
      remainUsd,
    };
  }

  private mapStockRemain(stock: Stock | null): StockRemainResult {
    return stock
      ? {
          date: stock.date != null ? Number(stock.date) : null,
          count: stock.count ?? 0,
          total: stock.total ?? 0,
          usd: stock.usd ?? 0,
          remainCount: stock.remainCount ?? 0,
          remainTotal: stock.remainTotal ?? 0,
          remainUsd: stock.remainUsd ?? 0,
        }
      : {
          date: null,
          count: 0,
          total: 0,
          usd: 0,
          remainCount: 0,
          remainTotal: 0,
          remainUsd: 0,
        };
  }
}
