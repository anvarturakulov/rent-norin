import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, Transaction } from "sequelize";
import { Document } from "src/documents/document.model";
import { DocumentType } from "src/interfaces/document.interface";
import { ReferencesService } from "src/references/references.service";
import { SubleaseToolBatchConsumption } from "./subleaseToolBatchConsumption.model";
import { SubleaseToolOpenBatch } from "./subleaseToolOpenBatch.model";
import { SubleaseReceivePreviewRow } from "./subleaseReceivePreview.types";
import { planSubleaseFifoConsumptions } from "./subleaseToolBatches.fifo";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Поля партии, нужные для preview возврата (без Sequelize-модели). */
export type SubleaseBatchPreviewSource = {
  id: number;
  toolId: number;
  openQty: number;
  settlementDate: number;
  hourlyTariff: number;
  partnerHourlyTariff: number;
  transferDocId: number;
  partnerId: number;
  partnerStorageId: number;
};

@Injectable()
export class SubleaseToolBatchesService {
  constructor(
    @InjectModel(SubleaseToolOpenBatch)
    private readonly batchModel: typeof SubleaseToolOpenBatch,
    @InjectModel(SubleaseToolBatchConsumption)
    private readonly consumptionModel: typeof SubleaseToolBatchConsumption,
    @Inject(forwardRef(() => ReferencesService))
    private readonly referencesService: ReferencesService,
  ) {}

  /**
   * partnerId из склада PARTNER_TOOLS:
   * выдача — senderId, возврат — receiverId.
   * Пишет результат в doc.docValues.partnerId.
   */
  async ensurePartnerIdFromStorage(
    doc: Document,
    transaction?: Transaction,
  ): Promise<number> {
    const existing = Number(doc.docValues?.partnerId) || 0;
    if (existing > 0) {
      return existing;
    }

    const storageId =
      doc.documentType === DocumentType.TransferSubleaseToolsToClient
        ? Number(doc.docValues?.senderId) || 0
        : doc.documentType === DocumentType.ReceiveSubleaseToolsFromClient
          ? Number(doc.docValues?.receiverId) || 0
          : 0;

    if (!storageId) {
      throw new Error(
        "Субаренда: ҳамкор омбори танланмаган (partner storage)",
      );
    }

    const storage = await this.referencesService.getReferenceById(storageId);
    const partnerId = Number(storage?.refValues?.partnerId) || 0;
    if (!partnerId) {
      throw new Error(
        "Субаренда: омборда ҳамкор кўрсатилмаган (refValues.partnerId)",
      );
    }

    if (doc.docValues) {
      doc.docValues.partnerId = partnerId;
      if (typeof doc.docValues.update === "function") {
        await doc.docValues.update({ partnerId }, { transaction });
      }
    }

    return partnerId;
  }

  async openBatchesOnTransferPosted(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    const clientId = doc.docValues?.receiverId;
    const partnerStorageId = doc.docValues?.senderId;
    const partnerId = await this.ensurePartnerIdFromStorage(doc, transaction);
    const enterpriseId = doc.enterpriseId;
    if (!clientId || !partnerStorageId || !partnerId || !enterpriseId) {
      throw new Error(
        "TransferSubleaseToolsToClient: partnerId, clientId, partnerStorageId и enterpriseId обязательны",
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

      await this.batchModel.create(
        {
          enterpriseId,
          partnerId: Number(partnerId),
          partnerStorageId: Number(partnerStorageId),
          clientId: Number(clientId),
          transferDocId: Number(doc.id),
          transferTableItemId: row.id ? Number(row.id) : null,
          toolId: row.analiticId,
          initialQty: Number(row.count),
          openQty: Number(row.count),
          settlementDate,
          hourlyTariff: Number(row.hourlyTariff) || 0,
          partnerHourlyTariff: Number(row.partnerHourlyTariff) || 0,
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
    const partnerId = await this.ensurePartnerIdFromStorage(doc, transaction);
    const enterpriseId = doc.enterpriseId;
    if (!clientId || !enterpriseId) {
      throw new Error(
        "ReceiveSubleaseToolsFromClient: clientId и enterpriseId обязательны",
      );
    }

    const existing = await this.consumptionModel.count({
      where: { receiveDocId: Number(doc.id) },
      transaction,
    });
    if (existing > 0) {
      return;
    }

    const where: Record<string, unknown> = {
      enterpriseId,
      clientId,
      openQty: { [Op.gt]: 0 },
    };
    if (partnerId != null && Number(partnerId) > 0) {
      where.partnerId = Number(partnerId);
    }

    const batches = await this.batchModel.findAll({
      where,
      order: [
        ["settlementDate", "ASC"],
        ["id", "ASC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    for (const row of doc.docTableItems || []) {
      if ((row.tableType || "return") !== "return") continue;
      if (Number(row.count) <= 0) continue;

      const pinnedId = row.sourceTransferDocId
        ? Number(row.sourceTransferDocId)
        : null;

      const working = batches.map((batch) => ({
        transferDocId: Number(batch.transferDocId),
        toolId: batch.toolId,
        openQty: batch.openQty,
        partnerId: batch.partnerId,
      }));

      const plans = planSubleaseFifoConsumptions(
        working,
        row.analiticId,
        Number(row.count),
        pinnedId,
        partnerId ? Number(partnerId) : null,
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
            tableType: "return",
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
          "Нельзя отменить выдачу субаренды: инструмент уже возвращён",
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
        "Нельзя отменить выдачу субаренды: инструмент уже возвращён",
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
          `Партия субаренды ${consumption.batchId} не найдена при отмене возврата`,
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

  async findOpenBatches(
    enterpriseId: number,
    clientId?: number | null,
    partnerId?: number | null,
  ): Promise<SubleaseToolOpenBatch[]> {
    const where: Record<string, unknown> = {
      enterpriseId,
      openQty: { [Op.gt]: 0 },
    };
    if (clientId != null && Number(clientId) > 0) {
      where.clientId = Number(clientId);
    }
    if (partnerId != null && Number(partnerId) > 0) {
      where.partnerId = Number(partnerId);
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

  private toPreviewBatchSource(
    batch: SubleaseToolOpenBatch,
    openQtyOverride?: number,
  ): SubleaseBatchPreviewSource {
    return {
      id: Number(batch.id),
      toolId: Number(batch.toolId),
      openQty:
        openQtyOverride != null ? openQtyOverride : Number(batch.openQty),
      settlementDate: Number(batch.settlementDate),
      hourlyTariff: Number(batch.hourlyTariff) || 0,
      partnerHourlyTariff: Number(batch.partnerHourlyTariff) || 0,
      transferDocId: Number(batch.transferDocId),
      partnerId: Number(batch.partnerId),
      partnerStorageId: Number(batch.partnerStorageId),
    };
  }

  /**
   * Открытые партии для preview возврата.
   * Если excludeDocId задан (редактирование уже проведённого возврата) —
   * к openQty временно добавляются qty из consumptions этого документа.
   */
  async findOpenBatchesForPreview(
    enterpriseId: number,
    clientId?: number | null,
    partnerId?: number | null,
    excludeDocId?: number | null,
  ): Promise<SubleaseBatchPreviewSource[]> {
    const batches = await this.findOpenBatches(
      enterpriseId,
      clientId,
      partnerId,
    );

    if (!excludeDocId || Number(excludeDocId) <= 0) {
      return batches.map((b) => this.toPreviewBatchSource(b));
    }

    const consumptions = await this.consumptionModel.findAll({
      where: { receiveDocId: Number(excludeDocId) },
    });
    if (!consumptions.length) {
      return batches.map((b) => this.toPreviewBatchSource(b));
    }

    const byId = new Map<number, SubleaseBatchPreviewSource>();
    for (const batch of batches) {
      byId.set(Number(batch.id), this.toPreviewBatchSource(batch));
    }

    for (const consumption of consumptions) {
      const batchId = Number(consumption.batchId);
      const qty = Number(consumption.qty) || 0;
      if (qty <= 0) continue;

      const existing = byId.get(batchId);
      if (existing) {
        existing.openQty = round2(existing.openQty + qty);
        continue;
      }

      const batch = await this.batchModel.findByPk(batchId);
      if (!batch) continue;
      if (
        clientId != null &&
        Number(clientId) > 0 &&
        Number(batch.clientId) !== Number(clientId)
      ) {
        continue;
      }
      if (
        partnerId != null &&
        Number(partnerId) > 0 &&
        Number(batch.partnerId) !== Number(partnerId)
      ) {
        continue;
      }
      if (Number(batch.enterpriseId) !== Number(enterpriseId)) {
        continue;
      }

      byId.set(
        batchId,
        this.toPreviewBatchSource(
          batch,
          round2(Number(batch.openQty) + qty),
        ),
      );
    }

    return Array.from(byId.values())
      .filter((b) => b.openQty > 0)
      .sort((a, b) => {
        if (a.settlementDate !== b.settlementDate) {
          return a.settlementDate - b.settlementDate;
        }
        return a.id - b.id;
      });
  }

  async buildPreviewRows(
    batches: SubleaseBatchPreviewSource[],
    returnDateTime: number,
  ): Promise<SubleaseReceivePreviewRow[]> {
    const rows: SubleaseReceivePreviewRow[] = [];

    for (const batch of batches) {
      const openQty = Number(batch.openQty);
      if (openQty <= 0) continue;

      const hours = Math.max(
        24,
        (returnDateTime - Number(batch.settlementDate)) / 3_600_000,
      );
      const rentSum = round2(hours * batch.hourlyTariff * openQty);
      const partnerRentSum = round2(
        hours * batch.partnerHourlyTariff * openQty,
      );

      rows.push({
        analiticId: batch.toolId,
        count: openQty,
        price: 0,
        total: rentSum,
        balance: openQty,
        hourlyTariff: batch.hourlyTariff,
        partnerHourlyTariff: batch.partnerHourlyTariff,
        rentSum,
        partnerRentSum,
        sourceTransferDocId: Number(batch.transferDocId),
        settlementDate: Number(batch.settlementDate),
        transferDocNumber: String(batch.transferDocId),
        partnerId: batch.partnerId,
        partnerStorageId: batch.partnerStorageId,
        tableType: "return",
      });
    }

    return rows;
  }
}
