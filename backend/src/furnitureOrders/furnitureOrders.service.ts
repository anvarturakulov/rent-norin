import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { FurnitureOrder } from "./furnitureOrder.model";
import { OrderPipelineStage } from "src/orderPipeline/orderPipelineStage.model";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderCommonWork } from "src/orderCommonWorks/orderCommonWork.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { OrderHalfstuff } from "src/orderHalfstuffs/orderHalfstuff.model";
import { OrderCuttingIssue } from "src/orderCutting/orderCuttingIssue.model";
import { OrderCuttingOutput } from "src/orderCutting/orderCuttingOutput.model";
import { OrderStageHistory } from "src/orderStageHistory/orderStageHistory.model";
import { Reference } from "src/references/reference.model";
import { OrderPipelineService } from "src/orderPipeline/orderPipeline.service";
import { CreateFurnitureOrderDto } from "./dto/create-furniture-order.dto";
import { UpdateFurnitureOrderDto } from "./dto/update-furniture-order.dto";
import { UpdateProductionQueueDto } from "./dto/update-production-queue.dto";
import {
  FurnitureOrderType,
  getStagesForOrderType,
  normalizeOrderStage,
  OrderStageType,
  PipelineStatus,
  TEMPORARILY_DISABLED_STAGES,
} from "src/interfaces/furniture-order.interface";
import { fn, col, Op, where as sequelizeWhere, Order } from "sequelize";
import { User } from "src/users/users.model";
import { ProductNormsService } from "src/productNorms/product-norms.service";
import { Transaction } from "sequelize";
import { nextSequentialYearString } from "src/common/numbering/nextSequentialYearNumber";
import { ClientContractOrderLine } from "src/clientContracts/clientContractOrderLine.model";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import { OrderWorkLogMaterial } from "src/orderWorkLogMaterials/orderWorkLogMaterial.model";
import { OrderWorkLogWorker } from "src/orderWorkLogWorkers/orderWorkLogWorker.model";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocSTATUS, DocumentType } from "src/interfaces/document.interface";
import { OrderStoreWorkService } from "./order-store-work.service";
import { UsersService } from "src/users/users.service";
import { UserRoles } from "src/interfaces/user.interface";
import {
  ProductionQueueActionDto,
} from "./dto/production-queue-action.dto";

@Injectable()
export class FurnitureOrdersService {
  constructor(
    @InjectModel(FurnitureOrder)
    private readonly orderRepo: typeof FurnitureOrder,
    @InjectModel(ClientContractOrderLine)
    private readonly contractOrderLineRepo: typeof ClientContractOrderLine,
    @InjectModel(OrderWorkLog)
    private readonly workLogRepo: typeof OrderWorkLog,
    @InjectModel(OrderWorkLogMaterial)
    private readonly workLogMaterialRepo: typeof OrderWorkLogMaterial,
    @InjectModel(OrderWorkLogWorker)
    private readonly workLogWorkerRepo: typeof OrderWorkLogWorker,
    @InjectModel(Document)
    private readonly documentRepo: typeof Document,
    @InjectModel(DocValues)
    private readonly docValuesRepo: typeof DocValues,
    private readonly pipelineService: OrderPipelineService,
    private readonly productNormsService: ProductNormsService,
    private readonly storeWorkService: OrderStoreWorkService,
    private readonly usersService: UsersService,
  ) {}

  private static readonly QUEUE_MANAGE_ROLES: UserRoles[] = [
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.HEADGLOBAL,
    UserRoles.TEXNOLOG,
  ];

  private async assertQueueManageRole(userId: number): Promise<void> {
    const user = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException(`Пользователь ${userId} не найден`);
    }
    if (
      !FurnitureOrdersService.QUEUE_MANAGE_ROLES.includes(user.role as UserRoles)
    ) {
      throw new BadRequestException(
        "Недостаточно прав для управления очередью цехов",
      );
    }
  }

  private getActiveStageName(order: FurnitureOrder): OrderStageType {
    const active = order.pipelineStages?.find(
      (s) => s.status === PipelineStatus.ACTIVE,
    );
    return (
      normalizeOrderStage(active?.stageName ?? order.currentStage) ??
      OrderStageType.TALABGOR
    );
  }

  private async assertDrawingStageAction(
    userId: number,
    order: FurnitureOrder,
    action: "advance" | "revert",
  ): Promise<void> {
    const user = await this.usersService.getUserById(userId);
    if (!user || user.role !== UserRoles.DRAWING) return;
    const stage = this.getActiveStageName(order);
    if (action === "advance") {
      if (
        stage !== OrderStageType.SCALING &&
        stage !== OrderStageType.DRAWING
      ) {
        throw new BadRequestException(
          "DRAWING роли фақат Ўлчов ва Чизма босқичларини якунлаши мумкин",
        );
      }
      return;
    }
    if (stage !== OrderStageType.DRAWING) {
      throw new BadRequestException(
        "DRAWING роли фақат Чизма босқичидан орқага қайтиши мумкин",
      );
    }
  }

  private computeOrderTotal(
    count?: number | null,
    price?: number | null,
  ): number | undefined {
    const c = count != null && Number(count) > 0 ? Number(count) : undefined;
    const p = price != null && Number(price) >= 0 ? Number(price) : undefined;
    if (c == null || p == null) return undefined;
    return Number((c * p).toFixed(2));
  }

  private effectiveOrderDate() {
    return fn("COALESCE", fn("NULLIF", col("orderDate"), 0), col("createdDate"));
  }

  private orderByEffectiveDate(): Order {
    return [
      [this.effectiveOrderDate(), "DESC"],
      ["id", "DESC"],
    ];
  }

  private readonly fullInclude = [
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
      model: OrderCommonWork,
      separate: true,
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    },
    { model: OrderMaterial, include: [{ model: Reference, as: "material" }] },
    {
      model: OrderHalfstuff,
      include: [{ model: Reference, as: "halfstuff" }],
    },
    {
      model: OrderCuttingIssue,
      include: [{ model: Reference, as: "material" }],
    },
    {
      model: OrderCuttingOutput,
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
  ];

  async create(dto: CreateFurnitureOrderDto): Promise<FurnitureOrder> {
    const normalizedStages = this.normalizeAndValidateStages(
      dto.stages,
      dto.orderType,
    );

    const year = dto.orderDate
      ? new Date(Number(dto.orderDate)).getFullYear()
      : new Date(Number(dto.createdDate)).getFullYear();
    const orderNumber = await nextSequentialYearString(
      this.orderRepo as any,
      "orderNumber",
      dto.enterpriseId ?? null,
      year,
    );

    const total =
      this.computeOrderTotal(dto.count, dto.price) ??
      (dto.total != null ? Number(dto.total) : undefined);

    const order = await this.orderRepo.create({
      enterpriseId: dto.enterpriseId,
      clientId: dto.clientId,
      analiticId: dto.analiticId,
      orderNumber,
      orderType: dto.orderType,
      createdDate: dto.createdDate,
      orderDate: dto.orderDate,
      deadlineDate: dto.deadlineDate,
      count: dto.count,
      price: dto.price,
      total,
      comment: dto.comment,
      currentStage: normalizedStages[0],
      requiresClientSale: true,
    } as any);

    await this.pipelineService.createPipeline(
      order.id,
      normalizedStages,
      dto.productionDeptIds || [],
    );

    return this.normalizeLegacyStages(await this.findOne(order.id));
  }

  async findAll(
    enterpriseId?: number,
    stage?: OrderStageType,
    clientId?: number,
    dateStart?: number,
    dateEnd?: number,
    excludeCompleted?: boolean,
  ): Promise<FurnitureOrder[]> {
    const where: any = {};
    if (enterpriseId) where.enterpriseId = enterpriseId;
    if (clientId != null) where.clientId = Number(clientId);
    const normalizedStage = normalizeOrderStage(stage);
    if (normalizedStage) {
      where.currentStage = normalizedStage;
    } else if (excludeCompleted) {
      where.currentStage = { [Op.ne]: OrderStageType.COMPLETED };
    }

    const ds = dateStart != null ? Number(dateStart) : NaN;
    const de = dateEnd != null ? Number(dateEnd) : NaN;
    if (Number.isFinite(ds) && Number.isFinite(de)) {
      where[Op.and] = [
        ...(Array.isArray(where[Op.and]) ? where[Op.and] : []),
        sequelizeWhere(this.effectiveOrderDate(), { [Op.between]: [ds, de] }),
      ];
    }

    const orders = await this.orderRepo.findAll({
      where,
      include: [
        { model: Reference, as: "client" },
        { model: Reference, as: "analitic" },
        { model: OrderPipelineStage },
        {
          model: OrderProductionQueue,
          include: [{ model: Reference, as: "dept" }],
        },
      ],
      order: this.orderByEffectiveDate(),
    });

    const stuckOrderIds = orders
      .filter((order) => {
        const stage = normalizeOrderStage(order.currentStage);
        return stage != null && TEMPORARILY_DISABLED_STAGES.includes(stage);
      })
      .map((order) => order.id);

    for (const orderId of stuckOrderIds) {
      await this.pipelineService.skipDisabledActiveStageIfNeeded(orderId);
    }

    if (stuckOrderIds.length > 0) {
      const refreshed = await this.orderRepo.findAll({
        where,
        include: [
          { model: Reference, as: "client" },
          { model: Reference, as: "analitic" },
          { model: OrderPipelineStage },
          {
            model: OrderProductionQueue,
            include: [{ model: Reference, as: "dept" }],
          },
        ],
        order: this.orderByEffectiveDate(),
      });
      return refreshed.map((order) => this.normalizeLegacyStages(order));
    }

    return orders.map((order) => this.normalizeLegacyStages(order));
  }

  async findByClient(
    clientId: number,
    options?: { excludeCompleted?: boolean },
  ): Promise<FurnitureOrder[]> {
    const where: Record<string, unknown> = { clientId };
    if (options?.excludeCompleted) {
      where.currentStage = { [Op.ne]: OrderStageType.COMPLETED };
    }
    const orders = await this.orderRepo.findAll({
      where,
      include: [
        { model: Reference, as: "client" },
        { model: Reference, as: "analitic" },
      ],
      order: this.orderByEffectiveDate(),
      limit: 30,
    });
    return orders.map((order) => this.normalizeLegacyStages(order));
  }

  async findOneForClient(
    orderId: number,
    clientId: number,
  ): Promise<FurnitureOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, clientId },
      include: this.fullInclude as any,
    });
    if (!order) {
      throw new NotFoundException(`Заявка ${orderId} не найдена`);
    }
    return this.normalizeLegacyStages(order);
  }

  async findOne(id: number): Promise<FurnitureOrder> {
    await this.pipelineService.skipDisabledActiveStageIfNeeded(id);

    let order = await this.orderRepo.findByPk(id, {
      include: this.fullInclude as any,
    });

    if (!order) throw new NotFoundException(`Заявка ${id} не найдена`);

    const stage = normalizeOrderStage(order.currentStage);
    if (stage !== OrderStageType.IN_PRODUCTION) {
      await this.pipelineService.resetActiveQueueIfNotInProduction(id);
      const refreshed = await this.orderRepo.findByPk(id, {
        include: this.fullInclude as any,
      });
      if (refreshed) order = refreshed;
    } else {
      try {
        await this.pipelineService.checkAndAdvanceProductionQueue(id);
        const refreshed = await this.orderRepo.findByPk(id, {
          include: this.fullInclude as any,
        });
        if (refreshed) order = refreshed;
      } catch {
        // Автопереход не должен блокировать открытие карточки
      }
    }

    return this.normalizeLegacyStages(order);
  }

  private normalizeAndValidateStages(
    stages: OrderStageType[],
    orderType?: FurnitureOrderType,
  ): OrderStageType[] {
    const normalizedStages = stages
      .map((stage) => normalizeOrderStage(stage))
      .filter((stage): stage is OrderStageType => Boolean(stage));
    if (normalizedStages.length === 0) {
      throw new BadRequestException(
        "Укажите хотя бы один этап маршрута (stages)",
      );
    }

    if (orderType === FurnitureOrderType.READY_PRICE) {
      const allowed = new Set(getStagesForOrderType(FurnitureOrderType.READY_PRICE));
      const hasExcluded = normalizedStages.some((s) => !allowed.has(s));
      if (hasExcluded) {
        throw new BadRequestException(
          "«Нархи тайёр» заказда ишлаб чиқариш, раскрой, технолог ва ўлчов/чизма/нархлаш этаплари бўлмаслиги керак",
        );
      }
    }

    return normalizedStages;
  }

  async update(
    id: number,
    dto: UpdateFurnitureOrderDto,
  ): Promise<FurnitureOrder> {
    const sequelize = this.orderRepo.sequelize!;
    await sequelize.transaction(async (t: Transaction) => {
      const order = await this.orderRepo.findByPk(id, { transaction: t });
      if (!order) throw new NotFoundException(`Заявка ${id} не найдена`);

      const nextOrderType = dto.orderType ?? order.orderType;
      const { stages, ...orderPatch } = dto;

      const activeStage =
        normalizeOrderStage(order.currentStage) ?? OrderStageType.TALABGOR;
      const touchesCoreOrderFields =
        dto.orderDate !== undefined ||
        dto.deadlineDate !== undefined ||
        dto.analiticId !== undefined ||
        dto.count !== undefined ||
        dto.price !== undefined;
      const canEditCoreOrderFields =
        activeStage === OrderStageType.TALABGOR ||
        activeStage === OrderStageType.PRICING ||
        activeStage === OrderStageType.DOGOVOR;
      if (touchesCoreOrderFields && !canEditCoreOrderFields) {
        throw new BadRequestException(
          "Сана, тайёр маҳсулот, миқдор ва нархни фақат «Талабгор», «Нархлаш» ёки «Шартнома» босқичида ўзгартириш мумкин",
        );
      }

      const patch: UpdateFurnitureOrderDto & { total?: number } = {
        ...orderPatch,
      };
      if (dto.count !== undefined || dto.price !== undefined) {
        const nextCount =
          dto.count !== undefined ? dto.count : order.count;
        const nextPrice =
          dto.price !== undefined ? dto.price : order.price;
        const computed = this.computeOrderTotal(nextCount, nextPrice);
        if (computed !== undefined) patch.total = computed;
      }

      await order.update(patch as any, { transaction: t });

      if (stages) {
        const normalizedStages = this.normalizeAndValidateStages(
          stages,
          nextOrderType,
        );
        await this.pipelineService.replacePipelineStages(
          id,
          normalizedStages,
          t,
        );
      }

      if (dto.count !== undefined) {
        const qty = Number(dto.count) > 0 ? Number(dto.count) : 1;
        await this.recalcRowsByOrderCount(id, qty, t);
      }
    });
    return this.normalizeLegacyStages(await this.findOne(id));
  }

  private async recalcRowsByOrderCount(
    orderId: number,
    count: number,
    transaction: Transaction,
  ): Promise<void> {
    const works = await OrderWork.findAll({
      where: { orderId },
      transaction,
    });
    for (const w of works) {
      const countInUnit = Number(w.countInUnit ?? 0);
      const timeInUnit = Number(w.timeInUnit ?? 0);
      const salaryInUnit = Number(w.salaryInUnit ?? 0);
      await w.update(
        {
          finishedProductQty: count,
          countInOrder: countInUnit * count,
          timeInOrder: timeInUnit * count,
          salaryInOrder: salaryInUnit * count,
        } as any,
        { transaction },
      );
    }

    const materials = await OrderMaterial.findAll({
      where: { orderId },
      transaction,
    });
    for (const m of materials) {
      const countPlanned = Number(m.countPlanned ?? 0);
      const price = Number(m.price ?? 0);
      const countInOrder = countPlanned * count;
      await m.update(
        {
          finishedProductQty: count,
          countInOrder,
          total: price * countInOrder,
        } as any,
        { transaction },
      );
    }

    const halfstuffs = await OrderHalfstuff.findAll({
      where: { orderId },
      transaction,
    });
    for (const h of halfstuffs) {
      const countPlanned = Number(h.countPlanned ?? 0);
      const price = Number(h.price ?? 0);
      const countInOrder = countPlanned * count;
      await h.update(
        {
          finishedProductQty: count,
          countInOrder,
          total: price * countInOrder,
        } as any,
        { transaction },
      );
    }
  }

  async updateProductionQueue(
    id: number,
    dto: UpdateProductionQueueDto,
  ): Promise<FurnitureOrder> {
    const order = await this.orderRepo.findByPk(id);
    if (!order) throw new NotFoundException(`Заявка ${id} не найдена`);

    const normalizedItems = dto.items
      .map((item) => ({
        deptId: Number(item.deptId),
        sequence: Number(item.sequence),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.deptId) &&
          Number.isFinite(item.sequence) &&
          item.sequence > 0,
      );

    const works = await OrderWork.findAll({
      where: { orderId: id },
      attributes: ["assignedDeptId"],
    });
    const deptsWithWorks = new Set(
      works
        .map((w) => w.assignedDeptId)
        .filter(
          (deptId): deptId is number =>
            deptId != null && Number.isFinite(Number(deptId)),
        )
        .map(Number),
    );
    if (deptsWithWorks.size > 0) {
      const emptyDepts = normalizedItems.filter(
        (item) => !deptsWithWorks.has(item.deptId),
      );
      if (emptyDepts.length > 0) {
        const deptIds = emptyDepts.map((item) => item.deptId).join(", ");
        throw new BadRequestException(
          `В технологической карте указаны цеха без работ (ID: ${deptIds}). Назначьте работы на цех или уберите его из маршрута.`,
        );
      }
    }

    await this.pipelineService.replaceProductionQueue(id, normalizedItems);
    return this.normalizeLegacyStages(await this.findOne(id));
  }

  async productionQueueAction(
    id: number,
    dto: ProductionQueueActionDto,
  ): Promise<{ order: FurnitureOrder; warnings: string[] }> {
    await this.assertQueueManageRole(dto.userId);

    const result = await this.pipelineService.applyProductionQueueAction(id, {
      action: dto.action,
      deptId: dto.deptId,
      userId: dto.userId,
      comment: dto.comment,
      force: dto.force,
    });

    return {
      order: this.normalizeLegacyStages(await this.findOne(id)),
      warnings: result.warnings,
    };
  }

  async advanceStage(
    id: number,
    userId: number,
    comment?: string,
  ): Promise<FurnitureOrder> {
    const order = await this.findOne(id);
    await this.assertDrawingStageAction(userId, order, "advance");
    // TODO: временное отключение проверок Омбор
    // const order = await this.findOne(id);
    // const activeStage = order.pipelineStages?.find(
    //   (s) => s.status === PipelineStatus.ACTIVE,
    // );
    // const fromStore =
    //   activeStage?.stageName === OrderStageType.STORE ||
    //   order.currentStage === OrderStageType.STORE;
    // if (fromStore) {
    //   await this.storeWorkService.validateCanAdvanceFromStore(order);
    // }
    return this.normalizeLegacyStages(
      await this.pipelineService.advanceToNextStage(id, userId, comment),
    );
  }

  async getRevertBlockers(order: FurnitureOrder): Promise<string[]> {
    const blockers: string[] = [];
    const activeStage = order.pipelineStages?.find(
      (s) => s.status === PipelineStatus.ACTIVE,
    );
    const stageName =
      activeStage?.stageName ?? order.currentStage ?? OrderStageType.TALABGOR;

    if (stageName === OrderStageType.TALABGOR) {
      blockers.push("Нельзя вернуться с этапа Талабгор");
      return blockers;
    }

    if (stageName === OrderStageType.COMPLETED) {
      blockers.push("Заявка уже завершена");
      return blockers;
    }

    const provedDoc = async (docId?: number | null) => {
      if (!docId) return false;
      const doc = await this.documentRepo.findByPk(docId);
      return !!doc && doc.docStatus === DocSTATUS.PROVEDEN;
    };

    if (stageName === OrderStageType.STORE) {
      if (await this.storeWorkService.hasAnyProvedStoreMaterialWriteoff(order.id)) {
        blockers.push(
          "Проведено списание материалов — отмените проведение документов",
        );
      }
      if (await this.storeWorkService.hasAnyProvedStoreHalfstuffWriteoff(order.id)) {
        blockers.push(
          "Проведено списание полуфабрикатов — отмените проведение документов",
        );
      }
      if (await this.storeWorkService.hasAnyProvedStoreReceipt(order.id)) {
        blockers.push("Проведён приход — отмените проведение документов");
      }
      if (await this.storeWorkService.hasAnyProvedStoreSale(order.id)) {
        blockers.push("Проведена накладная клиенту — отмените проведение документов");
      }
    }

    if (stageName === OrderStageType.IN_PRODUCTION) {
      const provedWriteoffs = await this.documentRepo.count({
        where: {
          docStatus: DocSTATUS.PROVEDEN,
          documentType: {
            [Op.in]: [
              DocumentType.LeaveMaterial,
              DocumentType.LeaveOnlyOneMaterial,
              DocumentType.LeaveHalfstuff,
              DocumentType.LeaveProd,
            ],
          },
        },
        include: [
          {
            model: DocValues,
            where: { orderId: order.id },
            required: true,
          },
        ],
      });
      if (provedWriteoffs > 0) {
        blockers.push(
          "Есть проведённые документы списания по заказу — отмените проведение",
        );
      }
    }

    return blockers;
  }

  async revertStage(
    id: number,
    userId: number,
    comment?: string,
  ): Promise<FurnitureOrder> {
    const order = await this.findOne(id);
    await this.assertDrawingStageAction(userId, order, "revert");
    const blockers = await this.getRevertBlockers(order);
    if (blockers.length > 0) {
      throw new BadRequestException(blockers.join(". "));
    }
    return this.normalizeLegacyStages(
      await this.pipelineService.revertToPreviousStage(id, userId, comment),
    );
  }

  async importFromCard(id: number): Promise<FurnitureOrder> {
    await this.productNormsService.syncNormsToOrder(id);
    await this.pipelineService.syncActiveProductionQueue(id);
    try {
      await this.pipelineService.checkAndAdvanceProductionQueue(id);
    } catch {
      // Импорт не должен падать из-за автоперехода
    }
    return this.normalizeLegacyStages(await this.findOne(id));
  }

  async remove(id: number): Promise<void> {
    const order = await this.orderRepo.findByPk(id);
    if (!order) {
      throw new NotFoundException(`Заявка ${id} не найдена`);
    }

    const contractLineCount = await this.contractOrderLineRepo.count({
      where: { furnitureOrderId: id },
    });
    if (contractLineCount > 0) {
      throw new BadRequestException(
        "Нельзя удалить заявку: она указана в договоре с клиентом. Сначала уберите заявку из договора.",
      );
    }

    const relatedDocIds = await this.collectRelatedDocumentIds(
      id,
      order.linkedDocId,
      order.receiptDocId,
      order.saleDocId,
    );
    const documents =
      relatedDocIds.length > 0
        ? await this.documentRepo.findAll({
            where: { id: { [Op.in]: relatedDocIds } },
          })
        : [];

    const provedenIds = documents
      .filter((d) => d.docStatus === DocSTATUS.PROVEDEN)
      .map((d) => Number(d.id));
    if (provedenIds.length > 0) {
      throw new BadRequestException(
        `Нельзя удалить заявку: есть проведённые документы (id: ${provedenIds.join(", ")}). Сначала отмените проводки.`,
      );
    }

    const pendingIds = documents
      .filter((d) => d.docStatus === DocSTATUS.PENDING)
      .map((d) => Number(d.id));
    if (pendingIds.length > 0) {
      throw new BadRequestException(
        `Нельзя удалить заявку: есть документы в статусе PENDING (id: ${pendingIds.join(", ")}).`,
      );
    }

    const sequelize = this.orderRepo.sequelize!;
    await sequelize.transaction(async (t: Transaction) => {
      const openDocIds = documents
        .filter((d) => d.docStatus === DocSTATUS.OPEN)
        .map((d) => Number(d.id));
      if (openDocIds.length > 0) {
        await this.documentRepo.update(
          { docStatus: DocSTATUS.DELETED },
          { where: { id: { [Op.in]: openDocIds } }, transaction: t },
        );
      }

      const logs = await this.workLogRepo.findAll({
        where: { orderId: id },
        attributes: ["id"],
        transaction: t,
      });
      const logIds = logs.map((l) => Number(l.id));
      if (logIds.length > 0) {
        await this.workLogWorkerRepo.destroy({
          where: { logId: { [Op.in]: logIds } },
          transaction: t,
        });
        await this.workLogMaterialRepo.destroy({
          where: { logId: { [Op.in]: logIds } },
          transaction: t,
        });
      }
      await this.workLogRepo.destroy({ where: { orderId: id }, transaction: t });
      await OrderWork.destroy({ where: { orderId: id }, transaction: t });
      await OrderCommonWork.destroy({ where: { orderId: id }, transaction: t });
      await OrderMaterial.destroy({ where: { orderId: id }, transaction: t });
      await OrderProductionQueue.destroy({
        where: { orderId: id },
        transaction: t,
      });
      await OrderPipelineStage.destroy({ where: { orderId: id }, transaction: t });
      await OrderStageHistory.destroy({ where: { orderId: id }, transaction: t });
      await order.destroy({ transaction: t });
    });
  }

  private async collectRelatedDocumentIds(
    orderId: number,
    linkedDocId?: number | null,
    receiptDocId?: number | null,
    saleDocId?: number | null,
  ): Promise<number[]> {
    const ids = new Set<number>();
    if (linkedDocId != null && Number(linkedDocId) > 0) {
      ids.add(Number(linkedDocId));
    }
    if (receiptDocId != null && Number(receiptDocId) > 0) {
      ids.add(Number(receiptDocId));
    }
    if (saleDocId != null && Number(saleDocId) > 0) {
      ids.add(Number(saleDocId));
    }

    const docValuesRows = await this.docValuesRepo.findAll({
      where: { orderId },
      attributes: ["docId"],
    });
    for (const row of docValuesRows) {
      if (row.docId != null) ids.add(Number(row.docId));
    }

    const logs = await this.workLogRepo.findAll({
      where: { orderId },
      attributes: ["id"],
    });
    const logIds = logs.map((l) => Number(l.id));
    if (logIds.length > 0) {
      const logMaterials = await this.workLogMaterialRepo.findAll({
        where: { logId: { [Op.in]: logIds } },
        attributes: ["leaveMaterialDocId"],
      });
      for (const m of logMaterials) {
        if (m.leaveMaterialDocId != null && Number(m.leaveMaterialDocId) > 0) {
          ids.add(Number(m.leaveMaterialDocId));
        }
      }
    }

    return [...ids];
  }

  private normalizeLegacyStages(order: FurnitureOrder): FurnitureOrder {
    const asAny = order as any;

    const currentStage = normalizeOrderStage(asAny.currentStage);
    if (currentStage) asAny.currentStage = currentStage;

    if (Array.isArray(asAny.pipelineStages)) {
      asAny.pipelineStages.forEach((stage: any) => {
        stage.stageName =
          normalizeOrderStage(stage.stageName) ?? OrderStageType.TEXNOLOG;
      });
    }

    if (Array.isArray(asAny.stageHistory)) {
      asAny.stageHistory.forEach((item: any) => {
        item.fromStage = normalizeOrderStage(item.fromStage);
        item.toStage = normalizeOrderStage(item.toStage);
      });
    }

    return order;
  }

  async findByDept(
    enterpriseId: number,
    deptId: number,
  ): Promise<FurnitureOrder[]> {
    return this.orderRepo.findAll({
      where: { enterpriseId },
      include: [
        { model: Reference, as: "client" },
        {
          model: OrderWork,
          required: true,
          separate: true,
          order: [
            ["lineIndex", "ASC"],
            ["id", "ASC"],
          ],
          where: { assignedDeptId: deptId },
          include: [
            {
              model: OrderProductionQueue,
              where: { status: "ACTIVE" },
              required: true,
            },
          ],
        },
      ],
    });
  }

  async getDeptLoadAnalysis(enterpriseId: number, currentOrderId: number) {
    const productionOrders = await this.orderRepo.findAll({
      where: { enterpriseId, currentStage: OrderStageType.IN_PRODUCTION },
      include: [
        { model: Reference, as: "client" },
        { model: Reference, as: "analitic" },
        {
          model: OrderWork,
          separate: true,
          order: [
            ["lineIndex", "ASC"],
            ["id", "ASC"],
          ],
          include: [{ model: Reference, as: "assignedDept" }],
        },
      ],
      order: [["createdDate", "ASC"]],
    });

    const validCurrentOrderId = Number(currentOrderId);
    let currentOrder =
      Number.isFinite(validCurrentOrderId) && validCurrentOrderId > 0
        ? (productionOrders.find((o) => Number(o.id) === validCurrentOrderId) ??
          null)
        : null;
    if (!currentOrder) {
      currentOrder = await this.orderRepo.findOne({
        where: { id: validCurrentOrderId, enterpriseId },
        include: [
          { model: Reference, as: "client" },
          { model: Reference, as: "analitic" },
          {
            model: OrderWork,
            separate: true,
            order: [
              ["lineIndex", "ASC"],
              ["id", "ASC"],
            ],
            include: [{ model: Reference, as: "assignedDept" }],
          },
        ],
      });
    }

    const ordersForSchedule = [
      ...productionOrders.filter((o) => Number(o.id) !== validCurrentOrderId),
      ...(currentOrder ? [currentOrder] : []),
    ];

    const deptMap = new Map<
      number,
      { deptName: string; cursor: Date; works: any[] }
    >();

    const today = new Date();
    today.setHours(9, 0, 0, 0);

    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const addWorkingHours = (date: Date, hours: number): Date => {
      const result = new Date(date);
      let remaining = hours;
      while (remaining > 0) {
        if (result.getDay() === 0) {
          result.setDate(result.getDate() + 1);
          result.setHours(9, 0, 0, 0);
          continue;
        }
        const endOfDay = new Date(result);
        endOfDay.setHours(17, 0, 0, 0);
        if (endOfDay <= result) {
          result.setDate(result.getDate() + 1);
          result.setHours(9, 0, 0, 0);
          continue;
        }
        const hoursLeft = (endOfDay.getTime() - result.getTime()) / 3_600_000;
        if (remaining <= hoursLeft) {
          result.setTime(result.getTime() + remaining * 3_600_000);
          remaining = 0;
        } else {
          remaining -= hoursLeft;
          result.setDate(result.getDate() + 1);
          result.setHours(9, 0, 0, 0);
        }
      }
      return result;
    };

    for (const order of ordersForSchedule) {
      const isCurrentOrder = Number(order.id) === validCurrentOrderId;
      const clientName = (order as any).client?.name ?? "";
      const productName = (order as any).analitic?.name ?? "";

      for (const work of (order as any).works ?? []) {
        // Works without assigned dept are still shown in report as a separate lane.
        const rawDeptId = work.assignedDeptId ?? null;
        const deptId: number = rawDeptId ? Number(rawDeptId) : -1;
        const deptName: string = rawDeptId
          ? (work.assignedDept?.name ?? `Цех ${deptId}`)
          : "Цех тайинланмаган";
        const timeInOrder: number = Number(work.timeInOrder) || 0;

        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { deptName, cursor: new Date(today), works: [] });
        }
        const dept = deptMap.get(deptId)!;
        const startDate = toDateStr(dept.cursor);
        const endCursor = addWorkingHours(dept.cursor, timeInOrder);
        const endDate = toDateStr(endCursor);
        dept.cursor = endCursor;

        dept.works.push({
          workId: work.id,
          workName: work.workName ?? "",
          timeInOrder,
          startDate,
          endDate,
          orderId: Number(order.id),
          orderNumber: order.orderNumber ?? String(order.id),
          clientName,
          productName,
          isCurrentOrder,
        });
      }
    }

    const result: any[] = [];
    for (const [deptId, { deptName, works }] of deptMap.entries()) {
      const currentWorks = works.filter((w) => w.isCurrentOrder);
      const currentOrderStartDate = currentWorks.length
        ? currentWorks.reduce((a, b) => (a.startDate < b.startDate ? a : b))
            .startDate
        : null;
      const currentOrderEndDate = currentWorks.length
        ? currentWorks.reduce((a, b) => (a.endDate > b.endDate ? a : b)).endDate
        : null;

      result.push({
        deptId,
        deptName,
        works,
        currentOrderStartDate,
        currentOrderEndDate,
      });
    }

    return result;
  }

  async getSalaryReport(
    enterpriseId: number,
    dateFrom: number,
    dateTo: number,
  ) {
    const { OrderWorkLog } = await import(
      "src/orderWorkLogs/orderWorkLog.model"
    );
    const { OrderWorkLogWorker } = await import(
      "src/orderWorkLogWorkers/orderWorkLogWorker.model"
    );
    return this.orderRepo.findAll({
      where: { enterpriseId },
      include: [
        { model: Reference, as: "client" },
        {
          model: OrderWork,
          separate: true,
          order: [
            ["lineIndex", "ASC"],
            ["id", "ASC"],
          ],
          include: [
            {
              model: OrderWorkLog,
              where: {
                status: "FINISHED",
                date: { [Op.between]: [dateFrom, dateTo] },
              },
              include: [
                { model: Reference, as: "worker" },
                {
                  model: OrderWorkLogWorker,
                  include: [{ model: Reference, as: "worker" }],
                },
              ],
            },
          ],
        },
      ],
    });
  }
}
