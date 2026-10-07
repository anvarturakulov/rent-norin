import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, Transaction } from "sequelize";
import { Document } from "src/documents/document.model";
import { Schet } from "src/interfaces/report.interface";
import { StocksService } from "src/stocks/stocks.service";
import {
  ClientToolBatchConsumption,
  ClientToolBatchConsumptionTableType,
} from "./clientToolBatchConsumption.model";
import { ClientToolOpenBatch } from "./clientToolOpenBatch.model";
import { ReceiveToolsPreviewRow } from "./receiveToolsPreview.types";
import { planFifoConsumptions } from "./clientToolBatches.fifo";

const round2 = (n: number) => Math.round(n * 100) / 100;

// brak/sale are sub-allocations of the same return qty; only return closes open batches
const CONSUMPTION_TYPES: ClientToolBatchConsumptionTableType[] = ["return"];

@Injectable()
export class ClientToolBatchesService {
  constructor(
    @InjectModel(ClientToolOpenBatch)
    private readonly batchModel: typeof ClientToolOpenBatch,
    @InjectModel(ClientToolBatchConsumption)
    private readonly consumptionModel: typeof ClientToolBatchConsumption,
    private readonly stocksService: StocksService,
  ) {}

  async openBatchesOnTransferPosted(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    const clientId = doc.docValues?.receiverId;
    const enterpriseId = doc.enterpriseId;
    if (!clientId || !enterpriseId) {
      throw new Error(
        "TransferToolsToClient: clientId и enterpriseId обязательны для открытых партий",
      );
    }

    const settlementDate =
      Number(doc.docValues?.settlementDate) > 0
        ? Number(doc.docValues?.settlementDate)
        : Number(doc.date);

    const existing = await this.batchModel.count({
      where: { transferDocId: Number(doc.id) },
      transaction,
    });
    if (existing > 0) {
      return;
    }

    for (const row of doc.docTableItems || []) {
      if (!row?.analiticId || Number(row.count) <= 0) continue;
      // Строки продажи товаров (S29) не открывают арендные партии
      if (row.tableType === "sale" || row.tableType === "tovar") continue;

      await this.batchModel.create(
        {
          enterpriseId,
          clientId,
          transferDocId: Number(doc.id),
          transferTableItemId: row.id ? Number(row.id) : null,
          toolId: row.analiticId,
          initialQty: Number(row.count),
          openQty: Number(row.count),
          settlementDate,
          hourlyTariff: Number(row.hourlyTariff) || 0,
          costPrice: Number(row.costPrice) || 0,
        },
        { transaction },
      );
    }
  }

  async consumeBatchesOnReceivePosted(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    const clientId = doc.docValues?.senderId;
    const enterpriseId = doc.enterpriseId;
    if (!clientId || !enterpriseId) {
      throw new Error(
        "ReceiveToolsFromClient: clientId и enterpriseId обязательны для списания партий",
      );
    }

    const existing = await this.consumptionModel.count({
      where: { receiveDocId: Number(doc.id) },
      transaction,
    });
    if (existing > 0) {
      return;
    }

    const batches = await this.batchModel.findAll({
      where: {
        enterpriseId,
        clientId,
        openQty: { [Op.gt]: 0 },
      },
      order: [
        ["settlementDate", "ASC"],
        ["id", "ASC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    for (const row of doc.docTableItems || []) {
      const tableType = (row.tableType || "return") as ClientToolBatchConsumptionTableType;
      if (!CONSUMPTION_TYPES.includes(tableType)) continue;
      if (Number(row.count) <= 0) continue;

      const pinnedId = row.sourceTransferDocId
        ? Number(row.sourceTransferDocId)
        : null;

      const working = batches.map((batch) => ({
        transferDocId: Number(batch.transferDocId),
        toolId: batch.toolId,
        openQty: batch.openQty,
      }));

      const plans = planFifoConsumptions(
        working,
        row.analiticId,
        Number(row.count),
        pinnedId,
      );

      for (const plan of plans) {
        const batch = batches[plan.batchIndex];
        batch.openQty = round2(working[plan.batchIndex].openQty);
        await batch.save({ transaction });

        await this.consumptionModel.create(
          {
            receiveDocId: Number(doc.id),
            receiveTableItemId: row.id ? Number(row.id) : null,
            batchId: batch.id,
            qty: plan.qty,
            tableType,
          },
          { transaction },
        );
      }
    }
  }

  async reverseTransferPosting(
    transferDocId: number,
    transaction: Transaction,
  ): Promise<void> {
    const batches = await this.batchModel.findAll({
      where: { transferDocId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!batches.length) {
      return;
    }

    for (const batch of batches) {
      if (round2(batch.openQty) !== round2(batch.initialQty)) {
        throw new Error(
          "Нельзя отменить выдачу: инструмент уже возвращён или списан",
        );
      }
    }

    const batchIds = batches.map((b) => b.id);
    const consumptionCount = await this.consumptionModel.count({
      where: { batchId: { [Op.in]: batchIds } },
      transaction,
    });
    if (consumptionCount > 0) {
      throw new Error(
        "Нельзя отменить выдачу: инструмент уже возвращён или списан",
      );
    }

    await this.batchModel.destroy({
      where: { transferDocId },
      transaction,
    });
  }

  async reverseReceivePosting(
    receiveDocId: number,
    transaction: Transaction,
  ): Promise<void> {
    const consumptions = await this.consumptionModel.findAll({
      where: { receiveDocId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!consumptions.length) {
      return;
    }

    for (const consumption of consumptions) {
      const batch = await this.batchModel.findByPk(consumption.batchId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!batch) {
        throw new Error(
          `Партия ${consumption.batchId} не найдена при отмене возврата`,
        );
      }
      batch.openQty = round2(batch.openQty + consumption.qty);
      await batch.save({ transaction });
    }

    await this.consumptionModel.destroy({
      where: { receiveDocId },
      transaction,
    });
  }

  async findOpenBatchesForClient(
    clientId: number,
    enterpriseId: number,
  ): Promise<ClientToolOpenBatch[]> {
    return this.findOpenBatches(enterpriseId, clientId);
  }

  async findOpenBatches(
    enterpriseId: number,
    clientId?: number | null,
  ): Promise<ClientToolOpenBatch[]> {
    const where: Record<string, unknown> = {
      enterpriseId,
      openQty: { [Op.gt]: 0 },
    };
    if (clientId != null && Number(clientId) > 0) {
      where.clientId = Number(clientId);
    }
    return this.batchModel.findAll({
      where,
      order: [
        ["clientId", "ASC"],
        ["settlementDate", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async buildPreviewRows(
    batches: ClientToolOpenBatch[],
    returnDateTime: number,
    warehouseId: number | null | undefined,
    enterpriseId: number,
  ): Promise<ReceiveToolsPreviewRow[]> {
    const rows: ReceiveToolsPreviewRow[] = [];
    const costPriceCache = new Map<number, number>();

    for (const batch of batches) {
      const openQty = Number(batch.openQty);
      if (openQty <= 0) continue;

      const hours = Math.max(
        24,
        (returnDateTime - Number(batch.settlementDate)) / 3_600_000,
      );
      const rentSum = round2(hours * batch.hourlyTariff * openQty);

      let costPrice = batch.costPrice;
      if (costPriceCache.has(batch.toolId)) {
        costPrice = costPriceCache.get(batch.toolId)!;
      } else if (warehouseId != null && Number(warehouseId) > 0) {
        try {
          const s11 = await this.stocksService.getStockByDate(
            Schet.S11,
            warehouseId,
            batch.toolId,
            returnDateTime,
            undefined,
            enterpriseId,
          );
          if (s11.remainCount > 0) {
            costPrice = round2(s11.remainTotal / s11.remainCount);
          }
        } catch {
          /* keep batch cost */
        }
        costPriceCache.set(batch.toolId, costPrice);
      }

      const costTotal = round2(costPrice * openQty);

      rows.push({
        analiticId: batch.toolId,
        count: openQty,
        price: costPrice,
        total: costTotal,
        costPrice,
        costTotal,
        balance: openQty,
        hourlyTariff: batch.hourlyTariff,
        rentSum,
        sourceTransferDocId: Number(batch.transferDocId),
        settlementDate: Number(batch.settlementDate),
        transferDocNumber: String(batch.transferDocId),
        tableType: "return",
      });
    }

    return rows;
  }
}
