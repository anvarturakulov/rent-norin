import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { Transaction, Op } from "sequelize";
import { OrderPipelineStage } from "./orderPipelineStage.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderStageHistory } from "src/orderStageHistory/orderStageHistory.model";
import {
  normalizeOrderStage,
  OrderHistoryEventType,
  OrderStageType,
  PipelineStatus,
  QueueStatus,
  TEMPORARILY_DISABLED_STAGES,
  WorkStatus,
} from "src/interfaces/furniture-order.interface";
import { Reference } from "src/references/reference.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { User } from "src/users/users.model";
import { TelegramOrderNotifierService } from "src/telegram/telegram-order-notifier.service";

export interface UnfinishedWorkSummary {
  id: number;
  workName: string;
  workStatus: WorkStatus;
  assignedDeptId?: number | null;
  assignedDeptName?: string | null;
}

export interface ClassifiedUnfinishedWorks {
  blocking: UnfinishedWorkSummary[];
  orphan: UnfinishedWorkSummary[];
}

export interface OrphanWorkAdvanceInfo {
  warnings: string[];
  orphanWorks: UnfinishedWorkSummary[];
}

export type ProductionQueueActionKind =
  | "ACTIVATE"
  | "COMPLETE"
  | "RESET_PENDING"
  | "RECALCULATE";

export interface ProductionQueueActionInput {
  action: ProductionQueueActionKind;
  deptId?: number;
  userId: number;
  comment?: string;
  force?: boolean;
}

export interface ProductionQueueActionResult {
  warnings: string[];
}

@Injectable()
export class OrderPipelineService {
  private static readonly UNFINISHED_WORK_STATUSES: WorkStatus[] = [
    WorkStatus.OPEN,
    WorkStatus.PENDING,
    WorkStatus.IN_PROGRESS,
    WorkStatus.PAUSE,
  ];

  constructor(
    @InjectModel(OrderPipelineStage)
    private readonly pipelineStageRepo: typeof OrderPipelineStage,
    @InjectModel(FurnitureOrder)
    private readonly orderRepo: typeof FurnitureOrder,
    @InjectModel(OrderProductionQueue)
    private readonly productionQueueRepo: typeof OrderProductionQueue,
    @InjectModel(OrderWork)
    private readonly orderWorkRepo: typeof OrderWork,
    @InjectModel(OrderStageHistory)
    private readonly stageHistoryRepo: typeof OrderStageHistory,
    private readonly sequelize: Sequelize,
    private readonly telegramOrderNotifierService: TelegramOrderNotifierService,
  ) {}

  private isTemporarilyDisabledStage(stageName: string): boolean {
    const normalized = normalizeOrderStage(stageName);
    return (
      normalized != null && TEMPORARILY_DISABLED_STAGES.includes(normalized)
    );
  }

  private async skipPendingDisabledStages(
    orderId: number,
    transaction: Transaction,
    now: number,
  ): Promise<OrderPipelineStage | null> {
    for (;;) {
      const nextStage = await this.pipelineStageRepo.findOne({
        where: { orderId, status: PipelineStatus.PENDING },
        order: [["sequence", "ASC"]],
        transaction,
      });
      if (!nextStage) return null;
      if (!this.isTemporarilyDisabledStage(nextStage.stageName)) {
        return nextStage;
      }
      await nextStage.update(
        { status: PipelineStatus.SKIPPED, completedAt: now },
        { transaction },
      );
    }
  }

  private async findPreviousNonDisabledStage(
    orderId: number,
    beforeSequence: number,
    transaction: Transaction,
  ): Promise<OrderPipelineStage | null> {
    let sequenceLt = beforeSequence;
    for (;;) {
      const previousStage = await this.pipelineStageRepo.findOne({
        where: {
          orderId,
          status: PipelineStatus.DONE,
          sequence: { [Op.lt]: sequenceLt },
        },
        order: [["sequence", "DESC"]],
        transaction,
      });
      if (!previousStage) return null;
      if (!this.isTemporarilyDisabledStage(previousStage.stageName)) {
        return previousStage;
      }
      sequenceLt = previousStage.sequence;
    }
  }

  /**
   * Если активный этап временно отключён — пропускает его и активирует следующий.
   */
  async skipDisabledActiveStageIfNeeded(orderId: number): Promise<void> {
    const transaction = await this.sequelize.transaction();
    try {
      const activeStageRecord = await this.pipelineStageRepo.findOne({
        where: { orderId, status: PipelineStatus.ACTIVE },
        transaction,
      });
      if (
        !activeStageRecord ||
        !this.isTemporarilyDisabledStage(activeStageRecord.stageName)
      ) {
        await transaction.commit();
        return;
      }

      const now = Date.now();
      await activeStageRecord.update(
        { status: PipelineStatus.SKIPPED, completedAt: now },
        { transaction },
      );

      const order = await this.orderRepo.findByPk(orderId, { transaction });
      if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

      const nextStage = await this.skipPendingDisabledStages(
        orderId,
        transaction,
        now,
      );

      if (nextStage) {
        const nextStageName =
          normalizeOrderStage(nextStage.stageName) ??
          OrderStageType.TEXNOLOG;
        await nextStage.update(
          { status: PipelineStatus.ACTIVE, startedAt: now },
          { transaction },
        );
        await order.update({ currentStage: nextStageName }, { transaction });
        if (nextStageName === OrderStageType.IN_PRODUCTION) {
          await this.startProductionQueue(
            orderId,
            undefined,
            transaction,
          );
        }
      } else {
        await order.update(
          { currentStage: OrderStageType.COMPLETED },
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async createPipeline(
    orderId: number,
    stages: OrderStageType[],
    productionDeptIds: number[] = [],
  ): Promise<OrderPipelineStage[]> {
    const stagesToCreate = stages.map((stageName, index) => ({
      orderId,
      stageName,
      sequence: index + 1,
      status: index === 0 ? PipelineStatus.ACTIVE : PipelineStatus.PENDING,
    }));

    const created = await this.pipelineStageRepo.bulkCreate(
      stagesToCreate as any,
    );

    // Если IN_PRODUCTION входит в pipeline — сразу создаём очередь цехов
    if (
      stages.includes(OrderStageType.IN_PRODUCTION) &&
      productionDeptIds.length > 0
    ) {
      await this.createProductionQueue(orderId, productionDeptIds);
    }

    // Устанавливаем currentStage у заявки
    await this.orderRepo.update(
      { currentStage: stages[0] },
      { where: { id: orderId } },
    );

    return created;
  }

  async createProductionQueue(
    orderId: number,
    deptIds: number[],
  ): Promise<OrderProductionQueue[]> {
    const queueItems = deptIds.map((deptId, index) => ({
      orderId,
      deptId,
      sequence: index + 1,
      status: QueueStatus.PENDING,
    }));
    return this.productionQueueRepo.bulkCreate(queueItems as any);
  }

  async replaceProductionQueue(
    orderId: number,
    items: Array<{ deptId: number; sequence: number }>,
  ): Promise<OrderProductionQueue[]> {
    const transaction = await this.sequelize.transaction();
    try {
      const itemsByDept = new Map<number, number>();
      for (const item of items) {
        const deptId = Number(item.deptId);
        const sequence = Number(item.sequence);
        if (!Number.isFinite(deptId) || !Number.isFinite(sequence) || sequence <= 0) {
          continue;
        }
        itemsByDept.set(deptId, sequence);
      }
      const uniqueItems = Array.from(itemsByDept.entries()).map(
        ([deptId, sequence]) => ({ deptId, sequence }),
      );
      const newDeptIds = new Set(uniqueItems.map((item) => item.deptId));

      const existing = await this.productionQueueRepo.findAll({
        where: { orderId },
        order: [
          ["sequence", "ASC"],
          ["id", "ASC"],
        ],
        transaction,
      });

      const removedActive = existing.some(
        (row) =>
          !newDeptIds.has(Number(row.deptId)) &&
          row.status === QueueStatus.ACTIVE,
      );

      const removedDeptIds = existing
        .filter((row) => !newDeptIds.has(Number(row.deptId)))
        .map((row) => Number(row.deptId));
      if (removedDeptIds.length > 0) {
        await this.productionQueueRepo.destroy({
          where: { orderId, deptId: { [Op.in]: removedDeptIds } },
          transaction,
        });
      }

      const survivingByDept = new Map<number, OrderProductionQueue>();
      for (const row of existing) {
        const deptId = Number(row.deptId);
        if (newDeptIds.has(deptId) && !survivingByDept.has(deptId)) {
          survivingByDept.set(deptId, row);
        }
      }

      if (uniqueItems.length === 0) {
        await this.orderWorkRepo.update(
          { productionQueueId: null as unknown as number },
          { where: { orderId }, transaction },
        );
        await transaction.commit();
        return [];
      }

      for (const item of uniqueItems) {
        const existingRow = survivingByDept.get(item.deptId);
        if (existingRow) {
          if (Number(existingRow.sequence) !== item.sequence) {
            await existingRow.update({ sequence: item.sequence }, { transaction });
          }
        } else {
          await this.productionQueueRepo.create(
            {
              orderId,
              deptId: item.deptId,
              sequence: item.sequence,
              status: QueueStatus.PENDING,
            } as any,
            { transaction },
          );
        }
      }

      await this.orderWorkRepo.update(
        { productionQueueId: null as unknown as number },
        { where: { orderId }, transaction },
      );

      const merged = await this.productionQueueRepo.findAll({
        where: { orderId },
        order: [
          ["sequence", "ASC"],
          ["id", "ASC"],
        ],
        transaction,
      });

      const queueIdByDept = new Map<number, number>();
      for (const row of merged) {
        const deptId = Number(row.deptId);
        if (!queueIdByDept.has(deptId)) {
          queueIdByDept.set(deptId, Number(row.id));
        }
      }

      const works = await this.orderWorkRepo.findAll({
        where: { orderId },
        transaction,
      });
      for (const work of works) {
        const deptId =
          work.assignedDeptId != null ? Number(work.assignedDeptId) : null;
        if (deptId == null || !queueIdByDept.has(deptId)) continue;
        await work.update(
          { productionQueueId: queueIdByDept.get(deptId) },
          { transaction },
        );
      }

      const hasActive = await this.productionQueueRepo.count({
        where: { orderId, status: QueueStatus.ACTIVE },
        transaction,
      });

      if (hasActive === 0) {
        if (!removedActive) {
          await this.syncActiveProductionQueue(orderId, transaction);
        }
      }

      await transaction.commit();

      try {
        await this.checkAndAdvanceProductionQueue(orderId);
      } catch {
        // Автопереход не должен отменять сохранение техкарты
      }

      return this.productionQueueRepo.findAll({
        where: { orderId },
        order: [
          ["sequence", "ASC"],
          ["id", "ASC"],
        ],
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Если заявка на этапе IN_PRODUCTION, но в очереди нет активного цеха —
   * активирует первый ожидающий (после импорта ТМЗ или смены маршрута).
   */
  async syncActiveProductionQueue(
    orderId: number,
    transaction?: Transaction,
  ): Promise<void> {
    const activeStage = await this.pipelineStageRepo.findOne({
      where: {
        orderId,
        status: PipelineStatus.ACTIVE,
        stageName: OrderStageType.IN_PRODUCTION,
      },
      transaction,
    });
    if (!activeStage) return;

    const hasActiveDept = await this.productionQueueRepo.count({
      where: { orderId, status: QueueStatus.ACTIVE },
      transaction,
    });
    if (hasActiveDept > 0) return;

    await this.activateFirstProductionDept(orderId, undefined, transaction);
  }

  private async isOrderInProduction(
    orderId: number,
    transaction?: Transaction,
  ): Promise<boolean> {
    const activeStage = await this.pipelineStageRepo.findOne({
      where: { orderId, status: PipelineStatus.ACTIVE },
      transaction,
    });
    if (activeStage) {
      return (
        normalizeOrderStage(activeStage.stageName) ===
        OrderStageType.IN_PRODUCTION
      );
    }
    const order = await this.orderRepo.findByPk(orderId, {
      attributes: ["currentStage"],
      transaction,
    });
    return (
      normalizeOrderStage(order?.currentStage) === OrderStageType.IN_PRODUCTION
    );
  }

  /**
   * До стадии Ишлаб чиқариш очередь цехов не должна быть ACTIVE.
   */
  async resetActiveQueueIfNotInProduction(
    orderId: number,
    transaction?: Transaction,
  ): Promise<void> {
    if (await this.isOrderInProduction(orderId, transaction)) return;

    await this.productionQueueRepo.update(
      { status: QueueStatus.PENDING, startedAt: null as unknown as number },
      { where: { orderId, status: QueueStatus.ACTIVE }, transaction },
    );
  }

  /**
   * В один момент ACTIVE только у одного уровня sequence (минимального).
   */
  private async enforceSingleActiveSequence(
    orderId: number,
    transaction?: Transaction,
  ): Promise<void> {
    const activeRows = await this.productionQueueRepo.findAll({
      where: { orderId, status: QueueStatus.ACTIVE },
      attributes: ["sequence"],
      transaction,
    });
    if (activeRows.length === 0) return;

    const minSequence = Math.min(
      ...activeRows.map((row) => Number(row.sequence)),
    );

    await this.productionQueueRepo.update(
      { status: QueueStatus.PENDING, startedAt: null as unknown as number },
      {
        where: {
          orderId,
          status: QueueStatus.ACTIVE,
          sequence: { [Op.gt]: minSequence },
        },
        transaction,
      },
    );
  }

  /**
   * Переход к следующему этапу pipeline.
   * Вызывается когда пользователь нажимает "Завершить этап".
   */
  async advanceToNextStage(
    orderId: number,
    userId?: number,
    comment?: string,
  ): Promise<FurnitureOrder> {
    const transaction = await this.sequelize.transaction();
    try {
      const order = await this.orderRepo.findByPk(orderId);
      if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

      const currentStageRecord = await this.pipelineStageRepo.findOne({
        where: { orderId, status: PipelineStatus.ACTIVE },
        transaction,
      });

      if (!currentStageRecord) {
        throw new BadRequestException("Нет активного этапа в pipeline");
      }

      const now = Date.now();
      const fromStageName =
        normalizeOrderStage(currentStageRecord.stageName) ??
        OrderStageType.TEXNOLOG;

      if (fromStageName === OrderStageType.IN_PRODUCTION) {
        await this.productionQueueRepo.update(
          { status: QueueStatus.DONE, completedAt: now },
          { where: { orderId }, transaction },
        );
      }

      // Завершаем текущий этап
      await currentStageRecord.update(
        {
          status: PipelineStatus.DONE,
          completedAt: now,
          ...(userId != null ? { completedByUserId: userId } : {}),
        },
        { transaction },
      );

      // Ищем следующий PENDING этап (пропуская временно отключённые)
      const nextStage = await this.skipPendingDisabledStages(
        orderId,
        transaction,
        now,
      );

      // Записываем историю
      await this.stageHistoryRepo.create(
        {
          orderId,
          eventType: OrderHistoryEventType.STAGE,
          fromStage: fromStageName,
          toStage: nextStage
            ? normalizeOrderStage(nextStage.stageName) ?? OrderStageType.TEXNOLOG
            : fromStageName,
          ...(userId != null ? { changedByUserId: userId } : {}),
          changedAt: now,
          comment,
        } as any,
        { transaction },
      );

      if (nextStage) {
        const nextStageName =
          normalizeOrderStage(nextStage.stageName) ?? OrderStageType.TEXNOLOG;
        // Активируем следующий этап
        await nextStage.update(
          { status: PipelineStatus.ACTIVE, startedAt: now },
          { transaction },
        );
        await order.update(
          { currentStage: nextStageName },
          { transaction },
        );

        if (nextStageName === OrderStageType.IN_PRODUCTION) {
          await this.startProductionQueue(orderId, userId, transaction);
        }
      } else {
        // Все этапы завершены
        await order.update(
          { currentStage: OrderStageType.COMPLETED },
          { transaction },
        );
      }

      await transaction.commit();
      await this.telegramOrderNotifierService.notifyStageChanged({
        orderId,
        fromStage: fromStageName,
        toStage: nextStage
          ? normalizeOrderStage(nextStage.stageName) ?? OrderStageType.TEXNOLOG
          : OrderStageType.COMPLETED,
        changedAt: now,
        comment,
      });

      return order.reload({
        include: [
          { model: Reference, as: "client" },
          { model: Reference, as: "analitic" },
          { model: OrderPipelineStage },
          {
            model: OrderProductionQueue,
            include: [{ model: Reference, as: "dept" }],
          },
          {
            model: OrderWork,
            separate: true,
            order: [
              ["lineIndex", "ASC"],
              ["id", "ASC"],
            ],
            include: [
              { model: Reference, as: "assignedDept" },
              { model: Reference, as: "workRef" },
            ],
          },
          {
            model: OrderMaterial,
            include: [{ model: Reference, as: "material" }],
          },
          {
            model: OrderStageHistory,
            include: [
              { model: User, as: "changedByUser" },
              { model: Reference, as: "fromDept" },
              { model: Reference, as: "toDept" },
            ],
          },
        ],
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Сброс ошибочных ACTIVE и старт только первого босқича при входе в производство.
   */
  private async startProductionQueue(
    orderId: number,
    userId?: number,
    transaction?: Transaction,
  ): Promise<void> {
    await this.productionQueueRepo.update(
      { status: QueueStatus.PENDING, startedAt: null as unknown as number },
      { where: { orderId, status: QueueStatus.ACTIVE }, transaction },
    );
    await this.activateFirstProductionDept(orderId, userId, transaction);
  }

  private async activateFirstProductionDept(
    orderId: number,
    userId?: number,
    transaction?: Transaction,
  ): Promise<void> {
    await this.enforceSingleActiveSequence(orderId, transaction);

    const activeCount = await this.productionQueueRepo.count({
      where: { orderId, status: QueueStatus.ACTIVE },
      transaction,
    });
    if (activeCount > 0) return;

    const firstDept = await this.productionQueueRepo.findOne({
      where: { orderId, status: QueueStatus.PENDING },
      order: [["sequence", "ASC"]],
      transaction,
    });

    if (!firstDept) return;
    const firstSequence = Number(firstDept.sequence);
    await this.productionQueueRepo.update(
      {
        status: QueueStatus.ACTIVE,
        startedAt: Date.now(),
      },
      {
        where: {
          orderId,
          status: QueueStatus.PENDING,
          sequence: firstSequence,
        },
        transaction,
      },
    );

    if (userId != null) {
      await this.logDeptTransition(
        orderId,
        userId,
        null,
        Number(firstDept.deptId),
        "Старт первого цеха",
        transaction,
      );
    }
  }

  private formatWorkDetail(work: UnfinishedWorkSummary): string {
    const name = work.workName?.trim() || "без названия";
    if (work.assignedDeptId == null) {
      return `#${work.id} «${name}» (цех не указан, статус: ${work.workStatus})`;
    }
    const deptLabel =
      work.assignedDeptName?.trim() || `цех #${work.assignedDeptId}`;
    return `#${work.id} «${name}» (цех: ${deptLabel}, статус: ${work.workStatus})`;
  }

  private formatUnfinishedWorkBlocker(
    works: UnfinishedWorkSummary[],
    headline: string,
  ): string[] {
    if (works.length === 0) return [];
    const n = works.length;
    let msg = `${headline} (осталось ${n})`;
    if (n <= 5) {
      msg += `: ${works.map((w) => this.formatWorkDetail(w)).join("; ")}`;
    }
    return [msg];
  }

  async getClassifiedUnfinishedWorks(
    orderId: number,
  ): Promise<ClassifiedUnfinishedWorks> {
    const queueRows = await this.productionQueueRepo.findAll({
      where: { orderId },
      attributes: ["deptId"],
    });
    const queueDeptIds = new Set(
      queueRows
        .map((row) => Number(row.deptId))
        .filter((deptId) => Number.isFinite(deptId)),
    );

    const unfinished = await this.orderWorkRepo.findAll({
      where: {
        orderId,
        workStatus: OrderPipelineService.UNFINISHED_WORK_STATUSES,
      },
      include: [
        {
          model: Reference,
          as: "assignedDept",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });

    const blocking: UnfinishedWorkSummary[] = [];
    const orphan: UnfinishedWorkSummary[] = [];

    for (const work of unfinished) {
      const assignedDeptId =
        work.assignedDeptId != null ? Number(work.assignedDeptId) : null;
      const summary: UnfinishedWorkSummary = {
        id: Number(work.id),
        workName: work.workName ?? "",
        workStatus: work.workStatus,
        assignedDeptId,
        assignedDeptName: work.assignedDept?.name ?? null,
      };

      if (
        assignedDeptId != null &&
        Number.isFinite(assignedDeptId) &&
        !queueDeptIds.has(assignedDeptId)
      ) {
        orphan.push(summary);
      } else {
        blocking.push(summary);
      }
    }

    return { blocking, orphan };
  }

  async getProductionAdvanceBlockers(orderId: number): Promise<string[]> {
    const { blocking } = await this.getClassifiedUnfinishedWorks(orderId);
    return this.formatUnfinishedWorkBlocker(
      blocking,
      "Не все производственные работы завершены",
    );
  }

  async getOrphanWorkAdvanceInfo(
    orderId: number,
  ): Promise<OrphanWorkAdvanceInfo> {
    const { orphan } = await this.getClassifiedUnfinishedWorks(orderId);
    if (orphan.length === 0) {
      return { warnings: [], orphanWorks: [] };
    }

    const details = orphan.map((w) => this.formatWorkDetail(w)).join("; ");
    const warnings = [
      orphan.length === 1
        ? `Работа вне техкарты — переход с Омбора не блокируется: ${details}. Переназначьте цех или удалите работу.`
        : `Работы вне техкарты (${orphan.length}) — переход с Омбора не блокируется: ${details}. Переназначьте цех или удалите работы.`,
    ];
    return { warnings, orphanWorks: orphan };
  }

  async validateCanAdvanceFromProduction(orderId: number): Promise<void> {
    const blockers = await this.getProductionAdvanceBlockers(orderId);
    if (blockers.length > 0) {
      throw new BadRequestException(blockers.join(". "));
    }
  }

  /**
   * Проверяет, все ли работы текущего активного цеха завершены.
   * Пропускает пустые цеха и уже завершённые уровни за один вызов.
   * Если следующего цеха нет — завершает весь IN_PRODUCTION этап.
   */
  async checkAndAdvanceProductionQueue(
    orderId: number,
    userId?: number,
  ): Promise<void> {
    if (!(await this.isOrderInProduction(orderId))) return;

    const transaction = await this.sequelize.transaction();
    let shouldAdvanceStage = false;
    try {
      await this.enforceSingleActiveSequence(orderId, transaction);

      for (;;) {
        let activeDepts = await this.productionQueueRepo.findAll({
          where: { orderId, status: QueueStatus.ACTIVE },
          include: [{ model: Reference, as: "dept", attributes: ["id", "name"] }],
          order: [
            ["sequence", "ASC"],
            ["id", "ASC"],
          ],
          transaction,
        });

        if (activeDepts.length === 0) {
          await this.activateFirstProductionDept(orderId, userId, transaction);
          activeDepts = await this.productionQueueRepo.findAll({
            where: { orderId, status: QueueStatus.ACTIVE },
            include: [{ model: Reference, as: "dept", attributes: ["id", "name"] }],
            order: [
              ["sequence", "ASC"],
              ["id", "ASC"],
            ],
            transaction,
          });
          if (activeDepts.length === 0) {
            break;
          }
        }

        const activeSequence = Number(activeDepts[0].sequence);
        const sequenceDepts = activeDepts.filter(
          (dept) => Number(dept.sequence) === activeSequence,
        );

        let levelComplete = true;
        for (const activeDept of sequenceDepts) {
          const unfinishedWorks = await this.orderWorkRepo.count({
            where: {
              orderId,
              assignedDeptId: Number(activeDept.deptId),
              workStatus: OrderPipelineService.UNFINISHED_WORK_STATUSES,
            },
            transaction,
          });
          if (unfinishedWorks > 0) {
            levelComplete = false;
            break;
          }
        }
        if (!levelComplete) {
          break;
        }

        for (const activeDept of sequenceDepts) {
          const deptId = Number(activeDept.deptId);
          const totalWorks = await this.orderWorkRepo.count({
            where: { orderId, assignedDeptId: deptId },
            transaction,
          });
          if (totalWorks === 0) {
            await this.logEmptyDeptSkipped(
              orderId,
              deptId,
              activeDept.dept?.name,
              transaction,
            );
          }
        }

        const now = Date.now();

        await this.productionQueueRepo.update(
          { status: QueueStatus.DONE, completedAt: now },
          {
            where: {
              orderId,
              status: QueueStatus.ACTIVE,
              sequence: activeSequence,
            },
            transaction,
          },
        );

        const nextDept = await this.productionQueueRepo.findOne({
          where: { orderId, status: QueueStatus.PENDING },
          order: [["sequence", "ASC"]],
          transaction,
        });

        if (!nextDept) {
          shouldAdvanceStage = true;
          break;
        }

        const nextSequence = Number(nextDept.sequence);
        const nextDeptRows = await this.productionQueueRepo.findAll({
          where: {
            orderId,
            status: QueueStatus.PENDING,
            sequence: nextSequence,
          },
          order: [["id", "ASC"]],
          transaction,
        });
        await this.productionQueueRepo.update(
          { status: QueueStatus.ACTIVE, startedAt: now },
          {
            where: {
              orderId,
              status: QueueStatus.PENDING,
              sequence: nextSequence,
            },
            transaction,
          },
        );

        if (userId != null) {
          const uniqueFromDeptIds = Array.from(
            new Set(sequenceDepts.map((dept) => Number(dept.deptId))),
          );
          const uniqueToDeptIds = Array.from(
            new Set(nextDeptRows.map((dept) => Number(dept.deptId))),
          );
          for (const toDeptId of uniqueToDeptIds) {
            const fromDeptId =
              uniqueFromDeptIds.length === 1 ? uniqueFromDeptIds[0] : null;
            await this.logDeptTransition(
              orderId,
              userId,
              fromDeptId,
              toDeptId,
              "Переход на следующий цех",
              transaction,
            );
          }
        }
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    if (shouldAdvanceStage) {
      await this.advanceToNextStage(
        orderId,
        userId,
        "Все производственные цеха завершены",
      );
    }
  }

  async replacePipelineStages(
    orderId: number,
    stages: OrderStageType[],
    transaction?: Transaction,
  ): Promise<void> {
    const run = async (t: Transaction) => {
      const order = await this.orderRepo.findByPk(orderId, { transaction: t });
      if (!order) {
        throw new NotFoundException(`Заявка ${orderId} не найдена`);
      }

      const currentStage =
        normalizeOrderStage(order.currentStage) ?? OrderStageType.TALABGOR;
      if (currentStage !== OrderStageType.TALABGOR) {
        throw new BadRequestException(
          "Маршрут можно менять только на этапе Талабгор",
        );
      }

      const existing = await this.pipelineStageRepo.findAll({
        where: { orderId },
        transaction: t,
      });
      const hasDone = existing.some(
        (stage) => stage.status === PipelineStatus.DONE,
      );
      if (hasDone) {
        throw new BadRequestException(
          "Нельзя изменить маршрут: часть этапов уже завершена",
        );
      }

      await this.pipelineStageRepo.destroy({ where: { orderId }, transaction: t });

      const now = Date.now();
      const stagesToCreate = stages.map((stageName, index) => ({
        orderId,
        stageName,
        sequence: index + 1,
        status: index === 0 ? PipelineStatus.ACTIVE : PipelineStatus.PENDING,
        ...(index === 0 ? { startedAt: now } : {}),
      }));

      await this.pipelineStageRepo.bulkCreate(stagesToCreate as any, {
        transaction: t,
      });

      await order.update({ currentStage: stages[0] }, { transaction: t });
    };

    if (transaction) {
      await run(transaction);
      return;
    }

    const ownTransaction = await this.sequelize.transaction();
    try {
      await run(ownTransaction);
      await ownTransaction.commit();
    } catch (err) {
      await ownTransaction.rollback();
      throw err;
    }
  }

  async getPipelineForOrder(orderId: number): Promise<OrderPipelineStage[]> {
    return this.pipelineStageRepo.findAll({
      where: { orderId },
      order: [["sequence", "ASC"]],
    });
  }

  async getProductionQueueForOrder(
    orderId: number,
  ): Promise<OrderProductionQueue[]> {
    return this.productionQueueRepo.findAll({
      where: { orderId },
      order: [["sequence", "ASC"]],
    });
  }

  async isDeptActiveForOrder(
    orderId: number,
    deptId: number,
  ): Promise<boolean> {
    const activeRows = await this.productionQueueRepo.findAll({
      where: { orderId, status: QueueStatus.ACTIVE },
      attributes: ["deptId"],
    });
    if (activeRows.length === 0) return false;
    return activeRows.some((row) => Number(row.deptId) === Number(deptId));
  }

  private async logEmptyDeptSkipped(
    orderId: number,
    deptId: number,
    deptName: string | undefined,
    transaction?: Transaction,
  ): Promise<void> {
    const label = deptName?.trim() || `цех #${deptId}`;
    await this.stageHistoryRepo.create(
      {
        orderId,
        eventType: OrderHistoryEventType.DEPT,
        fromDeptId: deptId,
        toDeptId: deptId,
        changedAt: Date.now(),
        comment: `Цех ${label} пропущен: нет работ`,
      } as any,
      { transaction },
    );
  }

  private async logDeptTransition(
    orderId: number,
    userId: number | undefined,
    fromDeptId: number | null,
    toDeptId: number,
    comment: string | undefined,
    transaction?: Transaction,
  ): Promise<void> {
    if (userId == null) return;
    await this.stageHistoryRepo.create(
      {
        orderId,
        eventType: OrderHistoryEventType.DEPT,
        fromDeptId,
        toDeptId,
        changedByUserId: userId,
        changedAt: Date.now(),
        comment,
      } as any,
      { transaction },
    );
  }

  /**
   * Возврат на предыдущий этап pipeline.
   */
  async revertToPreviousStage(
    orderId: number,
    userId: number,
    comment?: string,
  ): Promise<FurnitureOrder> {
    const transaction = await this.sequelize.transaction();
    try {
      const order = await this.orderRepo.findByPk(orderId);
      if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

      const currentStageRecord = await this.pipelineStageRepo.findOne({
        where: { orderId, status: PipelineStatus.ACTIVE },
        transaction,
      });

      if (!currentStageRecord) {
        throw new BadRequestException("Нет активного этапа в pipeline");
      }

      const fromStageName =
        normalizeOrderStage(currentStageRecord.stageName) ??
        OrderStageType.TEXNOLOG;

      if (fromStageName === OrderStageType.TALABGOR) {
        throw new BadRequestException("Нельзя вернуться с этапа Талабгор");
      }

      const previousStage = await this.findPreviousNonDisabledStage(
        orderId,
        currentStageRecord.sequence,
        transaction,
      );

      if (!previousStage) {
        throw new BadRequestException("Нет предыдущего этапа для возврата");
      }

      const toStageName =
        normalizeOrderStage(previousStage.stageName) ?? OrderStageType.TEXNOLOG;
      const now = Date.now();

      if (fromStageName === OrderStageType.IN_PRODUCTION) {
        await this.productionQueueRepo.update(
          {
            status: QueueStatus.PENDING,
            startedAt: null as unknown as number,
            completedAt: null as unknown as number,
          },
          { where: { orderId }, transaction },
        );
      }

      await currentStageRecord.update(
        {
          status: PipelineStatus.PENDING,
          startedAt: null as unknown as number,
          completedAt: null as unknown as number,
          completedByUserId: null as unknown as number,
        },
        { transaction },
      );

      await previousStage.update(
        {
          status: PipelineStatus.ACTIVE,
          startedAt: now,
          completedAt: null as unknown as number,
          completedByUserId: null as unknown as number,
        },
        { transaction },
      );

      await order.update({ currentStage: toStageName }, { transaction });

      if (toStageName === OrderStageType.IN_PRODUCTION) {
        await this.syncActiveProductionQueue(orderId, transaction);
      }

      await this.stageHistoryRepo.create(
        {
          orderId,
          eventType: OrderHistoryEventType.STAGE,
          fromStage: fromStageName,
          toStage: toStageName,
          changedByUserId: userId,
          changedAt: now,
          comment: comment || "Возврат на предыдущий этап",
        } as any,
        { transaction },
      );

      await transaction.commit();
      await this.telegramOrderNotifierService.notifyStageChanged({
        orderId,
        fromStage: fromStageName,
        toStage: toStageName,
        changedAt: now,
        comment,
      });

      return order.reload({
        include: [
          { model: Reference, as: "client" },
          { model: Reference, as: "analitic" },
          { model: OrderPipelineStage },
          {
            model: OrderProductionQueue,
            include: [{ model: Reference, as: "dept" }],
          },
          {
            model: OrderWork,
            separate: true,
            order: [
              ["lineIndex", "ASC"],
              ["id", "ASC"],
            ],
            include: [
              { model: Reference, as: "assignedDept" },
              { model: Reference, as: "workRef" },
            ],
          },
          {
            model: OrderMaterial,
            include: [{ model: Reference, as: "material" }],
          },
          {
            model: OrderStageHistory,
            include: [
              { model: User, as: "changedByUser" },
              { model: Reference, as: "fromDept" },
              { model: Reference, as: "toDept" },
            ],
          },
        ],
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  private static readonly IN_PROGRESS_WORK_STATUSES: WorkStatus[] = [
    WorkStatus.IN_PROGRESS,
    WorkStatus.PAUSE,
  ];

  private async assertOrderInProductionStage(
    orderId: number,
    transaction?: Transaction,
  ): Promise<void> {
    if (!(await this.isOrderInProduction(orderId, transaction))) {
      throw new BadRequestException(
        "Управление очередью доступно только на этапе Ишлаб чиқариш",
      );
    }
  }

  private requireCommentForForce(
    force: boolean | undefined,
    comment: string | undefined,
  ): void {
    if (force && !comment?.trim()) {
      throw new BadRequestException(
        "Для принудительного действия укажите комментарий",
      );
    }
  }

  private async getQueueRowByDept(
    orderId: number,
    deptId: number,
    transaction?: Transaction,
  ): Promise<OrderProductionQueue> {
    const row = await this.productionQueueRepo.findOne({
      where: { orderId, deptId },
      include: [{ model: Reference, as: "dept", attributes: ["id", "name"] }],
      transaction,
    });
    if (!row) {
      throw new BadRequestException(`Цех #${deptId} не найден в очереди заказа`);
    }
    return row;
  }

  private async countUnfinishedWorksInDept(
    orderId: number,
    deptId: number,
    transaction?: Transaction,
  ): Promise<number> {
    return this.orderWorkRepo.count({
      where: {
        orderId,
        assignedDeptId: deptId,
        workStatus: OrderPipelineService.UNFINISHED_WORK_STATUSES,
      },
      transaction,
    });
  }

  private async countInProgressWorksInDept(
    orderId: number,
    deptId: number,
    transaction?: Transaction,
  ): Promise<number> {
    return this.orderWorkRepo.count({
      where: {
        orderId,
        assignedDeptId: deptId,
        workStatus: OrderPipelineService.IN_PROGRESS_WORK_STATUSES,
      },
      transaction,
    });
  }

  private async areLowerSequencesDone(
    orderId: number,
    targetSequence: number,
    transaction?: Transaction,
  ): Promise<boolean> {
    const pendingOrActive = await this.productionQueueRepo.count({
      where: {
        orderId,
        sequence: { [Op.lt]: targetSequence },
        status: { [Op.in]: [QueueStatus.PENDING, QueueStatus.ACTIVE] },
      },
      transaction,
    });
    return pendingOrActive === 0;
  }

  private async activateSequenceLevel(
    orderId: number,
    sequence: number,
    userId: number,
    comment: string | undefined,
    transaction: Transaction,
  ): Promise<void> {
    await this.productionQueueRepo.update(
      { status: QueueStatus.PENDING, startedAt: null as unknown as number },
      { where: { orderId, status: QueueStatus.ACTIVE }, transaction },
    );

    const now = Date.now();
    await this.productionQueueRepo.update(
      { status: QueueStatus.ACTIVE, startedAt: now },
      {
        where: { orderId, status: QueueStatus.PENDING, sequence },
        transaction,
      },
    );

    await this.enforceSingleActiveSequence(orderId, transaction);

    const activated = await this.productionQueueRepo.findAll({
      where: { orderId, sequence, status: QueueStatus.ACTIVE },
      transaction,
    });
    for (const row of activated) {
      await this.logDeptTransition(
        orderId,
        userId,
        null,
        Number(row.deptId),
        comment?.trim() || "Ручная активация цеха",
        transaction,
      );
    }
  }

  private async completeSequenceLevel(
    orderId: number,
    sequence: number,
    userId: number,
    comment: string | undefined,
    transaction: Transaction,
  ): Promise<boolean> {
    const sequenceDepts = await this.productionQueueRepo.findAll({
      where: { orderId, sequence, status: QueueStatus.ACTIVE },
      include: [{ model: Reference, as: "dept", attributes: ["id", "name"] }],
      transaction,
    });
    if (sequenceDepts.length === 0) {
      throw new BadRequestException(
        `Босқич ${sequence} не активен — завершение недоступно`,
      );
    }

    for (const activeDept of sequenceDepts) {
      const deptId = Number(activeDept.deptId);
      const totalWorks = await this.orderWorkRepo.count({
        where: { orderId, assignedDeptId: deptId },
        transaction,
      });
      if (totalWorks === 0) {
        await this.logEmptyDeptSkipped(
          orderId,
          deptId,
          activeDept.dept?.name,
          transaction,
        );
      }
    }

    const now = Date.now();
    await this.productionQueueRepo.update(
      { status: QueueStatus.DONE, completedAt: now },
      {
        where: { orderId, status: QueueStatus.ACTIVE, sequence },
        transaction,
      },
    );

    const nextDept = await this.productionQueueRepo.findOne({
      where: { orderId, status: QueueStatus.PENDING },
      order: [["sequence", "ASC"]],
      transaction,
    });

    if (!nextDept) {
      for (const row of sequenceDepts) {
        await this.logDeptTransition(
          orderId,
          userId,
          Number(row.deptId),
          Number(row.deptId),
          comment?.trim() || "Ручное завершение цеха (последний)",
          transaction,
        );
      }
      return true;
    }

    const nextSequence = Number(nextDept.sequence);
    await this.productionQueueRepo.update(
      { status: QueueStatus.ACTIVE, startedAt: now },
      {
        where: {
          orderId,
          status: QueueStatus.PENDING,
          sequence: nextSequence,
        },
        transaction,
      },
    );

    const nextRows = await this.productionQueueRepo.findAll({
      where: {
        orderId,
        status: QueueStatus.ACTIVE,
        sequence: nextSequence,
      },
      transaction,
    });

    for (const toRow of nextRows) {
      const fromDeptId =
        sequenceDepts.length === 1
          ? Number(sequenceDepts[0].deptId)
          : null;
      await this.logDeptTransition(
        orderId,
        userId,
        fromDeptId,
        Number(toRow.deptId),
        comment?.trim() || "Ручное завершение цеха",
        transaction,
      );
    }

    return false;
  }

  async applyProductionQueueAction(
    orderId: number,
    input: ProductionQueueActionInput,
  ): Promise<ProductionQueueActionResult> {
    const warnings: string[] = [];
    const { action, userId, comment, force } = input;
    const deptId =
      input.deptId != null && Number.isFinite(Number(input.deptId))
        ? Number(input.deptId)
        : undefined;

    await this.assertOrderInProductionStage(orderId);

    if (action === "RECALCULATE") {
      await this.checkAndAdvanceProductionQueue(orderId, userId);
      return { warnings };
    }

    if (deptId == null) {
      throw new BadRequestException("Укажите deptId для этого действия");
    }

    if (action === "ACTIVATE") {
      const transaction = await this.sequelize.transaction();
      try {
        await this.assertOrderInProductionStage(orderId, transaction);
        const target = await this.getQueueRowByDept(orderId, deptId, transaction);
        const targetSequence = Number(target.sequence);

        if (target.status === QueueStatus.ACTIVE) {
          await transaction.commit();
          return { warnings };
        }

        if (target.status === QueueStatus.DONE && !force) {
          throw new BadRequestException(
            "Цех уже завершён. Для повторной активации используйте «Вернуть в ожидание» или принудительный режим",
          );
        }

        const lowerDone = await this.areLowerSequencesDone(
          orderId,
          targetSequence,
          transaction,
        );
        if (!lowerDone && !force) {
          throw new BadRequestException(
            "Предыдущие босқичи ещё не завершены. Завершите их или используйте принудительный режим с комментарием",
          );
        }
        this.requireCommentForForce(force, comment);

        if (target.status === QueueStatus.DONE) {
          await this.productionQueueRepo.update(
            {
              status: QueueStatus.PENDING,
              completedAt: null as unknown as number,
            },
            {
              where: { orderId, sequence: targetSequence, status: QueueStatus.DONE },
              transaction,
            },
          );
        }

        await this.activateSequenceLevel(
          orderId,
          targetSequence,
          userId,
          comment,
          transaction,
        );
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
      return { warnings };
    }

    if (action === "COMPLETE") {
      const transaction = await this.sequelize.transaction();
      let shouldAdvanceStage = false;
      try {
        await this.assertOrderInProductionStage(orderId, transaction);
        const target = await this.getQueueRowByDept(orderId, deptId, transaction);
        const targetSequence = Number(target.sequence);

        if (target.status === QueueStatus.PENDING && !force) {
          throw new BadRequestException(
            "Цех не активен. Активируйте его или используйте принудительный режим",
          );
        }
        if (target.status === QueueStatus.DONE) {
          throw new BadRequestException("Цех уже завершён");
        }

        const sequenceDepts = await this.productionQueueRepo.findAll({
          where: { orderId, sequence: targetSequence, status: QueueStatus.ACTIVE },
          transaction,
        });

        const deptIdsToCheck =
          sequenceDepts.length > 0
            ? sequenceDepts.map((r) => Number(r.deptId))
            : [deptId];

        const unfinishedDetails: string[] = [];
        for (const checkDeptId of deptIdsToCheck) {
          const count = await this.countUnfinishedWorksInDept(
            orderId,
            checkDeptId,
            transaction,
          );
          if (count > 0) {
            unfinishedDetails.push(`цех #${checkDeptId}: ${count} иш(лар)`);
          }
        }

        if (unfinishedDetails.length > 0 && !force) {
          throw new BadRequestException(
            `Незавершённые иши: ${unfinishedDetails.join("; ")}. Завершите иши или используйте принудительный режим с комментарием`,
          );
        }
        if (unfinishedDetails.length > 0 && force) {
          warnings.push(
            `Цех закрыт вручную при незавершённых ишах: ${unfinishedDetails.join("; ")}`,
          );
        }
        this.requireCommentForForce(force, comment);

        if (target.status === QueueStatus.PENDING && force) {
          await this.productionQueueRepo.update(
            { status: QueueStatus.ACTIVE, startedAt: Date.now() },
            {
              where: { orderId, deptId, status: QueueStatus.PENDING },
              transaction,
            },
          );
        }

        shouldAdvanceStage = await this.completeSequenceLevel(
          orderId,
          targetSequence,
          userId,
          comment,
          transaction,
        );
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }

      if (shouldAdvanceStage) {
        await this.advanceToNextStage(
          orderId,
          userId,
          comment?.trim() || "Все производственные цеха завершены (вручную)",
        );
      }
      return { warnings };
    }

    if (action === "RESET_PENDING") {
      const transaction = await this.sequelize.transaction();
      try {
        await this.assertOrderInProductionStage(orderId, transaction);
        const target = await this.getQueueRowByDept(orderId, deptId, transaction);
        const targetSequence = Number(target.sequence);

        if (target.status === QueueStatus.PENDING) {
          await transaction.commit();
          return { warnings };
        }

        const inProgress = await this.countInProgressWorksInDept(
          orderId,
          deptId,
          transaction,
        );
        if (inProgress > 0 && !force) {
          throw new BadRequestException(
            `В цехе есть иши в работе (${inProgress}). Дождитесь завершения или используйте принудительный режим с комментарием`,
          );
        }
        if (inProgress > 0 && force) {
          warnings.push(
            `Босқич возвращён в ожидание при ${inProgress} иши в работе`,
          );
        }
        this.requireCommentForForce(force, comment);

        await this.productionQueueRepo.update(
          {
            status: QueueStatus.PENDING,
            startedAt: null as unknown as number,
            completedAt: null as unknown as number,
          },
          {
            where: {
              orderId,
              sequence: { [Op.gte]: targetSequence },
            },
            transaction,
          },
        );

        await this.logDeptTransition(
          orderId,
          userId,
          deptId,
          deptId,
          comment?.trim() || "Ручной возврат цеха в ожидание",
          transaction,
        );

        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
      return { warnings };
    }

    throw new BadRequestException(`Неизвестное действие: ${action}`);
  }
}
