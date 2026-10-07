import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { OrderWorkLog } from "./orderWorkLog.model";
import { OrderWorkLogMaterial } from "src/orderWorkLogMaterials/orderWorkLogMaterial.model";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { Reference } from "src/references/reference.model";
import { OrderWorksService } from "src/orderWorks/orderWorks.service";
import { OrderMaterialsService } from "src/orderMaterials/orderMaterials.service";
import { OrderPipelineService } from "src/orderPipeline/orderPipeline.service";
import { CreateOrderWorkLogDto } from "./dto/create-order-work-log.dto";
import { FinishOrderWorkLogDto } from "./dto/finish-order-work-log.dto";
import {
  LogStatus,
  WorkStatus,
} from "src/interfaces/furniture-order.interface";
import { Sequelize } from "sequelize-typescript";
import { CreateLeaveMaterialDocDto } from "./dto/create-leave-material-doc.dto";
import { CreateWorkLeaveMaterialDocDto } from "./dto/create-work-leave-material-doc.dto";
import { DocumentsService } from "src/documents/documents.service";
import { UsersService } from "src/users/users.service";
import { ReferencesService } from "src/references/references.service";
import { DocSTATUS, DocumentType } from "src/interfaces/document.interface";
import { TypeTMZ } from "src/interfaces/reference.interface";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { Logger } from "@nestjs/common";
import { OrderWorkLogWorker } from "src/orderWorkLogWorkers/orderWorkLogWorker.model";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { Op } from "sequelize";
import { User } from "src/users/users.model";
import { SettingsService } from "src/settings/settings.service";
import { resolveHalfstuffWriteoffChargeId, resolveMaterialWriteoffChargeId } from "src/documents/helper/materialWriteoff.helper";

@Injectable()
export class OrderWorkLogsService {
  private readonly logger = new Logger(OrderWorkLogsService.name);

  private static readonly WORK_WRITEOFF_DOC_TYPES: DocumentType[] = [
    DocumentType.LeaveOnlyOneMaterial,
    DocumentType.LeaveHalfstuff,
    DocumentType.LeaveProd,
  ];

  constructor(
    @InjectModel(OrderWorkLog)
    private readonly logRepo: typeof OrderWorkLog,
    @InjectModel(OrderWorkLogMaterial)
    private readonly logMaterialRepo: typeof OrderWorkLogMaterial,
    @InjectModel(OrderWorkLogWorker)
    private readonly logWorkerRepo: typeof OrderWorkLogWorker,
    @InjectModel(Document)
    private readonly documentRepo: typeof Document,
    @InjectModel(DocValues)
    private readonly docValuesRepo: typeof DocValues,
    @InjectModel(FurnitureOrder)
    private readonly orderRepo: typeof FurnitureOrder,
    private readonly worksService: OrderWorksService,
    private readonly materialsService: OrderMaterialsService,
    private readonly pipelineService: OrderPipelineService,
    private readonly sequelize: Sequelize,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
    private readonly referencesService: ReferencesService,
    private readonly settingsService: SettingsService,
  ) {}

  private calcSessionHours(startedAt?: number | null, finishedAt?: number | null): number {
    if (!startedAt || !finishedAt) return 0;
    return Math.max(0, Number(finishedAt - startedAt) / 3600000);
  }

  private async recalcWorkHourTotalFact(
    workId: number,
    transaction?: any,
  ): Promise<void> {
    const rows = await this.logRepo.findAll({
      where: { workId },
      attributes: ["hoursSpent"],
      transaction,
    });
    const total = rows.reduce(
      (sum, row) => sum + Number(row.hoursSpent || 0),
      0,
    );
    await this.worksService.setHourFact(workId, total, transaction);
  }

  private async syncWorkStatusFromLogs(
    workId: number,
    transaction?: any,
  ): Promise<void> {
    const startedCount = await this.logRepo.count({
      where: { workId, status: LogStatus.STARTED },
      transaction,
    });
    if (startedCount > 0) {
      await this.worksService.markStatus(workId, WorkStatus.IN_PROGRESS, transaction);
      return;
    }
    const work = await this.worksService.findByPk(workId, transaction);
    if (!work || work.workStatus === WorkStatus.DONE) return;
    await this.worksService.markStatus(workId, WorkStatus.PAUSE, transaction);
  }

  private async closeOtherWorkSessions(
    workId: number,
    initiatorLogId: number,
    now: number,
    transaction?: any,
  ): Promise<void> {
    const otherLogs = await this.logRepo.findAll({
      where: {
        workId,
        id: { [Op.ne]: initiatorLogId },
        status: { [Op.in]: [LogStatus.STARTED, LogStatus.PAUSED] },
      },
      transaction,
    });

    for (const otherLog of otherLogs) {
      if (otherLog.status === LogStatus.STARTED) {
        const hoursSpent = this.calcSessionHours(otherLog.startedAt, now);
        await otherLog.update(
          {
            status: LogStatus.FINISHED,
            finishedAt: now,
            hoursSpent,
          },
          { transaction },
        );
      } else if (otherLog.status === LogStatus.PAUSED) {
        const hoursSpent =
          otherLog.hoursSpent != null
            ? Number(otherLog.hoursSpent)
            : this.calcSessionHours(otherLog.startedAt, otherLog.finishedAt);
        await otherLog.update(
          {
            status: LogStatus.FINISHED,
            hoursSpent,
          },
          { transaction },
        );
      }
    }
  }

  private async resolveWorkerReferenceId(authUserId: number): Promise<number> {
    if (!Number.isFinite(Number(authUserId))) {
      throw new BadRequestException(
        "Пользователь не авторизован или токен не содержит user.id",
      );
    }

    const user = await this.usersService.getUserById(authUserId);
    if (!user) {
      throw new NotFoundException(`Пользователь ${authUserId} не найден`);
    }

    if (user.telegramId) {
      const workerByTelegram = await this.referencesService.getWorker(
        String(user.telegramId),
      );
      if (workerByTelegram?.id) {
        return Number(workerByTelegram.id);
      }
    }

    throw new BadRequestException(
      "Не найден сотрудник WORKERS для текущего пользователя по telegramId. Привяжите telegramId пользователя к сотруднику в справочнике WORKERS.",
    );
  }

  async getMyWorker(authUserId: number): Promise<{
    workerId: number;
    workerName?: string;
  }> {
    const workerId = await this.resolveWorkerReferenceId(authUserId);
    const worker = await this.referencesService.getReferenceById(workerId);
    return {
      workerId,
      workerName: worker?.name,
    };
  }

  async startWork(
    dto: CreateOrderWorkLogDto,
    authUserId: number,
  ): Promise<OrderWorkLog> {
    const now = Date.now();
    const workerId = await this.resolveWorkerReferenceId(authUserId);

    const work = await this.worksService.findOne(dto.workId);
    if (Number(work.orderId) !== Number(dto.orderId)) {
      throw new BadRequestException("Работа не относится к указанному заказу");
    }
    if (!work.assignedDeptId) {
      throw new BadRequestException("Для работы не указан цех");
    }
    const canStartByQueue = await this.pipelineService.isDeptActiveForOrder(
      Number(work.orderId),
      Number(work.assignedDeptId),
    );
    if (!canStartByQueue) {
      throw new BadRequestException(
        "Старт недоступен: цех ожидает очередь по технологической карте",
      );
    }

    const activeLog = await this.logRepo.findOne({
      where: { workId: dto.workId, workerId, status: LogStatus.STARTED },
    });
    if (activeLog) {
      throw new BadRequestException("У вас уже есть активная сессия по этой работе");
    }

    const pausedLog = await this.logRepo.findOne({
      where: { workId: dto.workId, workerId, status: LogStatus.PAUSED },
      order: [["finishedAt", "DESC"]],
    });
    if (pausedLog) {
      await pausedLog.update({
        status: LogStatus.STARTED,
        startedAt: now,
        finishedAt: undefined,
        hoursSpent: undefined,
      });
      await this.worksService.markStatus(dto.workId, WorkStatus.IN_PROGRESS);
      return pausedLog.reload();
    }

    const log = await this.logRepo.create({
      ...dto,
      workerId,
      startedAt: now,
      status: LogStatus.STARTED,
    } as any);

    await this.worksService.markStatus(dto.workId, WorkStatus.IN_PROGRESS);

    return log;
  }

  async pauseWork(logId: number, authUserId: number): Promise<OrderWorkLog> {
    const workerId = await this.resolveWorkerReferenceId(authUserId);
    const log = await this.logRepo.findByPk(logId);
    if (!log) throw new NotFoundException(`Лог ${logId} не найден`);
    if (Number(log.workerId) !== workerId) {
      throw new BadRequestException("Можно ставить на паузу только свою сессию");
    }
    if (log.status !== LogStatus.STARTED) {
      throw new BadRequestException("Работа не запущена");
    }

    const now = Date.now();
    const hoursSpent = this.calcSessionHours(log.startedAt, now);

    await log.update({
      status: LogStatus.PAUSED,
      finishedAt: now,
      hoursSpent,
    });
    await this.recalcWorkHourTotalFact(log.workId);
    await this.syncWorkStatusFromLogs(log.workId);

    return log.reload();
  }

  async finishWork(
    logId: number,
    userId: number,
    dto: FinishOrderWorkLogDto,
    authUserId?: number,
  ): Promise<OrderWorkLog> {
    const transaction = await this.sequelize.transaction();
    let committed = false;
    try {
      const log = await this.logRepo.findByPk(logId, {
        include: [{ model: OrderWork }],
        transaction,
      });
      if (!log) throw new NotFoundException(`Лог ${logId} не найден`);

      if (authUserId != null) {
        const workerId = await this.resolveWorkerReferenceId(authUserId);
        if (Number(log.workerId) !== workerId) {
          throw new BadRequestException("Можно завершить работу только из своей сессии");
        }
      }

      if (log.status !== LogStatus.STARTED) {
        throw new BadRequestException("Завершить работу можно только из активной сессии");
      }

      const now = Date.now();
      const sessionHours = this.calcSessionHours(log.startedAt, now);
      const priorHours = Number(log.hoursSpent) || 0;
      const hoursSpent = priorHours + sessionHours;

      const work = log.work;
      const countFact =
        dto.countFact != null && dto.countFact > 0
          ? Number(dto.countFact)
          : Number(work?.countInOrder ?? 0);
      if (!countFact || countFact <= 0) {
        throw new BadRequestException(
          "Не указано плановое количество работы (countInOrder)",
        );
      }

      const calculatedSalary =
        work?.salaryRate && work?.hourRate
          ? work.salaryRate * work.hourRate * countFact
          : 0;
      const participantWorkerIds = [Number(log.workerId)];
      if (!participantWorkerIds[0] || !Number.isFinite(participantWorkerIds[0])) {
        throw new BadRequestException("Не найден сотрудник в логе работы");
      }

      await this.closeOtherWorkSessions(log.workId, log.id, now, transaction);

      const sharePercent = 100;
      const countFactShare = countFact;
      const salaryShare = calculatedSalary;

      await log.update(
        {
          status: LogStatus.FINISHED,
          finishedAt: now,
          hoursSpent,
          countFact,
          calculatedSalary,
          notes: dto.notes,
          withoutMaterials: false,
        },
        { transaction },
      );

      await this.logWorkerRepo.destroy({
        where: { logId: log.id },
        transaction,
      });
      for (const wId of participantWorkerIds) {
        await this.logWorkerRepo.create(
          {
            logId: log.id,
            workerId: wId,
            sharePercent,
            countFactShare,
            calculatedSalaryShare: salaryShare,
          } as any,
          { transaction },
        );
      }

      await this.worksService.addCountFact(log.workId, countFact, transaction);
      await this.recalcWorkHourTotalFact(log.workId, transaction);
      await this.worksService.markStatus(log.workId, WorkStatus.DONE, transaction);

      if (dto.materials && dto.materials.length > 0) {
        for (const mat of dto.materials) {
          await this.logMaterialRepo.create(
            {
              logId: log.id,
              materialId: mat.materialId,
              consumedQty: mat.consumedQty,
              consumedTotal: mat.consumedTotal,
              writeOffStatus: "NOT_CREATED",
            } as any,
            { transaction },
          );
        }
      }

      await transaction.commit();
      committed = true;

      try {
        await this.pipelineService.checkAndAdvanceProductionQueue(
          log.orderId,
          userId,
        );
      } catch (queueErr: any) {
        this.logger.error(
          `Queue advance failed after finish logId=${logId}, orderId=${log.orderId}: ${queueErr?.message || queueErr}`,
        );
      }

      return log.reload();
    } catch (err) {
      if (!committed) {
        await transaction.rollback();
      }
      throw err;
    }
  }

  private async resolveWriteoffDocumentType(
    materialId: number,
  ): Promise<DocumentType> {
    const ref = await this.referencesService.getReferenceById(materialId);
    const typeTMZ = ref?.refValues?.typeTMZ as TypeTMZ | undefined;
    if (typeTMZ === TypeTMZ.HALFSTUFF) return DocumentType.LeaveHalfstuff;
    if (typeTMZ === TypeTMZ.PRODUCT) return DocumentType.LeaveProd;
    return DocumentType.LeaveOnlyOneMaterial;
  }

  private async resolveWriteoffSenderId(
    typeTMZ: TypeTMZ | undefined,
    enterpriseId: number,
  ): Promise<number> {
    if (typeTMZ === TypeTMZ.HALFSTUFF) {
      const commonStorage =
        await this.referencesService.findCommonStorageByEnterpriseId(
          enterpriseId,
        );
      if (!commonStorage) {
        throw new BadRequestException(
          "Не найден склад материалов (COMMON) в справочнике",
        );
      }
      return Number(commonStorage.id);
    }
    if (typeTMZ === TypeTMZ.PRODUCT) {
      const productStorage =
        await this.referencesService.findProductStorageByEnterpriseId(
          enterpriseId,
        );
      if (!productStorage) {
        throw new BadRequestException(
          "Не найден склад готовой продукции / полуфабриката",
        );
      }
      return Number(productStorage.id);
    }
    const commonStorage =
      await this.referencesService.findCommonStorageByEnterpriseId(enterpriseId);
    if (!commonStorage) {
      throw new BadRequestException(
        "Не найден склад материалов (COMMON) в справочнике",
      );
    }
    return Number(commonStorage.id);
  }

  private async getWorkWriteoffDocs(
    workId: number,
    orderId: number,
    provedOnly: boolean,
    transaction?: any,
  ): Promise<Document[]> {
    return this.documentRepo.findAll({
      where: {
        documentType: {
          [Op.in]: OrderWorkLogsService.WORK_WRITEOFF_DOC_TYPES,
        },
        docStatus: provedOnly
          ? DocSTATUS.PROVEDEN
          : { [Op.ne]: DocSTATUS.DELETED },
      },
      include: [
        {
          model: DocValues,
          required: true,
          where: { workId, orderId },
        },
        {
          model: User,
          required: false,
          attributes: ["id", "name"],
        },
      ],
      order: [["id", "DESC"]],
      transaction,
    });
  }

  private async hasProvedWriteoffDocForWork(
    workId: number,
    orderId: number,
    transaction?: any,
  ): Promise<boolean> {
    const docs = await this.getWorkWriteoffDocs(
      workId,
      orderId,
      true,
      transaction,
    );
    return docs.length > 0;
  }

  private async getWorkLeaveMaterialJournalDocs(
    workId: number,
    orderId: number,
    transaction?: any,
  ): Promise<Document[]> {
    return this.getWorkWriteoffDocs(workId, orderId, false, transaction);
  }

  async getLeaveMaterialJournalByWork(workId: number) {
    const work = await this.worksService.findOne(workId);
    const orderId = Number(work.orderId);
    const workIdNum = Number(work.id);
    const docs = await this.getWorkLeaveMaterialJournalDocs(workIdNum, orderId);
    const provedDocs = await this.getWorkWriteoffDocs(workIdNum, orderId, true);
    return {
      workId: workIdNum,
      orderId,
      hasWriteOff: provedDocs.length > 0,
      documents: docs.map((doc) => ({
        id: Number(doc.id),
        documentType: doc.documentType,
        docStatus: doc.docStatus,
        date: Number(doc.date),
        userId: Number(doc.userId || 0),
        total: Number((doc as any)?.docValues?.total || 0),
        docValues: {
          productForChargeId: Number(
            (doc as any)?.docValues?.productForChargeId || 0,
          ),
          count: Number((doc as any)?.docValues?.count || 0),
        },
        createdBy: (doc as any)?.user?.name || null,
      })),
    };
  }

  async createLeaveMaterialDocForWork(
    workId: number,
    dto: CreateWorkLeaveMaterialDocDto,
  ) {
    const transaction = await this.sequelize.transaction();
    try {
      const work = await this.worksService.findOne(workId);
      const user = await this.usersService.getUserById(dto.userId);
      if (!user)
        throw new NotFoundException(`Пользователь ${dto.userId} не найден`);

      const orderMaterials = await this.materialsService.findByOrder(
        Number(work.orderId),
      );
      const orderMaterialMap = new Map<number, OrderMaterial>(
        orderMaterials.map((m) => [Number(m.materialId), m]),
      );
      const materialId = Number(dto.materialId);
      if (!orderMaterialMap.has(materialId)) {
        throw new BadRequestException(
          `Материал ${materialId} отсутствует в материалах заказа`,
        );
      }

      const count = Number(dto.count || 0);
      const remainCount = Number(dto.remainCount || 0);
      const price = Number(dto.price || 0);
      const total = Number(dto.total || 0);
      if (count <= 0)
        throw new BadRequestException("Количество должно быть больше нуля");
      if (remainCount < 0)
        throw new BadRequestException("Некорректный остаток материала");
      if (count > remainCount) {
        throw new BadRequestException(
          "Количество списания не может превышать остаток",
        );
      }

      const enterpriseId = user.enterpriseId;
      if (enterpriseId == null || enterpriseId === undefined) {
        throw new BadRequestException(
          "У пользователя не указана организация для списания материалов",
        );
      }

      const materialRef =
        await this.referencesService.getReferenceById(materialId);
      const typeTMZ = materialRef?.refValues?.typeTMZ as TypeTMZ | undefined;
      const documentType = await this.resolveWriteoffDocumentType(materialId);
      const senderId = await this.resolveWriteoffSenderId(
        typeTMZ,
        Number(enterpriseId),
      );

      const order = await this.orderRepo.findByPk(Number(work.orderId));
      const orderAnaliticId = order?.analiticId
        ? Number(order.analiticId)
        : Number(work.orderId);

      let docValues: Record<string, unknown>;
      let docTableItems: Record<string, unknown>[] = [];

      if (documentType === DocumentType.LeaveHalfstuff) {
        const chargeId = await resolveHalfstuffWriteoffChargeId(
          this.settingsService,
          enterpriseId,
        );
        docValues = {
          senderId,
          receiverId: chargeId,
          analiticId: materialId,
          productForChargeId: orderAnaliticId,
          count,
          price,
          total,
          comment: `Списание полуфабриката по работе #${workId}`,
          orderId: Number(work.orderId),
          workId: Number(work.id),
        };
      } else if (documentType === DocumentType.LeaveProd) {
        docValues = {
          senderId,
          receiverId: orderAnaliticId,
          analiticId: materialId,
          productForChargeId: orderAnaliticId,
          count,
          price,
          total,
          comment: `Списание готовой продукции по работе #${workId}`,
          orderId: Number(work.orderId),
          workId: Number(work.id),
        };
        docTableItems = [
          {
            analiticId: materialId,
            count,
            price,
            total,
            tableType: "income",
            balance: remainCount,
          },
        ];
      } else {
        const chargeId = await resolveMaterialWriteoffChargeId(
          this.settingsService,
          enterpriseId,
        );
        docValues = {
          senderId,
          receiverId: senderId,
          analiticId: chargeId,
          productForChargeId: materialId,
          count,
          price,
          total,
          remainCount,
          comment: `Auto from order work #${workId}`,
          materialResponsiblePersonId: null,
          orderId: Number(work.orderId),
          workId: Number(work.id),
        };
      }

      const createdDoc = await this.documentsService.createDocument(
        {
          date: Date.now() as any,
          userId: dto.userId,
          userOldId: "",
          enterpriseId: user.enterpriseId || undefined,
          documentType,
          docStatus: DocSTATUS.OPEN,
          docValues: docValues as any,
          docTableItems,
        } as any,
        this.usersService,
        this.referencesService,
      );

      await transaction.commit();
      return {
        documentId: Number(createdDoc.id),
        docStatus: createdDoc.docStatus,
        documentType: createdDoc.documentType,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async proveLeaveMaterialDocForWork(workId: number) {
    const work = await this.worksService.findOne(workId);
    const docs = await this.getWorkWriteoffDocs(
      Number(work.id),
      Number(work.orderId),
      true,
    );
    const doc = docs[0] ?? null;
    if (!doc) {
      throw new NotFoundException(
        `Для работы #${workId} не найден документ списания`,
      );
    }
    if (doc.docStatus === DocSTATUS.PROVEDEN) {
      return {
        documentId: Number(doc.id),
        docStatus: doc.docStatus,
        alreadyProved: true,
      };
    }
    const provedDoc = await this.documentsService.setProvodka(Number(doc.id));
    return {
      documentId: Number(provedDoc.id),
      docStatus: provedDoc.docStatus,
      alreadyProved: false,
    };
  }

  async findByWork(workId: number): Promise<OrderWorkLog[]> {
    return this.logRepo.findAll({
      where: { workId },
      include: [
        { model: Reference, as: "worker" },
        {
          model: OrderWorkLogWorker,
          include: [{ model: Reference, as: "worker" }],
        },
        {
          model: OrderWorkLogMaterial,
          include: [{ model: Reference, as: "material" }],
        },
      ],
      order: [["date", "DESC"]],
    });
  }

  async findByOrder(orderId: number): Promise<OrderWorkLog[]> {
    return this.logRepo.findAll({
      where: { orderId },
      include: [
        { model: Reference, as: "worker" },
        {
          model: OrderWorkLogWorker,
          include: [{ model: Reference, as: "worker" }],
        },
        { model: OrderWork },
        {
          model: OrderWorkLogMaterial,
          include: [{ model: Reference, as: "material" }],
        },
      ],
      order: [["date", "DESC"]],
    });
  }

  async getTimeReport(
    enterpriseId: number,
    dateFrom: number,
    dateTo: number,
  ) {
    const parsedEnterpriseId = Number(enterpriseId);
    const parsedFrom = Number(dateFrom);
    const parsedTo = Number(dateTo);
    if (
      !Number.isFinite(parsedEnterpriseId) ||
      !Number.isFinite(parsedFrom) ||
      !Number.isFinite(parsedTo)
    ) {
      throw new BadRequestException("Некорректные параметры отчёта");
    }

    const logs = await this.logRepo.findAll({
      where: {
        status: { [Op.in]: [LogStatus.PAUSED, LogStatus.FINISHED] },
        finishedAt: { [Op.between]: [parsedFrom, parsedTo] },
      },
      include: [
        { model: Reference, as: "worker", attributes: ["id", "name"] },
        {
          model: OrderWork,
          required: true,
          include: [
            {
              model: FurnitureOrder,
              as: "order",
              required: true,
              where: { enterpriseId: parsedEnterpriseId },
              attributes: ["id", "orderNumber"],
              include: [
                { model: Reference, as: "client", attributes: ["id", "name"] },
                { model: Reference, as: "analitic", attributes: ["id", "name"] },
              ],
            },
            {
              model: Reference,
              as: "assignedDept",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["finishedAt", "ASC"]],
    });

    type SessionRow = {
      logId: number;
      startedAt?: number;
      finishedAt?: number;
      hoursSpent: number;
      status: LogStatus;
    };

    type WorkerRow = {
      workerId: number;
      workerName: string;
      totalHours: number;
      sessions: SessionRow[];
    };

    type WorkRow = {
      workId: number;
      workName: string;
      workArticle?: string;
      assignedDeptName?: string;
      totalLaborHours: number;
      workers: WorkerRow[];
    };

    type OrderRow = {
      orderId: number;
      orderNumber: string;
      clientName?: string;
      productName?: string;
      totalLaborHours: number;
      works: WorkRow[];
    };

    const ordersMap = new Map<number, OrderRow>();

    for (const log of logs) {
      const hours = Number(log.hoursSpent || 0);
      if (hours <= 0) continue;

      const work = log.work as any;
      const order = work?.order as any;
      if (!work || !order) continue;

      const orderId = Number(order.id);
      let orderRow = ordersMap.get(orderId);
      if (!orderRow) {
        orderRow = {
          orderId,
          orderNumber: String(order.orderNumber ?? orderId),
          clientName: order.client?.name,
          productName: order.analitic?.name,
          totalLaborHours: 0,
          works: [],
        };
        ordersMap.set(orderId, orderRow);
      }

      const workId = Number(work.id);
      let workRow = orderRow.works.find((w) => w.workId === workId);
      if (!workRow) {
        workRow = {
          workId,
          workName: String(work.workName ?? ""),
          workArticle: work.workArticle,
          assignedDeptName: work.assignedDept?.name,
          totalLaborHours: 0,
          workers: [],
        };
        orderRow.works.push(workRow);
      }

      const workerId = Number(log.workerId);
      let workerRow = workRow.workers.find((w) => w.workerId === workerId);
      if (!workerRow) {
        workerRow = {
          workerId,
          workerName: (log as any).worker?.name ?? `#${workerId}`,
          totalHours: 0,
          sessions: [],
        };
        workRow.workers.push(workerRow);
      }

      workerRow.sessions.push({
        logId: Number(log.id),
        startedAt: log.startedAt,
        finishedAt: log.finishedAt,
        hoursSpent: hours,
        status: log.status,
      });
      workerRow.totalHours += hours;
      workRow.totalLaborHours += hours;
      orderRow.totalLaborHours += hours;
    }

    const orders = Array.from(ordersMap.values()).sort((a, b) =>
      a.orderNumber.localeCompare(b.orderNumber, "ru-RU"),
    );

    const totalLaborHours = orders.reduce(
      (sum, order) => sum + order.totalLaborHours,
      0,
    );

    return {
      dateFrom: parsedFrom,
      dateTo: parsedTo,
      summary: { totalLaborHours },
      orders,
    };
  }

  async getSalaryByPeriod(
    enterpriseId: number,
    dateFrom: number,
    dateTo: number,
  ) {
    const { Op } = await import("sequelize");
    const { FurnitureOrder } = await import(
      "src/furnitureOrders/furnitureOrder.model"
    );

    const logs = await this.logRepo.findAll({
      where: {
        status: LogStatus.FINISHED,
        date: { [Op.between]: [dateFrom, dateTo] },
      },
      include: [
        { model: Reference, as: "worker" },
        {
          model: OrderWorkLogWorker,
          include: [{ model: Reference, as: "worker" }],
        },
        {
          model: OrderWork,
          include: [
            {
              model: FurnitureOrder,
              where: { enterpriseId },
              required: true,
            },
          ],
        },
        { model: OrderWorkLogMaterial },
      ],
      order: [["date", "ASC"]],
    });

    return logs
      .flatMap((log: any) => {
        const logJson = log.toJSON();
        const participants = Array.isArray(logJson.orderWorkLogWorkers)
          ? logJson.orderWorkLogWorkers
          : [];
        if (participants.length === 0) {
          return [
            {
              ...logJson,
              participants: [],
              salaryWorkerId: log.workerId,
              salaryWorker: log.worker ?? null,
              salaryAmount: Number(log.calculatedSalary || 0),
            },
          ];
        }

        return participants.map((participant: any) => ({
          ...logJson,
          participants,
          salaryWorkerId: participant.workerId,
          salaryWorker: participant.worker ?? null,
          salaryAmount: Number(participant.calculatedSalaryShare || 0),
          participant,
        }));
      })
      .sort((a: any, b: any) => {
        if (Number(a.salaryWorkerId || 0) !== Number(b.salaryWorkerId || 0)) {
          return Number(a.salaryWorkerId || 0) - Number(b.salaryWorkerId || 0);
        }
        return Number(a.date || 0) - Number(b.date || 0);
      });
  }

  async getSalaryByWorker(
    workerId: number,
    enterpriseId: number,
    dateFrom: number,
    dateTo: number,
  ) {
    const all = await this.getSalaryByPeriod(enterpriseId, dateFrom, dateTo);
    return all.filter(
      (row: any) => Number(row.salaryWorkerId) === Number(workerId),
    );
  }

  async createLeaveMaterialDoc(logId: number, dto: CreateLeaveMaterialDocDto) {
    const transaction = await this.sequelize.transaction();
    let shouldMarkFailedStatus = false;
    try {
      const log = await this.logRepo.findByPk(logId, { transaction });
      if (!log) throw new NotFoundException(`Лог ${logId} не найден`);
      if (log.status !== LogStatus.FINISHED) {
        throw new BadRequestException(
          "Списание можно создать только после завершения работы",
        );
      }

      const materials = await this.logMaterialRepo.findAll({
        where: { logId },
        transaction,
      });
      if (!materials.length) {
        throw new BadRequestException(
          "Для этого лога нет материалов для списания",
        );
      }

      const existingDocId = materials.find(
        (m) => !!m.leaveMaterialDocId,
      )?.leaveMaterialDocId;
      if (existingDocId) {
        await transaction.commit();
        return {
          alreadyExists: true,
          documentId: Number(existingDocId),
          linkedRows: materials.filter(
            (m) => Number(m.leaveMaterialDocId) === Number(existingDocId),
          ).length,
        };
      }

      const user = await this.usersService.getUserById(dto.userId);
      if (!user)
        throw new NotFoundException(`Пользователь ${dto.userId} не найден`);

      const senderId = dto.senderId ?? user.sectionId;
      const receiverId = dto.receiverId ?? senderId;
      if (!senderId || !receiverId) {
        throw new BadRequestException(
          "Не удалось определить senderId/receiverId для документа списания",
        );
      }

      const merged = new Map<number, { qty: number; total: number }>();
      for (const row of materials) {
        const prev = merged.get(row.materialId) ?? { qty: 0, total: 0 };
        merged.set(row.materialId, {
          qty: prev.qty + Number(row.consumedQty || 0),
          total: prev.total + Number(row.consumedTotal || 0),
        });
      }

      const docTableItems = [...merged.entries()].map(([materialId, val]) => {
        const qty = Number(val.qty || 0);
        const total = Number(val.total || 0);
        const price = qty > 0 ? total / qty : 0;
        return {
          analiticId: materialId,
          balance: 0,
          count: qty,
          price,
          total,
          costPrice: 0,
          costTotal: 0,
          tableType: "expense" as const,
        };
      });

      const total = docTableItems.reduce(
        (sum, i) => sum + Number(i.total || 0),
        0,
      );
      const count = docTableItems.reduce(
        (sum, i) => sum + Number(i.count || 0),
        0,
      );

      shouldMarkFailedStatus = true;
      const createdDoc = await this.documentsService.createDocument(
        {
          date: Date.now() as any,
          userId: dto.userId,
          userOldId: "",
          enterpriseId: user.enterpriseId || undefined,
          documentType: DocumentType.LeaveMaterial,
          docStatus: DocSTATUS.OPEN,
          docValues: {
            senderId,
            receiverId,
            count,
            total,
            comment: `Auto from order work log #${logId}`,
            materialResponsiblePersonId: log.workerId,
          } as any,
          docTableItems: docTableItems as any,
        } as any,
        this.usersService,
        this.referencesService,
      );

      await this.logMaterialRepo.update(
        {
          leaveMaterialDocId: Number(createdDoc.id),
          writeOffStatus: "CREATED",
        },
        { where: { logId }, transaction },
      );

      await transaction.commit();
      return {
        alreadyExists: false,
        documentId: Number(createdDoc.id),
        linkedRows: materials.length,
      };
    } catch (err) {
      await transaction.rollback();
      if (shouldMarkFailedStatus) {
        await this.logMaterialRepo.update(
          { writeOffStatus: "FAILED" },
          { where: { logId } },
        );
      }
      throw err;
    }
  }
}
