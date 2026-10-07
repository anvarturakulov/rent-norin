import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { OrderWork } from "./orderWork.model";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { CreateOrderWorkDto } from "./dto/create-order-work.dto";
import { UpdateOrderWorkDto } from "./dto/update-order-work.dto";
import {
  OrderStageType,
  QueueStatus,
  WorkStatus,
} from "src/interfaces/furniture-order.interface";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { Op } from "sequelize";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocSTATUS, DocumentType } from "src/interfaces/document.interface";

@Injectable()
export class OrderWorksService {
  constructor(
    @InjectModel(OrderWork)
    private readonly workRepo: typeof OrderWork,
    @InjectModel(OrderProductionQueue)
    private readonly queueRepo: typeof OrderProductionQueue,
    @InjectModel(Document)
    private readonly documentRepo: typeof Document,
    @InjectModel(Reference)
    private readonly referenceRepo: typeof Reference,
  ) {}

  private async attachWriteoffStatus(works: OrderWork[]): Promise<OrderWork[]> {
    if (!works.length) return works;
    const workIds = Array.from(
      new Set(
        works
          .map((work) => Number(work.id))
          .filter((id) => Number.isFinite(id)),
      ),
    );
    if (!workIds.length) return works;

    const docs = await this.documentRepo.findAll({
      where: {
        documentType: DocumentType.LeaveOnlyOneMaterial,
        docStatus: { [Op.ne]: DocSTATUS.DELETED },
      },
      include: [
        {
          model: DocValues,
          required: true,
          where: {
            workId: { [Op.in]: workIds },
          },
        },
      ],
      order: [["id", "DESC"]],
    });

    type AggLine = { materialId: number; count: number; total: number };
    const provedByWork = new Map<number, Map<number, AggLine>>();
    const latestDocByWork = new Map<
      number,
      { docStatus: DocSTATUS; orderId: number }
    >();
    const orderIdByWorkId = new Map(
      works.map((w) => [Number(w.id), Number(w.orderId)]),
    );

    for (const doc of docs) {
      const dv = (doc as any)?.docValues;
      const sourceWorkId = Number(dv?.workId);
      const sourceOrderId = Number(dv?.orderId);
      if (!Number.isFinite(sourceWorkId)) continue;

      if (!latestDocByWork.has(sourceWorkId)) {
        latestDocByWork.set(sourceWorkId, {
          docStatus: doc.docStatus,
          orderId: sourceOrderId,
        });
      }

      if (doc.docStatus !== DocSTATUS.PROVEDEN) continue;
      if (sourceOrderId !== orderIdByWorkId.get(sourceWorkId)) continue;

      const materialId = Number(dv?.productForChargeId);
      const count = Number(dv?.count || 0);
      const total = Number(dv?.total || 0);
      if (!Number.isFinite(materialId) || materialId <= 0) continue;
      if (!provedByWork.has(sourceWorkId)) {
        provedByWork.set(sourceWorkId, new Map());
      }
      const byMaterial = provedByWork.get(sourceWorkId)!;
      const prev = byMaterial.get(materialId) ?? {
        materialId,
        count: 0,
        total: 0,
      };
      prev.count += count;
      prev.total += total;
      byMaterial.set(materialId, prev);
    }

    const materialIds = Array.from(
      new Set(
        Array.from(provedByWork.values()).flatMap((m) =>
          Array.from(m.keys()),
        ),
      ),
    ).filter((id) => Number.isFinite(id) && id > 0);

    const materialNameById = new Map<number, { name: string; unit?: string }>();
    if (materialIds.length) {
      const refs = await this.referenceRepo.findAll({
        where: { id: { [Op.in]: materialIds } },
        attributes: ["id", "name"],
        include: [{ model: RefValues, attributes: ["unit"], required: false }],
      });
      for (const ref of refs) {
        materialNameById.set(Number(ref.id), {
          name: ref.name,
          unit: (ref as any)?.refValues?.unit,
        });
      }
    }

    return works.map((work) => {
      const workId = Number(work.id);
      const latest = latestDocByWork.get(workId);
      const isSameOrder =
        latest != null && Number(latest.orderId) === Number(work.orderId);
      const hasProved = isSameOrder && provedByWork.has(workId);

      const aggMap = provedByWork.get(workId);
      const materialWriteoffs = hasProved && aggMap
        ? Array.from(aggMap.values())
            .map((line) => {
              const meta = materialNameById.get(line.materialId);
              return {
                materialId: line.materialId,
                materialName: meta?.name,
                count: line.count,
                total: line.total,
                unit: meta?.unit,
              };
            })
            .sort((a, b) =>
              (a.materialName || "").localeCompare(b.materialName || "", "ru"),
            )
        : [];

      work.setDataValue("hasMaterialWriteoff", hasProved);
      work.setDataValue(
        "writeoffDocStatus",
        isSameOrder ? (latest?.docStatus ?? null) : null,
      );
      work.setDataValue("materialWriteoffs", materialWriteoffs);
      return work;
    });
  }

  async create(dto: CreateOrderWorkDto): Promise<OrderWork> {
    return this.workRepo.create(dto as any);
  }

  /**
   * Выставляет lineIndex по порядку в workIds. Массив должен содержать ровно все id работ этой заявки без дубликатов.
   */
  async setLineOrder(orderId: number, workIds: number[]): Promise<void> {
    const ids: number[] = [];
    for (const raw of workIds) {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new BadRequestException(
          `Недопустимый id в workIds: ${String(raw)}`,
        );
      }
      ids.push(n);
    }

    const sequelize = this.workRepo.sequelize;
    if (!sequelize) {
      throw new InternalServerErrorException(
        "Sequelize не инициализирован для OrderWork",
      );
    }
    await sequelize.transaction(async (transaction) => {
      const rows = await this.workRepo.findAll({
        where: { orderId },
        attributes: ["id"],
        transaction,
      });
      const dbIds = new Set(rows.map((r) => Number(r.id)));

      if (ids.length === 0) {
        if (dbIds.size > 0) {
          throw new BadRequestException(
            "workIds пустой, но у заявки есть работы",
          );
        }
        return;
      }

      if (ids.length !== dbIds.size) {
        throw new BadRequestException(
          "Количество id не совпадает с числом работ заявки",
        );
      }

      const seen = new Set<number>();
      for (const id of ids) {
        if (!dbIds.has(id) || seen.has(id)) {
          throw new BadRequestException(
            "Неверный набор id работ для этой заявки",
          );
        }
        seen.add(id);
      }

      for (let i = 0; i < ids.length; i++) {
        await this.workRepo.update(
          { lineIndex: i },
          { where: { id: ids[i], orderId }, transaction },
        );
      }
    });
  }

  async bulkCreate(works: CreateOrderWorkDto[]): Promise<OrderWork[]> {
    return this.workRepo.bulkCreate(works as any);
  }

  async findByOrder(orderId: number): Promise<OrderWork[]> {
    const works = await this.workRepo.findAll({
      where: { orderId },
      include: [
        { model: Reference, as: "assignedDept" },
        { model: Reference, as: "workRef" },
        { model: OrderWorkLog },
      ],
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
    return this.attachWriteoffStatus(works);
  }

  async findByDeptAndQueue(
    deptId: number,
    queueStatus: string = "ACTIVE",
  ): Promise<OrderWork[]> {
    const parsedDeptId = Number(deptId);
    if (!Number.isFinite(parsedDeptId)) return [];

    const works = await this.workRepo.findAll({
      where: {
        assignedDeptId: parsedDeptId,
        workStatus: { [Op.ne]: WorkStatus.DONE },
      },
      include: [
        {
          model: FurnitureOrder,
          required: true,
          where: { currentStage: OrderStageType.IN_PRODUCTION },
          attributes: ["id", "currentStage"],
        },
        { model: OrderProductionQueue, required: false },
        { model: Reference, as: "assignedDept" },
        { model: Reference, as: "workRef" },
        { model: OrderWorkLog },
      ],
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
    if (works.length === 0) return [];

    const orderIds = Array.from(
      new Set(
        works
          .map((work) => Number(work.orderId))
          .filter((id) => Number.isFinite(id)),
      ),
    );
    const activeQueues = await this.queueRepo.findAll({
      where: {
        orderId: { [Op.in]: orderIds },
        status: queueStatus as QueueStatus,
      },
      attributes: ["orderId", "deptId"],
    });
    const activeDeptIdsByOrder = new Map<number, Set<number>>();
    for (const row of activeQueues) {
      const oid = Number(row.orderId);
      const did = Number(row.deptId);
      if (!Number.isFinite(oid) || !Number.isFinite(did)) continue;
      if (!activeDeptIdsByOrder.has(oid))
        activeDeptIdsByOrder.set(oid, new Set<number>());
      activeDeptIdsByOrder.get(oid)!.add(did);
    }

    const enriched = works.map((work) => {
      const activeDeptIds = activeDeptIdsByOrder.get(Number(work.orderId));
      const canStartByQueue = !!activeDeptIds?.has(parsedDeptId);
      const viewStatus = canStartByQueue ? "READY" : "WAITING_QUEUE";
      work.setDataValue("canStartByQueue", canStartByQueue as any);
      work.setDataValue("queueViewStatus", viewStatus as any);
      return work;
    });
    return this.attachWriteoffStatus(enriched);
  }

  async getProductionBoard(enterpriseId: number) {
    const parsedEnterpriseId = Number(enterpriseId);
    if (!Number.isFinite(parsedEnterpriseId) || parsedEnterpriseId <= 0) {
      return { orders: [] };
    }

    const works = await this.workRepo.findAll({
      where: {
        workStatus: { [Op.ne]: WorkStatus.DONE },
      },
      include: [
        {
          model: FurnitureOrder,
          as: "order",
          required: true,
          where: {
            currentStage: OrderStageType.IN_PRODUCTION,
            enterpriseId: parsedEnterpriseId,
          },
          attributes: [
            "id",
            "orderNumber",
            "orderDate",
            "createdDate",
            "deadlineDate",
            "currentStage",
          ],
          include: [
            { model: Reference, as: "client", attributes: ["id", "name"] },
            { model: Reference, as: "analitic", attributes: ["id", "name"] },
          ],
        },
        { model: Reference, as: "assignedDept", attributes: ["id", "name"] },
        { model: OrderWorkLog },
      ],
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });

    if (!works.length) {
      return { orders: [] };
    }

    const orderIds = Array.from(
      new Set(
        works
          .map((work) => Number(work.orderId))
          .filter((id) => Number.isFinite(id)),
      ),
    );

    const activeQueues = await this.queueRepo.findAll({
      where: {
        orderId: { [Op.in]: orderIds },
        status: QueueStatus.ACTIVE,
      },
      attributes: ["orderId", "deptId"],
    });

    const activeDeptIdsByOrder = new Map<number, number[]>();
    for (const row of activeQueues) {
      const oid = Number(row.orderId);
      const did = Number(row.deptId);
      if (!Number.isFinite(oid) || !Number.isFinite(did)) continue;
      if (!activeDeptIdsByOrder.has(oid)) activeDeptIdsByOrder.set(oid, []);
      const list = activeDeptIdsByOrder.get(oid)!;
      if (!list.includes(did)) list.push(did);
    }

    const enrichedWorks = works.map((work) => {
      const assignedDeptId = Number(work.assignedDeptId);
      const activeDeptIds =
        activeDeptIdsByOrder.get(Number(work.orderId)) ?? [];
      const canStartByQueue =
        Number.isFinite(assignedDeptId) &&
        activeDeptIds.includes(assignedDeptId);
      const viewStatus = canStartByQueue ? "READY" : "WAITING_QUEUE";
      work.setDataValue("canStartByQueue", canStartByQueue as any);
      work.setDataValue("queueViewStatus", viewStatus as any);
      return work;
    });

    const withWriteoff = await this.attachWriteoffStatus(enrichedWorks);

    type BoardOrder = {
      id: number;
      orderNumber: string;
      orderDate?: number;
      createdDate?: number;
      deadlineDate?: number;
      clientName: string;
      productName: string;
      activeDeptIds: number[];
      works: OrderWork[];
    };

    const orderMap = new Map<number, BoardOrder>();

    for (const work of withWriteoff) {
      const order = (work as any).order as FurnitureOrder | undefined;
      if (!order) continue;
      const oid = Number(order.id);
      if (!orderMap.has(oid)) {
        orderMap.set(oid, {
          id: oid,
          orderNumber: order.orderNumber ?? String(oid),
          orderDate: order.orderDate,
          createdDate: order.createdDate,
          deadlineDate: order.deadlineDate,
          clientName: (order as any).client?.name ?? "",
          productName: (order as any).analitic?.name ?? "",
          activeDeptIds: activeDeptIdsByOrder.get(oid) ?? [],
          works: [],
        });
      }
      orderMap.get(oid)!.works.push(work);
    }

    const orders = Array.from(orderMap.values()).sort((a, b) => {
      const aReady = a.works.some((w) => (w as any).canStartByQueue !== false);
      const bReady = b.works.some((w) => (w as any).canStartByQueue !== false);
      if (aReady !== bReady) return aReady ? -1 : 1;
      return b.id - a.id;
    });

    return { orders };
  }

  async findByPk(id: number, transaction?: any): Promise<OrderWork | null> {
    return this.workRepo.findByPk(id, { transaction });
  }

  async findOne(id: number): Promise<OrderWork> {
    const work = await this.workRepo.findByPk(id, {
      include: [
        { model: Reference, as: "assignedDept" },
        { model: Reference, as: "workRef" },
        { model: OrderWorkLog, include: [{ model: Reference, as: "worker" }] },
      ],
    });
    if (!work) throw new NotFoundException(`Работа ${id} не найдена`);
    const [enriched] = await this.attachWriteoffStatus([work]);
    return enriched;
  }

  async update(id: number, dto: UpdateOrderWorkDto): Promise<OrderWork> {
    const work = await this.workRepo.findByPk(id);
    if (!work) throw new NotFoundException(`Работа ${id} не найдена`);
    await work.update(dto as any);
    return work.reload();
  }

  async addCountFact(id: number, count: number, transaction?: any): Promise<void> {
    const work = await this.workRepo.findByPk(id, { transaction });
    if (!work) return;
    await work.update(
      { countTotalFact: (work.countTotalFact || 0) + count },
      { transaction },
    );
  }

  async addHourFact(id: number, hours: number): Promise<void> {
    const work = await this.workRepo.findByPk(id);
    if (!work) return;
    await work.update({ hourTotalFact: (work.hourTotalFact || 0) + hours });
  }

  async setHourFact(
    id: number,
    hours: number,
    transaction?: any,
  ): Promise<void> {
    await this.workRepo.update(
      { hourTotalFact: hours },
      { where: { id }, transaction },
    );
  }

  async markStatus(
    id: number,
    status: WorkStatus,
    transaction?: any,
  ): Promise<void> {
    await this.workRepo.update(
      { workStatus: status },
      { where: { id }, transaction },
    );
  }

  async remove(id: number): Promise<void> {
    const work = await this.workRepo.findByPk(id);
    if (!work) throw new NotFoundException(`Работа ${id} не найдена`);
    await work.destroy();
  }
}
