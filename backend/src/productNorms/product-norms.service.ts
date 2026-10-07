import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Transaction } from "sequelize";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { TypeReference, TypeTMZ } from "src/interfaces/reference.interface";
import { ProductWorkNorm } from "./productWorkNorm.model";
import { ProductMaterialNorm } from "./productMaterialNorm.model";
import { ProductHalfstuffNorm } from "./productHalfstuffNorm.model";
import { ProductProductionRoute } from "./productProductionRoute.model";
import { ProductComponent } from "./productComponent.model";
import { ProductCommonWorkNorm } from "./productCommonWorkNorm.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { OrderHalfstuff } from "src/orderHalfstuffs/orderHalfstuff.model";
import { OrderCommonWork } from "src/orderCommonWorks/orderCommonWork.model";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import {
  QueueStatus,
  WorkStatus,
} from "src/interfaces/furniture-order.interface";
import { ReplaceProductNormsDto } from "./dto/replace-product-norms.dto";
import { ReportsService } from "src/reports/reports.service";

export type ResolvedWorkRow = {
  workName: string;
  workArticle?: string;
  unit?: string;
  countInUnit?: number;
  countInOrder?: number;
  timeInUnit?: number;
  timeInOrder?: number;
  salaryInUnit?: number;
  salaryInOrder?: number;
  assignedDeptId?: number;
  workRefId?: number;
  salaryRate?: number;
  hourRate?: number;
  sourceNormId?: number;
};

export type ResolvedCommonWorkRow = {
  commonWorkRefId?: number;
  workName: string;
  unit?: string;
  quantity?: number;
  price?: number;
  amount?: number;
  selected?: boolean;
  sourceNormId?: number;
};

export type ResolvedMaterialRow = {
  materialId: number;
  price?: number;
  countPlanned?: number;
  total?: number;
  sourceNormId?: number;
};

export type ResolvedHalfstuffRow = {
  halfstuffId: number;
  price?: number;
  countPlanned?: number;
  total?: number;
  sourceNormId?: number;
};

export type ResolvedRouteRow = {
  sequence: number;
  deptId: number;
  sourceRouteId?: number;
};

@Injectable()
export class ProductNormsService {
  constructor(
    @InjectModel(ProductWorkNorm)
    private readonly workNormRepo: typeof ProductWorkNorm,
    @InjectModel(ProductMaterialNorm)
    private readonly materialNormRepo: typeof ProductMaterialNorm,
    @InjectModel(ProductHalfstuffNorm)
    private readonly halfstuffNormRepo: typeof ProductHalfstuffNorm,
    @InjectModel(ProductProductionRoute)
    private readonly routeRepo: typeof ProductProductionRoute,
    @InjectModel(ProductComponent)
    private readonly componentRepo: typeof ProductComponent,
    @InjectModel(ProductCommonWorkNorm)
    private readonly commonWorkNormRepo: typeof ProductCommonWorkNorm,
    @InjectModel(Reference)
    private readonly referenceRepo: typeof Reference,
    @InjectModel(FurnitureOrder)
    private readonly orderRepo: typeof FurnitureOrder,
    @InjectModel(OrderWork)
    private readonly orderWorkRepo: typeof OrderWork,
    @InjectModel(OrderMaterial)
    private readonly orderMaterialRepo: typeof OrderMaterial,
    @InjectModel(OrderHalfstuff)
    private readonly orderHalfstuffRepo: typeof OrderHalfstuff,
    @InjectModel(OrderCommonWork)
    private readonly orderCommonWorkRepo: typeof OrderCommonWork,
    @InjectModel(OrderProductionQueue)
    private readonly orderQueueRepo: typeof OrderProductionQueue,
    @InjectModel(OrderWorkLog)
    private readonly orderWorkLogRepo: typeof OrderWorkLog,
    @Inject(forwardRef(() => ReportsService))
    private readonly reportsService: ReportsService,
  ) {}

  async getBundle(referenceId: number) {
    await this.ensureLegacyImport(referenceId);
    const [works, commonWorks, materials, halfstuffs, routes, components] =
      await Promise.all([
      this.workNormRepo.findAll({
        where: { referenceId },
        order: [
          ["lineIndex", "ASC"],
          ["id", "ASC"],
        ],
      }),
      this.commonWorkNormRepo.findAll({
        where: { referenceId },
        order: [
          ["lineIndex", "ASC"],
          ["id", "ASC"],
        ],
      }),
      this.materialNormRepo.findAll({
        where: { referenceId },
        order: [
          ["lineIndex", "ASC"],
          ["id", "ASC"],
        ],
        include: [{ model: Reference, as: "material" }],
      }),
      this.halfstuffNormRepo.findAll({
        where: { referenceId },
        order: [
          ["lineIndex", "ASC"],
          ["id", "ASC"],
        ],
        include: [{ model: Reference, as: "halfstuff" }],
      }),
      this.routeRepo.findAll({
        where: { referenceId },
        order: [["sequence", "ASC"]],
      }),
      this.componentRepo.findAll({
        where: { parentReferenceId: referenceId },
        include: [{ model: Reference, as: "component" }],
      }),
    ]);
    return { works, commonWorks, materials, halfstuffs, routes, components };
  }

  private mapCommonWorkNormRows(
    rows: ProductCommonWorkNorm[],
  ): ResolvedCommonWorkRow[] {
    return rows.map((w) => {
      const quantity = Number(w.quantity ?? 0);
      const price = Number(w.price ?? 0);
      const amount =
        w.amount != null && Number.isFinite(Number(w.amount))
          ? Number(w.amount)
          : quantity * price;
      return {
        commonWorkRefId: w.commonWorkRefId
          ? Number(w.commonWorkRefId)
          : undefined,
        workName: w.workName,
        unit: w.unit,
        quantity,
        price,
        amount,
        selected: Boolean(w.selected),
        sourceNormId: Number(w.id),
      };
    });
  }

  private async getCommonWorksForProduct(
    referenceId: number,
  ): Promise<ResolvedCommonWorkRow[]> {
    const rows = await this.commonWorkNormRepo.findAll({
      where: { referenceId },
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
    return this.mapCommonWorkNormRows(rows);
  }

  /** Возвращает конечное число или null (NaN/Infinity/нечисловое => null). */
  private toNumOrNull(value: unknown): number | null {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /** Возвращает положительный целочисленный ID или null. */
  private toIdOrNull(value: unknown): number | null {
    const n = this.toNumOrNull(value);
    if (n == null) return null;
    const i = Math.trunc(n);
    return i > 0 ? i : null;
  }

  async replaceAll(referenceId: number, dto: ReplaceProductNormsDto) {
    await this.assertProductReference(referenceId);
    await this.validateComponents(referenceId, dto.components ?? []);
    await this.validateHalfstuffs(dto.halfstuffs ?? []);

    const sequelize = this.workNormRepo.sequelize!;
    await sequelize.transaction(async (transaction) => {
      await this.workNormRepo.destroy({ where: { referenceId }, transaction });
      await this.commonWorkNormRepo.destroy({
        where: { referenceId },
        transaction,
      });
      await this.materialNormRepo.destroy({
        where: { referenceId },
        transaction,
      });
      await this.halfstuffNormRepo.destroy({
        where: { referenceId },
        transaction,
      });
      await this.routeRepo.destroy({ where: { referenceId }, transaction });
      await this.componentRepo.destroy({
        where: { parentReferenceId: referenceId },
        transaction,
      });

      const works = (dto.works ?? []).map((w, i) => ({
        referenceId,
        lineIndex: this.toNumOrNull(w.lineIndex) ?? i,
        workName: w.workName,
        workArticle: w.workArticle,
        unit: w.unit,
        countInUnit: this.toNumOrNull(w.countInUnit),
        countInOrder: this.toNumOrNull(w.countInOrder),
        timeInUnit: this.toNumOrNull(w.timeInUnit),
        timeInOrder: this.toNumOrNull(w.timeInOrder),
        salaryInUnit: this.toNumOrNull(w.salaryInUnit),
        salaryInOrder: this.toNumOrNull(w.salaryInOrder),
        assignedDeptId: this.toIdOrNull(w.assignedDeptId),
        workRefId: this.toIdOrNull(w.workRefId),
        salaryRate: this.toNumOrNull(w.salaryRate),
        hourRate: this.toNumOrNull(w.hourRate),
      }));
      if (works.length) {
        await this.workNormRepo.bulkCreate(works as any, { transaction });
      }

      const commonWorks = (dto.commonWorks ?? []).map((w, i) => {
        const quantity = this.toNumOrNull(w.quantity) ?? 0;
        const price = this.toNumOrNull(w.price) ?? 0;
        const amount =
          this.toNumOrNull(w.amount) ?? quantity * price;
        return {
          referenceId,
          lineIndex: this.toNumOrNull(w.lineIndex) ?? i,
          commonWorkRefId: this.toIdOrNull(w.commonWorkRefId),
          workName: w.workName,
          unit: w.unit,
          quantity,
          price,
          amount,
          selected: Boolean(w.selected),
        };
      });
      if (commonWorks.length) {
        await this.commonWorkNormRepo.bulkCreate(commonWorks as any, {
          transaction,
        });
      }

      const materials = (dto.materials ?? [])
        .map((m, i) => ({
          referenceId,
          lineIndex: this.toNumOrNull(m.lineIndex) ?? i,
          materialId: this.toIdOrNull(m.materialId),
          price: this.toNumOrNull(m.price),
          countPlanned: this.toNumOrNull(m.countPlanned),
          total: this.toNumOrNull(m.total),
        }))
        .filter((m) => m.materialId != null);
      if (materials.length) {
        await this.materialNormRepo.bulkCreate(materials as any, {
          transaction,
        });
      }

      const halfstuffs = (dto.halfstuffs ?? [])
        .map((h, i) => ({
          referenceId,
          lineIndex: this.toNumOrNull(h.lineIndex) ?? i,
          halfstuffId: this.toIdOrNull(h.halfstuffId),
          price: this.toNumOrNull(h.price),
          countPlanned: this.toNumOrNull(h.countPlanned),
          total: this.toNumOrNull(h.total),
        }))
        .filter((h) => h.halfstuffId != null);
      if (halfstuffs.length) {
        await this.halfstuffNormRepo.bulkCreate(halfstuffs as any, {
          transaction,
        });
      }

      const routes = (dto.routes ?? [])
        .map((r, i) => ({
          referenceId,
          sequence: this.toNumOrNull(r.sequence) ?? i + 1,
          deptId: this.toIdOrNull(r.deptId),
        }))
        .filter((r) => r.deptId != null);
      if (routes.length) {
        await this.routeRepo.bulkCreate(routes as any, { transaction });
      }

      const comps = (dto.components ?? [])
        .map((c) => ({
          parentReferenceId: referenceId,
          componentReferenceId: this.toIdOrNull(c.componentReferenceId),
          qty: this.toNumOrNull(c.qty),
        }))
        .filter((c) => c.componentReferenceId != null);
      if (comps.length) {
        await this.componentRepo.bulkCreate(comps as any, { transaction });
      }
    });

    return this.getBundle(referenceId);
  }

  async resolveProductNorms(
    productReferenceId: number,
    visited: Set<number> = new Set(),
  ): Promise<{
    works: ResolvedWorkRow[];
    materials: ResolvedMaterialRow[];
    halfstuffs: ResolvedHalfstuffRow[];
    routes: ResolvedRouteRow[];
    usesComponents: boolean;
  }> {
    if (visited.has(productReferenceId)) {
      throw new BadRequestException(
        "Цикл в составе готовой продукции (BOM)",
      );
    }
    visited.add(productReferenceId);
    try {
    await this.ensureLegacyImport(productReferenceId);
    const components = await this.componentRepo.findAll({
      where: { parentReferenceId: productReferenceId },
    });

    if (components.length > 0) {
      const merged = await this.mergeFromComponents(
        productReferenceId,
        components,
        visited,
      );
      const parentHalfstuffs = await this.halfstuffNormRepo.findAll({
        where: { referenceId: productReferenceId },
        order: [
          ["lineIndex", "ASC"],
          ["id", "ASC"],
        ],
      });
      return {
        ...merged,
        halfstuffs: this.mapHalfstuffNormRows(parentHalfstuffs),
        usesComponents: true,
      };
    }

    const works = await this.workNormRepo.findAll({
      where: { referenceId: productReferenceId },
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
    const materials = await this.materialNormRepo.findAll({
      where: { referenceId: productReferenceId },
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
    const halfstuffs = await this.halfstuffNormRepo.findAll({
      where: { referenceId: productReferenceId },
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
    const routes = await this.routeRepo.findAll({
      where: { referenceId: productReferenceId },
      order: [["sequence", "ASC"]],
    });

    return {
      works: works.map((w) => ({
        workName: w.workName,
        workArticle: w.workArticle,
        unit: w.unit,
        countInUnit: w.countInUnit,
        countInOrder: w.countInOrder,
        timeInUnit: w.timeInUnit,
        timeInOrder: w.timeInOrder,
        salaryInUnit: w.salaryInUnit,
        salaryInOrder: w.salaryInOrder,
        assignedDeptId: w.assignedDeptId,
        workRefId: w.workRefId,
        salaryRate: w.salaryRate,
        hourRate: w.hourRate,
        sourceNormId: Number(w.id),
      })),
      materials: materials.map((m) => ({
        materialId: Number(m.materialId),
        price: m.price,
        countPlanned: m.countPlanned,
        total: m.total,
        sourceNormId: Number(m.id),
      })),
      halfstuffs: this.mapHalfstuffNormRows(halfstuffs),
      routes: routes.map((r) => ({
        sequence: Number(r.sequence),
        deptId: Number(r.deptId),
        sourceRouteId: Number(r.id),
      })),
      usesComponents: false,
    };
    } finally {
      visited.delete(productReferenceId);
    }
  }

  async getPricing(referenceId: number): Promise<{
    worksSum: number;
    materialsSum: number;
    halfstuffsSum: number;
    subtotal: number;
    firstPrice: number;
    secondPrice: number;
    thirdPrice: number;
    wholesalePrice: number;
    usesComponents: boolean;
  }> {
    await this.assertProductReference(referenceId);
    const resolved = await this.resolveProductNorms(referenceId);
    const commonWorks = await this.getCommonWorksForProduct(referenceId);
    // «Ишлар суммаси» в Нархлаш = выбранные общие работы (не вкладка Ишлар)
    const worksSum = commonWorks.reduce((acc, row) => {
      if (!row.selected) return acc;
      const qty = Number(row.quantity ?? 0);
      const price = Number(row.price ?? 0);
      const amount =
        row.amount != null && Number.isFinite(Number(row.amount))
          ? Number(row.amount)
          : qty * price;
      return acc + amount;
    }, 0);
    const materialsSum = await this.sumResolvedMaterialsCost(
      resolved.materials,
      referenceId,
    );
    const halfstuffsSum = await this.sumResolvedHalfstuffsCost(
      resolved.halfstuffs,
      referenceId,
    );

    const base = worksSum + materialsSum + halfstuffsSum;
    const firstPrice = base;
    const secondPrice = firstPrice;
    const thirdPrice = firstPrice;
    const wholesalePrice = firstPrice;

    return {
      worksSum,
      materialsSum,
      halfstuffsSum,
      subtotal: base,
      firstPrice,
      secondPrice,
      thirdPrice,
      wholesalePrice,
      usesComponents: resolved.usesComponents,
    };
  }

  async applyPricingToCard(
    referenceId: number,
    payload?: { writeToFirstPrice?: boolean },
  ) {
    const calc = await this.getPricing(referenceId);
    const shouldWrite = payload?.writeToFirstPrice !== false;
    if (!shouldWrite) return { updated: false, ...calc };

    const refValues = await RefValues.findOne({ where: { referenceId } });
    if (!refValues) throw new NotFoundException("refValues не найден");
    await refValues.update({ firstPrice: calc.firstPrice });
    return { updated: true, ...calc, firstPrice: refValues.firstPrice };
  }

  async syncNormsToOrder(
    orderId: number,
    transaction?: Transaction,
  ): Promise<void> {
    const run = async (t: Transaction) => {
      const order = await this.orderRepo.findByPk(orderId, {
        transaction: t,
      });
      if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

      const analiticId = order.analiticId;
      if (!analiticId) {
        throw new BadRequestException(
          "У заявки не выбрана готовая продукция (analiticId)",
        );
      }

      const logCount = await this.orderWorkLogRepo.count({
        where: { orderId },
        transaction: t,
      });
      if (logCount > 0) {
        throw new BadRequestException(
          "Синхронизация невозможна: по заявке уже есть журнал работ",
        );
      }

      const resolved = await this.resolveProductNorms(Number(analiticId));
      const mult = Number(order.count) > 0 ? Number(order.count) : 1;

      const routesFinal =
        resolved.routes.length > 0
          ? resolved.routes
          : this.deriveRoutesFromWorks(resolved.works);

      await this.orderWorkRepo.destroy({ where: { orderId }, transaction: t });
      await this.orderCommonWorkRepo.destroy({
        where: { orderId },
        transaction: t,
      });
      await this.orderMaterialRepo.destroy({
        where: { orderId },
        transaction: t,
      });
      await this.orderHalfstuffRepo.destroy({
        where: { orderId },
        transaction: t,
      });
      await this.orderQueueRepo.destroy({ where: { orderId }, transaction: t });

      const queueRows: OrderProductionQueue[] = [];
      for (const r of routesFinal) {
        const row = await this.orderQueueRepo.create(
          {
            orderId,
            deptId: r.deptId,
            sequence: r.sequence,
            status: QueueStatus.PENDING,
            sourceRouteId: r.sourceRouteId,
          } as any,
          { transaction: t },
        );
        queueRows.push(row);
      }

      const queueIdByDept = new Map<number, number>();
      for (const row of queueRows) {
        const d = Number(row.deptId);
        if (!queueIdByDept.has(d)) queueIdByDept.set(d, Number(row.id));
      }

      const workRows = resolved.works.map((w, idx) => {
        const qid = w.assignedDeptId
          ? queueIdByDept.get(Number(w.assignedDeptId))
          : undefined;
        const ciu = (w.countInUnit ?? 0) * mult;
        const tiu = (w.timeInUnit ?? 0) * mult;
        const siu = (w.salaryInUnit ?? 0) * mult;
        const finishedProductQty = mult;
        const workRefRaw =
          w.workRefId != null ? Number(w.workRefId) : Number.NaN;
        const workRefId =
          Number.isFinite(workRefRaw) && workRefRaw > 0
            ? workRefRaw
            : undefined;
        return {
          orderId,
          lineIndex: idx,
          workName: w.workName,
          workArticle: w.workArticle,
          unit: w.unit,
          countInUnit: w.countInUnit,
          finishedProductQty,
          countInOrder: ciu,
          timeInUnit: w.timeInUnit,
          timeInOrder: tiu,
          salaryInUnit: w.salaryInUnit,
          salaryInOrder: siu,
          assignedDeptId: w.assignedDeptId,
          productionQueueId: qid,
          salaryRate: w.salaryRate,
          hourRate: w.hourRate,
          workStatus: WorkStatus.OPEN,
          sourceNormId: w.sourceNormId,
          workRefId,
        };
      });
      if (workRows.length) {
        await this.orderWorkRepo.bulkCreate(workRows as any, {
          transaction: t,
        });
      }

      const commonWorks = await this.getCommonWorksForProduct(
        Number(analiticId),
      );
      const commonWorkRows = commonWorks.map((w, idx) => {
        const quantity = Number(w.quantity ?? 0);
        const price = Number(w.price ?? 0);
        const amount =
          w.amount != null && Number.isFinite(Number(w.amount))
            ? Number(w.amount)
            : quantity * price;
        return {
          orderId,
          lineIndex: idx,
          commonWorkRefId: w.commonWorkRefId,
          workName: w.workName,
          unit: w.unit,
          quantity,
          price,
          amount,
          quantityInOrder: quantity * mult,
          amountInOrder: amount * mult,
          selected: Boolean(w.selected),
          sourceNormId: w.sourceNormId,
        };
      });
      if (commonWorkRows.length) {
        await this.orderCommonWorkRepo.bulkCreate(commonWorkRows as any, {
          transaction: t,
        });
      }

      const matRows = resolved.materials.map((m, idx) => {
        const planned = m.countPlanned ?? 0;
        const price = m.price ?? 0;
        const finishedProductQty = mult;
        const countInOrder = planned * finishedProductQty;
        return {
          orderId,
          materialId: m.materialId,
          price,
          countPlanned: planned,
          finishedProductQty,
          countInOrder,
          total: countInOrder * price,
          sourceNormId: m.sourceNormId,
        };
      });
      if (matRows.length) {
        await this.orderMaterialRepo.bulkCreate(matRows as any, {
          transaction: t,
        });
      }

      const halfstuffRows = resolved.halfstuffs.map((h, idx) => {
        const planned = h.countPlanned ?? 0;
        const price = h.price ?? 0;
        const finishedProductQty = mult;
        const countInOrder = planned * finishedProductQty;
        return {
          orderId,
          halfstuffId: h.halfstuffId,
          price,
          countPlanned: planned,
          finishedProductQty,
          countInOrder,
          total: countInOrder * price,
          sourceNormId: h.sourceNormId,
        };
      });
      if (halfstuffRows.length) {
        await this.orderHalfstuffRepo.bulkCreate(halfstuffRows as any, {
          transaction: t,
        });
      }

      const productRefValues = await RefValues.findOne({
        where: { referenceId: Number(analiticId) },
        transaction: t,
      });
      const filesFromScaling = this.serializeOrderFileListFromRefValues(
        productRefValues?.filesFromScaling,
      );
      const filesFromDrawing = this.serializeOrderFileListFromRefValues(
        productRefValues?.filesFromDrawing,
      );
      const tmzPricing =
        productRefValues?.tmzPricing &&
        typeof productRefValues.tmzPricing === "object"
          ? (productRefValues.tmzPricing as Record<string, unknown>)
          : null;
      const disabledCodesRaw = tmzPricing?.disabledBeforeCostMarkupCodes;
      const disabledBeforeCostMarkupCodes = Array.isArray(disabledCodesRaw)
        ? disabledCodesRaw.filter((c): c is string => typeof c === "string")
        : null;
      const disabledCodesWorksRaw =
        tmzPricing?.disabledBeforeCostMarkupCodesWorks;
      const disabledBeforeCostMarkupCodesWorks = Array.isArray(
        disabledCodesWorksRaw,
      )
        ? disabledCodesWorksRaw.filter(
            (c): c is string => typeof c === "string",
          )
        : null;
      await order.update(
        {
          filesFromScaling,
          filesFromDrawing,
          disabledBeforeCostMarkupCodes,
          disabledBeforeCostMarkupCodesWorks,
        } as any,
        { transaction: t },
      );
    };

    if (transaction) {
      await run(transaction);
    } else {
      const sequelize = this.orderRepo.sequelize!;
      await sequelize.transaction(async (t) => run(t));
    }
  }

  /**
   * Копирует список файлов из JSONB ТМЗ в TEXT заявки: только JSON (URL/метаданные), без копирования файлов на диск.
   */
  private serializeOrderFileListFromRefValues(raw: unknown): string | null {
    if (raw == null) return null;
    let arr: unknown[] = [];
    if (Array.isArray(raw)) {
      arr = raw;
    } else if (typeof raw === "string") {
      try {
        const p = JSON.parse(raw);
        arr = Array.isArray(p) ? p : [];
      } catch {
        return null;
      }
    } else {
      return null;
    }
    if (arr.length === 0) return null;
    try {
      return JSON.stringify(JSON.parse(JSON.stringify(arr)));
    } catch {
      return null;
    }
  }

  private async sumResolvedMaterialsCost(
    materials: ResolvedMaterialRow[],
    parentReferenceId: number,
  ): Promise<number> {
    const parentRef = await this.referenceRepo.findByPk(parentReferenceId, {
      include: [{ model: RefValues, required: false }],
    });
    const enterpriseId =
      parentRef?.enterpriseId != null ? Number(parentRef.enterpriseId) : null;

    let sum = 0;
    for (const row of materials) {
      const qty = Number(row.countPlanned ?? 0);
      if (qty <= 0) continue;
      let price = Number(row.price ?? 0);
      if (price <= 0) {
        const matRef = await this.referenceRepo.findByPk(row.materialId, {
          include: [{ model: RefValues, required: false }],
        });
        const typeTMZ = matRef?.refValues?.typeTMZ as TypeTMZ | undefined;
        if (typeTMZ) {
          const avg = await this.reportsService.getTmzAveragePrice(
            row.materialId,
            typeTMZ,
            enterpriseId,
          );
          price = avg.price;
        }
      }
      sum += qty * price;
    }
    return sum;
  }

  private async sumResolvedHalfstuffsCost(
    halfstuffs: ResolvedHalfstuffRow[],
    parentReferenceId: number,
  ): Promise<number> {
    const parentRef = await this.referenceRepo.findByPk(parentReferenceId, {
      include: [{ model: RefValues, required: false }],
    });
    const enterpriseId =
      parentRef?.enterpriseId != null ? Number(parentRef.enterpriseId) : null;

    let sum = 0;
    for (const row of halfstuffs) {
      const qty = Number(row.countPlanned ?? 0);
      if (qty <= 0) continue;
      let price = Number(row.price ?? 0);
      if (price <= 0) {
        const avg = await this.reportsService.getTmzAveragePrice(
          row.halfstuffId,
          TypeTMZ.HALFSTUFF,
          enterpriseId,
        );
        price = avg.price;
      }
      sum += qty * price;
    }
    return sum;
  }

  private mapHalfstuffNormRows(
    halfstuffs: ProductHalfstuffNorm[],
  ): ResolvedHalfstuffRow[] {
    return halfstuffs.map((h) => ({
      halfstuffId: Number(h.halfstuffId),
      price: h.price,
      countPlanned: h.countPlanned,
      total: h.total,
      sourceNormId: Number(h.id),
    }));
  }

  private async validateHalfstuffs(
    halfstuffs: Array<{ halfstuffId: number }>,
  ): Promise<void> {
    for (const h of halfstuffs) {
      const hid = this.toIdOrNull(h.halfstuffId);
      if (hid == null) continue;
      const ref = await this.referenceRepo.findByPk(hid, {
        include: [{ model: RefValues }],
      });
      if (!ref) {
        throw new BadRequestException(`Полуфабрикат ${hid} не найден`);
      }
      if (ref.typeReference !== TypeReference.TMZ) {
        throw new BadRequestException("Ожидается ТМЗ");
      }
      if (ref.refValues?.typeTMZ !== TypeTMZ.HALFSTUFF) {
        throw new BadRequestException(
          "В нормах полуфабрикатов можно указывать только HALFSTUFF",
        );
      }
    }
  }

  private mapWorkNormRows(
    works: ProductWorkNorm[],
  ): ResolvedWorkRow[] {
    return works.map((w) => ({
      workName: w.workName,
      workArticle: w.workArticle,
      unit: w.unit,
      countInUnit: w.countInUnit,
      countInOrder: w.countInOrder,
      timeInUnit: w.timeInUnit,
      timeInOrder: w.timeInOrder,
      salaryInUnit: w.salaryInUnit,
      salaryInOrder: w.salaryInOrder,
      assignedDeptId: w.assignedDeptId,
      workRefId: w.workRefId,
      salaryRate: w.salaryRate,
      hourRate: w.hourRate,
      sourceNormId: Number(w.id),
    }));
  }

  private mapMaterialNormRows(
    materials: ProductMaterialNorm[],
  ): ResolvedMaterialRow[] {
    return materials.map((m) => ({
      materialId: Number(m.materialId),
      price: m.price,
      countPlanned: m.countPlanned,
      total: m.total,
      sourceNormId: Number(m.id),
    }));
  }

  private async loadParentNormRows(productReferenceId: number): Promise<{
    works: ResolvedWorkRow[];
    materials: ResolvedMaterialRow[];
    routes: ResolvedRouteRow[];
  }> {
    const works = await this.workNormRepo.findAll({
      where: { referenceId: productReferenceId },
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
    const materials = await this.materialNormRepo.findAll({
      where: { referenceId: productReferenceId },
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
    const routes = await this.routeRepo.findAll({
      where: { referenceId: productReferenceId },
      order: [["sequence", "ASC"]],
    });

    const worksMapped = this.mapWorkNormRows(works);
    const routesMapped =
      routes.length > 0
        ? routes.map((r) => ({
            sequence: Number(r.sequence),
            deptId: Number(r.deptId),
            sourceRouteId: Number(r.id),
          }))
        : this.deriveRoutesFromWorks(worksMapped);

    return {
      works: worksMapped,
      materials: this.mapMaterialNormRows(materials),
      routes: routesMapped,
    };
  }

  private deriveRoutesFromWorks(works: ResolvedWorkRow[]): ResolvedRouteRow[] {
    const seen = new Set<number>();
    const out: ResolvedRouteRow[] = [];
    let seq = 1;
    for (const w of works) {
      const d = w.assignedDeptId;
      if (d == null || !Number.isFinite(Number(d))) continue;
      const id = Number(d);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ sequence: seq++, deptId: id });
    }
    return out;
  }

  private async mergeFromComponents(
    productReferenceId: number,
    components: ProductComponent[],
    _visited: Set<number>,
  ): Promise<{
    works: ResolvedWorkRow[];
    materials: ResolvedMaterialRow[];
    routes: ResolvedRouteRow[];
  }> {
    const parent = await this.loadParentNormRows(productReferenceId);
    const matMap = new Map<number, ResolvedMaterialRow>();

    for (const m of parent.materials) {
      matMap.set(m.materialId, { ...m });
    }

    for (const c of components) {
      const qty = Number(c.qty);
      if (!qty || qty <= 0) continue;
      const childId = Number(c.componentReferenceId);
      const prev = matMap.get(childId) ?? {
        materialId: childId,
        price: undefined,
        countPlanned: 0,
        total: undefined,
        sourceNormId: Number(c.id),
      };
      prev.countPlanned = (prev.countPlanned ?? 0) + qty;
      matMap.set(childId, prev);
    }

    return {
      works: parent.works,
      materials: Array.from(matMap.values()),
      routes: parent.routes,
    };
  }

  private async validateComponents(
    referenceId: number,
    components: Array<{ componentReferenceId: number; qty: number }>,
  ): Promise<void> {
    for (const c of components) {
      const cid = this.toIdOrNull(c.componentReferenceId);
      if (cid == null) continue;
      if (cid === referenceId) {
        throw new BadRequestException("Нельзя добавить изделие само в себя");
      }
      const ref = await this.referenceRepo.findByPk(cid, {
        include: [{ model: RefValues }],
      });
      if (!ref) throw new BadRequestException(`Компонент ${cid} не найден`);
      if (ref.typeReference !== TypeReference.TMZ) {
        throw new BadRequestException("Компонент должен быть ТМЗ");
      }
      const tv = ref.refValues?.typeTMZ;
      if (tv !== TypeTMZ.PRODUCT && tv !== TypeTMZ.HALFSTUFF) {
        throw new BadRequestException(
          "В составе можно указывать только готовую продукцию или полуфабрикат (PRODUCT / HALFSTUFF)",
        );
      }
    }
  }

  private async assertProductReference(referenceId: number): Promise<void> {
    const ref = await this.referenceRepo.findByPk(referenceId, {
      include: [{ model: RefValues, required: false }],
    });
    if (!ref) throw new NotFoundException(`Справочник ${referenceId} не найден`);
    if (ref.typeReference !== TypeReference.TMZ)
      throw new BadRequestException("Ожидается ТМЗ");
    if (ref.refValues?.typeTMZ !== TypeTMZ.PRODUCT)
      throw new BadRequestException("Ожидается готовая продукция");
  }

  async ensureLegacyImport(referenceId: number): Promise<void> {
    const cnt = await this.workNormRepo.count({
      where: { referenceId },
    });
    const mc = await this.materialNormRepo.count({ where: { referenceId } });
    const cc = await this.componentRepo.count({
      where: { parentReferenceId: referenceId },
    });
    if (cnt > 0 || mc > 0 || cc > 0) return;

    const ref = await this.referenceRepo.findByPk(referenceId, {
      include: [{ model: RefValues }],
    });
    if (!ref?.refValues) return;
    const rv = ref.refValues as any;
    const dto: ReplaceProductNormsDto = {
      works: Array.isArray(rv.tmzWorks)
        ? rv.tmzWorks.map((w: any, i: number) => ({
            lineIndex: i,
            workName: String(w.workName ?? ""),
            workArticle: w.workArticle,
            unit: w.unit,
            countInUnit: w.countInUnit,
            timeInUnit: w.timeInUnit,
            salaryInUnit: w.salaryInUnit,
            assignedDeptId: w.assignedDeptId,
            salaryRate: w.salaryRate,
            hourRate: w.hourRate,
          }))
        : [],
      materials: Array.isArray(rv.tmzMaterials)
        ? rv.tmzMaterials
            .map((m: any, i: number) => ({
              lineIndex: i,
              materialId: this.toIdOrNull(m.materialId),
              price: this.toNumOrNull(m.price),
              countPlanned: this.toNumOrNull(m.countPlanned),
              total: this.toNumOrNull(m.total),
            }))
            .filter((m: any) => m.materialId != null)
        : [],
      routes: Array.isArray(rv.tmzTechMap)
        ? rv.tmzTechMap
            .map((r: any) => ({
              sequence: this.toNumOrNull(r.sequence) ?? 1,
              deptId: this.toIdOrNull(r.deptId),
            }))
            .filter((r: any) => r.deptId != null)
        : [],
      components: Array.isArray(rv.tmzComponents)
        ? rv.tmzComponents
            .map((c: any) => ({
              componentReferenceId: this.toIdOrNull(
                c.componentId ?? c.componentReferenceId,
              ),
              qty: this.toNumOrNull(c.qty) ?? 1,
            }))
            .filter((c: any) => c.componentReferenceId != null)
        : [],
    };
    if (
      dto.works?.length ||
      dto.materials?.length ||
      dto.routes?.length ||
      dto.components?.length
    ) {
      await this.replaceAll(referenceId, dto);
    }
  }
}
