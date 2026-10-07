import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { FurnitureOrder } from "./furnitureOrder.model";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import { OrderPipelineStage } from "src/orderPipeline/orderPipelineStage.model";
import { OrderPipelineService } from "src/orderPipeline/orderPipeline.service";
import { DocumentsService } from "src/documents/documents.service";
import { ReferencesService } from "src/references/references.service";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { UsersService } from "src/users/users.service";
import {
  DocSTATUS,
  DocumentType,
} from "src/interfaces/document.interface";
import { OrderStageType } from "src/interfaces/furniture-order.interface";
import { TypeTMZ } from "src/interfaces/reference.interface";
import { SettingsService } from "src/settings/settings.service";
import {
  resolveHalfstuffWriteoffChargeId,
  resolveMaterialWriteoffChargeId,
} from "src/documents/helper/materialWriteoff.helper";
import { Entry } from "src/entries/entry.model";
import { Schet } from "src/interfaces/report.interface";
import { ReportsService } from "src/reports/reports.service";
import { OrderMaterialsService } from "src/orderMaterials/orderMaterials.service";
import { OrderHalfstuffsService } from "src/orderHalfstuffs/orderHalfstuffs.service";
import { StoreMaterialWriteoffLineDto } from "./dto/store-material-writeoff.dto";
import { StoreHalfstuffWriteoffLineDto } from "./dto/store-halfstuff-writeoff.dto";
import {
  calcRemaining,
  getMaxWriteoffSnapshotBalance,
  isQtyComplete,
  resolveEffectiveWarehouseBalance,
  resolvePlannedHalfstuffQty,
  resolvePlannedMaterialQty,
  WRITEOFF_QTY_EPSILON,
} from "./helper/writeoffQty.helper";
import { formatTmzUserLabel } from "./helper/writeoffReferenceLabel.helper";

export interface MaterialWriteoffLine {
  documentId: number;
  date: number;
  documentType: DocumentType;
  workId?: number;
  materialId?: number;
  halfstuffId?: number;
  materialName?: string;
  count: number;
  price?: number;
  balance?: number;
  total: number;
  docStatus: DocSTATUS;
}

export interface OrderCostBreakdown {
  materialsPosted: number;
  materialsOpen: number;
  salaryCalculated: number;
  salaryPosted: number;
  otherPosted: number;
  costTotal: number;
  hasUnprovedWriteoffs: boolean;
}

export interface StoreWorkDocumentInfo {
  documentId: number;
  documentType: DocumentType;
  docStatus: DocSTATUS;
  count?: number;
  total?: number;
  costTotal?: number;
  date?: number;
}

export interface ReceiptProgress {
  plannedQty: number;
  postedQty: number;
  remainingQty: number;
  plannedCost: number;
  postedCost: number;
  remainingCost: number;
}

export interface SaleProgress {
  plannedQty: number;
  postedQty: number;
  remainingQty: number;
  plannedTotal: number;
  postedTotal: number;
  remainingTotal: number;
}

export interface SaleAvailability {
  warehouseBalance: number;
  orderRemainingQty: number;
  openSaleQty: number;
  availableQty: number;
  stockAsOfDate: number;
}

export interface WriteoffProgressLine {
  materialId?: number;
  halfstuffId?: number;
  name?: string;
  unit?: string;
  planned: number;
  writtenOff: number;
  remaining: number;
  /** Сумма списания (total по проведённым строкам) */
  writtenOffTotal?: number;
  /** Средневзвешенная цена списания: writtenOffTotal / writtenOff */
  writtenOffPrice?: number;
}

export interface StoreWorkResponse {
  orderId: number;
  requiresReceipt: boolean;
  requiresClientSale: boolean;
  needsMaterialWriteoff: boolean;
  needsHalfstuffWriteoff: boolean;
  receiptType: DocumentType.ComeProduct | DocumentType.ComeHalfstuff | null;
  saleType: DocumentType.SaleProd | DocumentType.SaleHalfStuff | null;
  materialWriteoffs: MaterialWriteoffLine[];
  halfstuffWriteoffs: MaterialWriteoffLine[];
  materialWriteoff: StoreWorkDocumentInfo | null;
  halfstuffWriteoff: StoreWorkDocumentInfo | null;
  materialWriteoffComplete: boolean;
  halfstuffWriteoffComplete: boolean;
  materialWriteoffProgress: WriteoffProgressLine[];
  halfstuffWriteoffProgress: WriteoffProgressLine[];
  materialWriteoffDocuments: StoreWorkDocumentInfo[];
  halfstuffWriteoffDocuments: StoreWorkDocumentInfo[];
  costBreakdown: OrderCostBreakdown;
  receipt: StoreWorkDocumentInfo | null;
  sale: StoreWorkDocumentInfo | null;
  receiptDocuments: StoreWorkDocumentInfo[];
  saleDocuments: StoreWorkDocumentInfo[];
  receiptProgress: ReceiptProgress | null;
  saleProgress: SaleProgress | null;
  receiptComplete: boolean;
  saleComplete: boolean;
  saleAvailability: SaleAvailability | null;
  saleCostSource: "receipt" | "stock" | "none" | null;
  stockBalance: number | null;
  stockCostPrice: number | null;
  stockCostTotal: number | null;
  stockAsOfDate: number | null;
  canAdvanceFromStore: boolean;
  advanceBlockers: string[];
  advanceWarnings: string[];
  orphanWorks: Array<{
    id: number;
    workName: string;
    workStatus: string;
    assignedDeptId?: number | null;
    assignedDeptName?: string | null;
  }>;
  allowReceiptWithoutFullWriteoff: boolean;
  canCreateReceipt: boolean;
  receiptBlockers: string[];
  receiptWarnings: string[];
}

export interface ReceiptEligibility {
  canCreateReceipt: boolean;
  receiptBlockers: string[];
  receiptWarnings: string[];
}

export interface WriteoffStockEntry {
  balance: number;
  price: number;
}

export interface WriteoffStocksResponse {
  stockAsOfDate: number;
  materialWarehouseId: number | null;
  materials: Record<string, WriteoffStockEntry>;
  halfstuffs: Record<string, WriteoffStockEntry>;
}

const MSG_MATERIAL_WRITEOFF_INCOMPLETE =
  "Не завершено списание материалов по заказу (досписать остаток по плану)";
const MSG_HALFSTUFF_WRITEOFF_INCOMPLETE =
  "Не завершено списание полуфабрикатов по заказу (досписать остаток по плану)";
const MSG_RECEIPT_WRITEOFF_WARNING =
  "Списание по заказу не завершено — приход создаётся до полного закрытия плана";
const MSG_RECEIPT_NOT_REQUIRED =
  "Для этого заказа приход с производства не требуется";
const MSG_RECEIPT_COMPLETE = "Приход по заказу уже завершён";
const MSG_SALE_COMPLETE = "Отгрузка по заказу уже завершена";
const MSG_RECEIPT_INCOMPLETE = "Приход по заказу не завершён";
const MSG_SALE_INCOMPLETE = "Отгрузка по заказу не завершена";
const MONEY_EPSILON = 0.01;

const STORE_RECEIPT_DOC_TYPES: DocumentType[] = [
  DocumentType.ComeProduct,
  DocumentType.ComeHalfstuff,
];

const STORE_SALE_DOC_TYPES: DocumentType[] = [
  DocumentType.SaleProd,
  DocumentType.SaleHalfStuff,
];

@Injectable()
export class OrderStoreWorkService {
  constructor(
    @InjectModel(FurnitureOrder)
    private readonly orderRepo: typeof FurnitureOrder,
    @InjectModel(Document)
    private readonly documentRepo: typeof Document,
    @InjectModel(DocValues)
    private readonly docValuesRepo: typeof DocValues,
    @InjectModel(DocTableItems)
    private readonly docTableItemsRepo: typeof DocTableItems,
    @InjectModel(OrderWorkLog)
    private readonly workLogRepo: typeof OrderWorkLog,
    @InjectModel(OrderPipelineStage)
    private readonly pipelineStageRepo: typeof OrderPipelineStage,
    @InjectModel(Entry)
    private readonly entryRepo: typeof Entry,
    private readonly documentsService: DocumentsService,
    private readonly referencesService: ReferencesService,
    private readonly usersService: UsersService,
    private readonly reportsService: ReportsService,
    private readonly orderMaterialsService: OrderMaterialsService,
    private readonly orderHalfstuffsService: OrderHalfstuffsService,
    private readonly settingsService: SettingsService,
    private readonly pipelineService: OrderPipelineService,
  ) {}

  private static readonly ORDER_WRITEOFF_DOC_TYPES: DocumentType[] = [
    DocumentType.LeaveMaterial,
    DocumentType.LeaveOnlyOneMaterial,
    DocumentType.LeaveHalfstuff,
    DocumentType.LeaveProd,
  ];

  /** Основная таблица LeaveMaterial заказа: income (и legacy без типа), не нижняя expense. */
  private static isLeaveMaterialCatalogTableItem(
    tableType?: string | null,
  ): boolean {
    if (!tableType) return true;
    return (
      tableType !== "return" &&
      tableType !== "brak" &&
      tableType !== "sale" &&
      tableType !== "tovar"
    );
  }

  private async orderNeedsReceipt(
    orderId: number,
    pipelineStages: OrderPipelineStage[],
  ): Promise<boolean> {
    if (pipelineStages.some((s) => s.stageName === OrderStageType.IN_PRODUCTION)) {
      return true;
    }
    const [hasMaterials, hasHalfstuffs] = await Promise.all([
      this.orderHasMaterials(orderId),
      this.orderHasHalfstuffs(orderId),
    ]);
    return hasMaterials || hasHalfstuffs;
  }

  private async resolveTmzType(analiticId?: number | null): Promise<TypeTMZ> {
    if (!analiticId) {
      throw new BadRequestException("У заказа не указана номенклатура (analiticId)");
    }
    const ref = await this.referencesService.getReferenceById(Number(analiticId));
    const typeTMZ = ref?.refValues?.typeTMZ as TypeTMZ | undefined;
    if (typeTMZ === TypeTMZ.HALFSTUFF) return TypeTMZ.HALFSTUFF;
    if (typeTMZ === TypeTMZ.PRODUCT) return TypeTMZ.PRODUCT;
    throw new BadRequestException(
      `Номенклатура заказа должна быть PRODUCT или HALFSTUFF, получено: ${typeTMZ ?? "не задано"}`,
    );
  }

  private receiptDocType(typeTMZ: TypeTMZ): DocumentType.ComeProduct | DocumentType.ComeHalfstuff {
    return typeTMZ === TypeTMZ.HALFSTUFF
      ? DocumentType.ComeHalfstuff
      : DocumentType.ComeProduct;
  }

  private saleDocType(typeTMZ: TypeTMZ): DocumentType.SaleProd | DocumentType.SaleHalfStuff {
    return typeTMZ === TypeTMZ.HALFSTUFF
      ? DocumentType.SaleHalfStuff
      : DocumentType.SaleProd;
  }

  async getMaterialWriteoffs(
    orderId: number,
    options?: { skipNames?: boolean },
  ): Promise<MaterialWriteoffLine[]> {
    const skipNames = options?.skipNames === true;
    const docs = await this.documentRepo.findAll({
      where: {
        documentType: {
          [Op.in]: OrderStoreWorkService.ORDER_WRITEOFF_DOC_TYPES,
        },
        docStatus: { [Op.ne]: DocSTATUS.DELETED },
      },
      include: [
        {
          model: DocValues,
          where: { orderId },
          required: true,
        },
        { model: DocTableItems, required: false },
      ],
      order: [["date", "ASC"]],
    });

    const lines: MaterialWriteoffLine[] = [];
    for (const doc of docs) {
      if (
        doc.documentType === DocumentType.LeaveMaterial &&
        doc.docTableItems?.length
      ) {
        for (const item of doc.docTableItems) {
          if (
            !OrderStoreWorkService.isLeaveMaterialCatalogTableItem(item.tableType)
          ) {
            continue;
          }
          const materialId = Number(item.analiticId || 0) || undefined;
          let materialName: string | undefined;
          if (!skipNames && materialId) {
            const mat = await this.referencesService.getReferenceById(materialId);
            materialName = mat?.name;
          }
          lines.push({
            documentId: Number(doc.id),
            date: Number(doc.date),
            documentType: doc.documentType,
            workId:
              doc.docValues?.workId != null
                ? Number(doc.docValues.workId)
                : undefined,
            materialId,
            materialName,
            count: Number(item.count || 0),
            price: Number(item.price || 0),
            balance: Number(item.balance || 0),
            total: Number(item.total || 0),
            docStatus: doc.docStatus,
          });
        }
        continue;
      }

      if (
        doc.documentType === DocumentType.LeaveHalfstuff &&
        doc.docTableItems?.length
      ) {
        for (const item of doc.docTableItems) {
          const halfstuffId = Number(item.analiticId || 0) || undefined;
          let materialName: string | undefined;
          if (!skipNames && halfstuffId) {
            const hs = await this.referencesService.getReferenceById(halfstuffId);
            materialName = hs?.name;
          }
          lines.push({
            documentId: Number(doc.id),
            date: Number(doc.date),
            documentType: doc.documentType,
            workId:
              doc.docValues?.workId != null
                ? Number(doc.docValues.workId)
                : undefined,
            halfstuffId,
            materialId: halfstuffId,
            materialName,
            count: Number(item.count || 0),
            price: Number(item.price || 0),
            balance: Number(item.balance || 0),
            total: Number(item.total || 0),
            docStatus: doc.docStatus,
          });
        }
        continue;
      }

      const materialId =
        Number(doc.docValues?.productForChargeId || 0) || undefined;
      let materialName: string | undefined;
      if (!skipNames && materialId) {
        const mat = await this.referencesService.getReferenceById(materialId);
        materialName = mat?.name;
      }
      lines.push({
        documentId: Number(doc.id),
        date: Number(doc.date),
        documentType: doc.documentType,
        workId:
          doc.docValues?.workId != null ? Number(doc.docValues.workId) : undefined,
        materialId,
        materialName,
        count: Number(doc.docValues?.count || 0),
        total: Number(doc.docValues?.total || 0),
        docStatus: doc.docStatus,
      });
    }
    return lines;
  }

  private isMaterialWriteoffLine(w: MaterialWriteoffLine): boolean {
    return w.documentType !== DocumentType.LeaveHalfstuff;
  }

  private isHalfstuffWriteoffLine(w: MaterialWriteoffLine): boolean {
    return w.documentType === DocumentType.LeaveHalfstuff;
  }

  private lineItemId(
    w: MaterialWriteoffLine,
    type: "material" | "halfstuff",
  ): number | undefined {
    if (type === "halfstuff") {
      return w.halfstuffId ?? w.materialId;
    }
    return w.materialId;
  }

  private aggregateProvedWriteoffs(
    writeoffs: MaterialWriteoffLine[],
    type: "material" | "halfstuff",
  ): Map<number, { count: number; total: number }> {
    const isLine =
      type === "material"
        ? (w: MaterialWriteoffLine) => this.isMaterialWriteoffLine(w)
        : (w: MaterialWriteoffLine) => this.isHalfstuffWriteoffLine(w);

    const map = new Map<number, { count: number; total: number }>();
    for (const w of writeoffs) {
      if (w.docStatus !== DocSTATUS.PROVEDEN || !isLine(w)) continue;
      const id = this.lineItemId(w, type);
      if (!id) continue;
      const prev = map.get(id) ?? { count: 0, total: 0 };
      map.set(id, {
        count: prev.count + Number(w.count || 0),
        total: prev.total + Number(w.total || 0),
      });
    }
    return map;
  }

  private writeoffMoneyFields(agg?: { count: number; total: number }): {
    writtenOff: number;
    writtenOffTotal: number;
    writtenOffPrice: number;
  } {
    const writtenOff = Math.round(Number(agg?.count || 0) * 1000) / 1000;
    const writtenOffTotal = Number(Number(agg?.total || 0).toFixed(2));
    const writtenOffPrice =
      writtenOff > WRITEOFF_QTY_EPSILON
        ? Number((writtenOffTotal / writtenOff).toFixed(4))
        : 0;
    return { writtenOff, writtenOffTotal, writtenOffPrice };
  }

  private async buildMaterialWriteoffProgress(
    orderId: number,
    orderCount: number,
    provedMap: Map<number, { count: number; total: number }>,
  ): Promise<WriteoffProgressLine[]> {
    const materials = await this.orderMaterialsService.findByOrder(orderId);
    const progress: WriteoffProgressLine[] = [];
    const seenIds = new Set<number>();
    const extraIds: number[] = [];

    for (const m of materials) {
      const materialId = Number(m.materialId);
      if (!materialId) continue;
      seenIds.add(materialId);
      const planned = resolvePlannedMaterialQty(m, orderCount);
      const money = this.writeoffMoneyFields(provedMap.get(materialId));
      const ref = m.material ?? (await this.referencesService.getReferenceById(materialId));
      progress.push({
        materialId,
        name: ref?.name,
        unit: ref?.refValues?.unit as string | undefined,
        planned,
        writtenOff: money.writtenOff,
        remaining: calcRemaining(planned, money.writtenOff),
        writtenOffTotal: money.writtenOffTotal,
        writtenOffPrice: money.writtenOffPrice,
      });
    }

    for (const [materialId, agg] of provedMap) {
      if (seenIds.has(materialId)) continue;
      const writtenOff = Math.round(Number(agg?.count || 0) * 1000) / 1000;
      if (writtenOff <= WRITEOFF_QTY_EPSILON) continue;
      extraIds.push(materialId);
    }

    const extraRefs = await this.loadReferencesByIds(extraIds);
    for (const materialId of extraIds) {
      const money = this.writeoffMoneyFields(provedMap.get(materialId));
      const ref = extraRefs.get(materialId);
      progress.push({
        materialId,
        name: ref?.name,
        unit: ref?.refValues?.unit as string | undefined,
        planned: 0,
        writtenOff: money.writtenOff,
        remaining: calcRemaining(0, money.writtenOff),
        writtenOffTotal: money.writtenOffTotal,
        writtenOffPrice: money.writtenOffPrice,
      });
    }

    return progress.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
  }

  private async buildHalfstuffWriteoffProgress(
    orderId: number,
    orderCount: number,
    provedMap: Map<number, { count: number; total: number }>,
  ): Promise<WriteoffProgressLine[]> {
    const halfstuffs = await this.orderHalfstuffsService.findByOrder(orderId);
    const progress: WriteoffProgressLine[] = [];
    const seenIds = new Set<number>();
    const extraIds: number[] = [];

    for (const h of halfstuffs) {
      const halfstuffId = Number(h.halfstuffId);
      if (!halfstuffId) continue;
      seenIds.add(halfstuffId);
      const planned = resolvePlannedHalfstuffQty(h, orderCount);
      const money = this.writeoffMoneyFields(provedMap.get(halfstuffId));
      const ref =
        h.halfstuff ?? (await this.referencesService.getReferenceById(halfstuffId));
      progress.push({
        halfstuffId,
        name: ref?.name,
        unit: ref?.refValues?.unit as string | undefined,
        planned,
        writtenOff: money.writtenOff,
        remaining: calcRemaining(planned, money.writtenOff),
        writtenOffTotal: money.writtenOffTotal,
        writtenOffPrice: money.writtenOffPrice,
      });
    }

    for (const [halfstuffId, agg] of provedMap) {
      if (seenIds.has(halfstuffId)) continue;
      const writtenOffRaw = agg?.count;
      const writtenOff = Math.round(Number(writtenOffRaw || 0) * 1000) / 1000;
      if (writtenOff <= WRITEOFF_QTY_EPSILON) continue;
      extraIds.push(halfstuffId);
    }

    const extraRefs = await this.loadReferencesByIds(extraIds);
    for (const halfstuffId of extraIds) {
      const money = this.writeoffMoneyFields(provedMap.get(halfstuffId));
      const ref = extraRefs.get(halfstuffId);
      progress.push({
        halfstuffId,
        name: ref?.name,
        unit: ref?.refValues?.unit as string | undefined,
        planned: 0,
        writtenOff: money.writtenOff,
        remaining: calcRemaining(0, money.writtenOff),
        writtenOffTotal: money.writtenOffTotal,
        writtenOffPrice: money.writtenOffPrice,
      });
    }

    return progress.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
  }

  private async loadReferencesByIds(
    ids: number[],
  ): Promise<Map<number, Reference>> {
    const map = new Map<number, Reference>();
    const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
    if (!unique.length) return map;
    const rows = await Reference.findAll({
      where: { id: { [Op.in]: unique } },
      include: [{ model: RefValues, required: false }],
    });
    for (const row of rows) {
      map.set(Number(row.id), row);
    }
    return map;
  }

  private isWriteoffProgressComplete(progress: WriteoffProgressLine[]): boolean {
    if (!progress.length) return true;
    return progress.every((p) => isQtyComplete(p.writtenOff, p.planned));
  }

  async isMaterialWriteoffComplete(order: FurnitureOrder): Promise<boolean> {
    if (!(await this.orderHasMaterials(order.id))) return true;
    const writeoffs = await this.getMaterialWriteoffs(order.id);
    const provedMap = this.aggregateProvedWriteoffs(writeoffs, "material");
    const progress = await this.buildMaterialWriteoffProgress(
      order.id,
      Number(order.count || 1),
      provedMap,
    );
    return this.isWriteoffProgressComplete(progress);
  }

  async isHalfstuffWriteoffComplete(order: FurnitureOrder): Promise<boolean> {
    if (!(await this.orderHasHalfstuffs(order.id))) return true;
    const writeoffs = await this.getMaterialWriteoffs(order.id);
    const provedMap = this.aggregateProvedWriteoffs(writeoffs, "halfstuff");
    const progress = await this.buildHalfstuffWriteoffProgress(
      order.id,
      Number(order.count || 1),
      provedMap,
    );
    return this.isWriteoffProgressComplete(progress);
  }

  private async isStoreWriteoffComplete(order: FurnitureOrder): Promise<boolean> {
    const [materialsComplete, halfstuffsComplete, hasMaterials, hasHalfstuffs] =
      await Promise.all([
        this.isMaterialWriteoffComplete(order),
        this.isHalfstuffWriteoffComplete(order),
        this.orderHasMaterials(order.id),
        this.orderHasHalfstuffs(order.id),
      ]);
    return (!hasMaterials || materialsComplete) && (!hasHalfstuffs || halfstuffsComplete);
  }

  async evaluateReceiptEligibility(
    order: FurnitureOrder,
    pipelineStages?: OrderPipelineStage[],
  ): Promise<ReceiptEligibility> {
    const stages =
      pipelineStages ??
      order.pipelineStages ??
      (await this.pipelineStageRepo.findAll({ where: { orderId: order.id } }));
    const needsReceipt = await this.orderNeedsReceipt(order.id, stages);

    if (!needsReceipt) {
      return {
        canCreateReceipt: false,
        receiptBlockers: [MSG_RECEIPT_NOT_REQUIRED],
        receiptWarnings: [],
      };
    }

    const receiptDocuments = await this.getStoreReceiptDocuments(order.id);
    const breakdown = await this.calculateCostBreakdown(order.id);
    const receiptProgress = this.buildReceiptProgress(
      order,
      breakdown.costTotal,
      this.aggregateProvedStoreDocuments(receiptDocuments),
    );
    if (this.isReceiptProgressComplete(receiptProgress)) {
      return {
        canCreateReceipt: false,
        receiptBlockers: [MSG_RECEIPT_COMPLETE],
        receiptWarnings: [],
      };
    }

    const writeoffComplete = await this.isStoreWriteoffComplete(order);
    if (writeoffComplete) {
      return {
        canCreateReceipt: true,
        receiptBlockers: [],
        receiptWarnings: [],
      };
    }

    const blockers: string[] = [];
    const hasMaterials = await this.orderHasMaterials(order.id);
    const hasHalfstuffs = await this.orderHasHalfstuffs(order.id);

    if (hasMaterials && !(await this.isMaterialWriteoffComplete(order))) {
      blockers.push(MSG_MATERIAL_WRITEOFF_INCOMPLETE);
    }
    if (hasHalfstuffs && !(await this.isHalfstuffWriteoffComplete(order))) {
      blockers.push(MSG_HALFSTUFF_WRITEOFF_INCOMPLETE);
    }

    if (order.allowReceiptWithoutFullWriteoff) {
      return {
        canCreateReceipt: true,
        receiptBlockers: [],
        receiptWarnings: [MSG_RECEIPT_WRITEOFF_WARNING],
      };
    }

    return {
      canCreateReceipt: false,
      receiptBlockers: blockers,
      receiptWarnings: [],
    };
  }

  private async getStoreWriteoffDocuments(
    orderId: number,
    documentType: DocumentType.LeaveMaterial | DocumentType.LeaveHalfstuff,
  ): Promise<StoreWorkDocumentInfo[]> {
    const docs = await this.documentRepo.findAll({
      where: {
        documentType,
        docStatus: { [Op.ne]: DocSTATUS.DELETED },
      },
      include: [
        {
          model: DocValues,
          where: {
            orderId,
            workId: { [Op.or]: [null, 0] },
          },
          required: true,
        },
        { model: DocTableItems, required: false },
      ],
      order: [["date", "ASC"], ["id", "ASC"]],
    });

    const result: StoreWorkDocumentInfo[] = [];
    for (const doc of docs) {
      const info = this.toStoreWorkDocInfo(doc);
      if (info) result.push(info);
    }
    return result;
  }

  private async findOpenStoreWriteoffDoc(
    orderId: number,
    documentType: DocumentType.LeaveMaterial | DocumentType.LeaveHalfstuff,
  ): Promise<Document | null> {
    const docs = await this.documentRepo.findAll({
      where: {
        documentType,
        docStatus: DocSTATUS.OPEN,
      },
      include: [
        {
          model: DocValues,
          where: {
            orderId,
            workId: { [Op.or]: [null, 0] },
          },
          required: true,
        },
      ],
      order: [["id", "DESC"]],
      limit: 1,
    });
    return docs[0] ?? null;
  }

  async hasAnyProvedStoreMaterialWriteoff(orderId: number): Promise<boolean> {
    return this.hasProvedStoreWriteoffDoc(orderId, DocumentType.LeaveMaterial);
  }

  async hasAnyProvedStoreHalfstuffWriteoff(orderId: number): Promise<boolean> {
    return this.hasProvedStoreWriteoffDoc(orderId, DocumentType.LeaveHalfstuff);
  }

  private async hasProvedStoreWriteoffDoc(
    orderId: number,
    documentType: DocumentType.LeaveMaterial | DocumentType.LeaveHalfstuff,
  ): Promise<boolean> {
    const count = await this.documentRepo.count({
      where: {
        documentType,
        docStatus: DocSTATUS.PROVEDEN,
      },
      include: [
        {
          model: DocValues,
          where: {
            orderId,
            workId: { [Op.or]: [null, 0] },
          },
          required: true,
        },
      ],
    });
    return count > 0;
  }

  private async getStoreOrderDocuments(
    orderId: number,
    documentTypes: DocumentType[],
  ): Promise<StoreWorkDocumentInfo[]> {
    const docs = await this.documentRepo.findAll({
      where: {
        documentType: { [Op.in]: documentTypes },
        docStatus: { [Op.ne]: DocSTATUS.DELETED },
      },
      include: [
        {
          model: DocValues,
          where: { orderId },
          required: true,
        },
        { model: DocTableItems, required: false },
      ],
      order: [["date", "ASC"], ["id", "ASC"]],
    });

    const result: StoreWorkDocumentInfo[] = [];
    for (const doc of docs) {
      const info = this.toStoreWorkDocInfo(doc);
      if (info) result.push(info);
    }
    return result;
  }

  private async getStoreReceiptDocuments(
    orderId: number,
  ): Promise<StoreWorkDocumentInfo[]> {
    return this.getStoreOrderDocuments(orderId, STORE_RECEIPT_DOC_TYPES);
  }

  private async getStoreSaleDocuments(
    orderId: number,
  ): Promise<StoreWorkDocumentInfo[]> {
    return this.getStoreOrderDocuments(orderId, STORE_SALE_DOC_TYPES);
  }

  private async findOpenStoreOrderDoc(
    orderId: number,
    documentType: DocumentType,
  ): Promise<Document | null> {
    const docs = await this.documentRepo.findAll({
      where: {
        documentType,
        docStatus: DocSTATUS.OPEN,
      },
      include: [
        {
          model: DocValues,
          where: { orderId },
          required: true,
        },
      ],
      order: [["id", "DESC"]],
      limit: 1,
    });
    return docs[0] ?? null;
  }

  private aggregateProvedStoreDocuments(
    docs: StoreWorkDocumentInfo[],
  ): { postedQty: number; postedTotal: number } {
    let postedQty = 0;
    let postedTotal = 0;
    for (const doc of docs) {
      if (doc.docStatus !== DocSTATUS.PROVEDEN) continue;
      postedQty += Number(doc.count || 0);
      postedTotal += Number(doc.costTotal ?? doc.total ?? 0);
    }
    return {
      postedQty: Math.round(postedQty * 1000) / 1000,
      postedTotal: Number(postedTotal.toFixed(2)),
    };
  }

  private aggregateProvedSales(
    docs: StoreWorkDocumentInfo[],
  ): { postedQty: number; postedTotal: number } {
    let postedQty = 0;
    let postedTotal = 0;
    for (const doc of docs) {
      if (doc.docStatus !== DocSTATUS.PROVEDEN) continue;
      postedQty += Number(doc.count || 0);
      postedTotal += Number(doc.total ?? 0);
    }
    return {
      postedQty: Math.round(postedQty * 1000) / 1000,
      postedTotal: Number(postedTotal.toFixed(2)),
    };
  }

  private aggregateProvedSaleCosts(
    docs: StoreWorkDocumentInfo[],
  ): { postedQty: number; postedCost: number } {
    let postedQty = 0;
    let postedCost = 0;
    for (const doc of docs) {
      if (doc.docStatus !== DocSTATUS.PROVEDEN) continue;
      postedQty += Number(doc.count || 0);
      postedCost += Number(doc.costTotal ?? 0);
    }
    return {
      postedQty: Math.round(postedQty * 1000) / 1000,
      postedCost: Number(postedCost.toFixed(2)),
    };
  }

  private buildReceiptProgress(
    order: FurnitureOrder,
    plannedCost: number,
    proved: { postedQty: number; postedTotal: number },
  ): ReceiptProgress {
    const plannedQty = Number(order.count || 1);
    const postedQty = proved.postedQty;
    const postedCost = proved.postedTotal;
    return {
      plannedQty,
      postedQty,
      remainingQty: calcRemaining(plannedQty, postedQty),
      plannedCost: Number(plannedCost.toFixed(2)),
      postedCost,
      remainingCost: Math.max(
        0,
        Number((plannedCost - postedCost).toFixed(2)),
      ),
    };
  }

  private buildSaleProgress(
    order: FurnitureOrder,
    proved: { postedQty: number; postedTotal: number },
  ): SaleProgress {
    const plannedQty = Number(order.count || 1);
    const plannedTotal = Number(order.total || 0);
    const postedQty = proved.postedQty;
    const postedTotal = proved.postedTotal;
    return {
      plannedQty,
      postedQty,
      remainingQty: calcRemaining(plannedQty, postedQty),
      plannedTotal,
      postedTotal,
      remainingTotal: Math.max(
        0,
        Number((plannedTotal - postedTotal).toFixed(2)),
      ),
    };
  }

  private isReceiptProgressComplete(progress: ReceiptProgress): boolean {
    return (
      isQtyComplete(progress.postedQty, progress.plannedQty) &&
      progress.postedCost >= progress.plannedCost - MONEY_EPSILON
    );
  }

  private isSaleProgressComplete(progress: SaleProgress): boolean {
    return (
      isQtyComplete(progress.postedQty, progress.plannedQty) &&
      progress.postedTotal >= progress.plannedTotal - MONEY_EPSILON
    );
  }

  async hasAnyProvedStoreReceipt(orderId: number): Promise<boolean> {
    const docs = await this.getStoreReceiptDocuments(orderId);
    return docs.some((d) => d.docStatus === DocSTATUS.PROVEDEN);
  }

  async hasAnyProvedStoreSale(orderId: number): Promise<boolean> {
    const docs = await this.getStoreSaleDocuments(orderId);
    return docs.some((d) => d.docStatus === DocSTATUS.PROVEDEN);
  }

  private async validateMaterialWriteoffLinesRemaining(
    orderId: number,
    orderCount: number,
    lines: StoreMaterialWriteoffLineDto[],
  ): Promise<void> {
    const writeoffs = await this.getMaterialWriteoffs(orderId);
    const provedMap = this.aggregateProvedWriteoffs(writeoffs, "material");
    const materials = await this.orderMaterialsService.findByOrder(orderId);
    const bomIds = new Set(materials.map((m) => Number(m.materialId)));

    for (const line of lines) {
      const materialId = Number(line.materialId);
      const count = Number(line.count || 0);
      if (count <= 0) continue;

      const material = materials.find((m) => Number(m.materialId) === materialId);
      if (!material) {
        await this.validateWriteoffMaterialReference(materialId);
        continue;
      }

      const planned = resolvePlannedMaterialQty(material, orderCount);
      const writtenOff = provedMap.get(materialId)?.count ?? 0;
      const remaining = calcRemaining(planned, writtenOff);

      if (count > remaining + WRITEOFF_QTY_EPSILON) {
        const label = formatTmzUserLabel(material.material, materialId);
        throw new BadRequestException(
          `Количество (${count}) превышает остаток к списанию (${remaining}) для материала ${label}`,
        );
      }
    }

    const batchByMaterial = new Map<number, number>();
    for (const line of lines) {
      const materialId = Number(line.materialId);
      const count = Number(line.count || 0);
      if (count <= 0 || !bomIds.has(materialId)) continue;
      batchByMaterial.set(
        materialId,
        (batchByMaterial.get(materialId) ?? 0) + count,
      );
    }
    for (const [materialId, batchCount] of batchByMaterial) {
      const material = materials.find((m) => Number(m.materialId) === materialId)!;
      const planned = resolvePlannedMaterialQty(material, orderCount);
      const writtenOff = provedMap.get(materialId)?.count ?? 0;
      const remaining = calcRemaining(planned, writtenOff);
      if (batchCount > remaining + WRITEOFF_QTY_EPSILON) {
        const label = formatTmzUserLabel(material.material, materialId);
        throw new BadRequestException(
          `Суммарное количество (${batchCount}) превышает остаток к списанию (${remaining}) для материала ${label}`,
        );
      }
    }
  }

  private async validateHalfstuffWriteoffLinesRemaining(
    orderId: number,
    orderCount: number,
    lines: StoreHalfstuffWriteoffLineDto[],
  ): Promise<void> {
    const writeoffs = await this.getMaterialWriteoffs(orderId);
    const provedMap = this.aggregateProvedWriteoffs(writeoffs, "halfstuff");
    const halfstuffs = await this.orderHalfstuffsService.findByOrder(orderId);

    for (const line of lines) {
      const halfstuffId = Number(line.halfstuffId);
      const count = Number(line.count || 0);
      if (count <= 0) continue;

      const row = halfstuffs.find((h) => Number(h.halfstuffId) === halfstuffId);
      if (!row) {
        await this.validateWriteoffHalfstuffReference(halfstuffId);
        continue;
      }

      const planned = resolvePlannedHalfstuffQty(row, orderCount);
      const writtenOff = provedMap.get(halfstuffId)?.count ?? 0;
      const remaining = calcRemaining(planned, writtenOff);

      if (count > remaining + WRITEOFF_QTY_EPSILON) {
        const label = formatTmzUserLabel(row.halfstuff, halfstuffId);
        throw new BadRequestException(
          `Количество (${count}) превышает остаток к списанию (${remaining}) для полуфабриката ${label}`,
        );
      }
    }
  }

  private async orderHasHalfstuffs(orderId: number): Promise<boolean> {
    const rows = await this.orderHalfstuffsService.findByOrder(orderId);
    return rows.length > 0;
  }

  private async orderHasMaterials(orderId: number): Promise<boolean> {
    const materials = await this.orderMaterialsService.findByOrder(orderId);
    return materials.length > 0;
  }

  private resolveStockAsOfDate(stockAsOfDateMs?: number | null): number {
    const oneDay = 24 * 60 * 60 * 1000;
    if (
      stockAsOfDateMs != null &&
      Number.isFinite(Number(stockAsOfDateMs)) &&
      Number(stockAsOfDateMs) > 0
    ) {
      return Number(stockAsOfDateMs);
    }
    return Date.now() + oneDay;
  }

  private resolveSaleStockAsOfDate(stockAsOfDateMs?: number | null): number {
    const noon = this.resolveStockAsOfDate(stockAsOfDateMs);
    const d = new Date(noon);
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
  }

  private async resolveSaleStockBalance(
    order: FurnitureOrder,
    enterpriseId: number,
    storageId: number,
    stockAsOfDateMs?: number | null,
  ): Promise<{ balance: number; stockAsOfDate: number }> {
    const tmzType = await this.resolveTmzType(order.analiticId);
    const stockAsOfDate = this.resolveSaleStockAsOfDate(stockAsOfDateMs);
    const stockInfo = await this.reportsService.getTmzAveragePrice(
      Number(order.analiticId),
      tmzType,
      enterpriseId,
      storageId,
      stockAsOfDate,
    );
    return {
      balance: Number(stockInfo.balance || 0),
      stockAsOfDate,
    };
  }

  private async resolveSaleAvailability(
    order: FurnitureOrder,
    saleDocuments: StoreWorkDocumentInfo[],
    enterpriseId: number,
    storageId: number,
    stockAsOfDateMs?: number | null,
  ): Promise<SaleAvailability> {
    const saleProgress = this.buildSaleProgress(
      order,
      this.aggregateProvedSales(saleDocuments),
    );
    const openSale = saleDocuments.find((d) => d.docStatus === DocSTATUS.OPEN);
    const openSaleQty =
      openSale?.count != null ? Number(openSale.count) : 0;

    const stock = await this.resolveSaleStockBalance(
      order,
      enterpriseId,
      storageId,
      stockAsOfDateMs,
    );

    const warehouseBalance = Math.round(stock.balance * 1000) / 1000;
    const orderRemainingQty = saleProgress.remainingQty;
    const availableQty = Math.min(warehouseBalance, orderRemainingQty);

    return {
      warehouseBalance,
      orderRemainingQty,
      openSaleQty,
      availableQty: Math.round(availableQty * 1000) / 1000,
      stockAsOfDate: stock.stockAsOfDate,
    };
  }

  private async resolveSaleCost(
    order: FurnitureOrder,
    needsReceipt: boolean,
    receiptDocuments: StoreWorkDocumentInfo[],
    saleDocuments: StoreWorkDocumentInfo[],
    enterpriseId: number,
    storageId: number,
    stockAsOfDateMs?: number | null,
    partialCount?: number,
  ): Promise<{
    costTotal: number;
    costPrice: number;
    costSource: StoreWorkResponse["saleCostSource"];
    stockBalance: number | null;
    stockAsOfDate: number | null;
  }> {
    const orderCount = Number(order.count || 1);
    const qty = partialCount != null && partialCount > 0 ? partialCount : orderCount;
    const tmzType = await this.resolveTmzType(order.analiticId);

    const provedReceipts = this.aggregateProvedStoreDocuments(receiptDocuments);
    const provedSaleCosts = this.aggregateProvedSaleCosts(saleDocuments);
    const poolQty =
      Math.round((provedReceipts.postedQty - provedSaleCosts.postedQty) * 1000) /
      1000;
    const poolCost = Number(
      (provedReceipts.postedTotal - provedSaleCosts.postedCost).toFixed(2),
    );
    if (
      needsReceipt &&
      poolQty > WRITEOFF_QTY_EPSILON &&
      poolCost > MONEY_EPSILON
    ) {
      const unitCost = poolCost / poolQty;
      const costTotal = Number((unitCost * qty).toFixed(2));
      const stock = await this.resolveSaleStockBalance(
        order,
        enterpriseId,
        storageId,
        stockAsOfDateMs,
      );
      return {
        costTotal,
        costPrice: Number(unitCost.toFixed(4)),
        costSource: "receipt",
        stockBalance: stock.balance,
        stockAsOfDate: stock.stockAsOfDate,
      };
    }

    const stockAsOfDate = this.resolveSaleStockAsOfDate(stockAsOfDateMs);
    const stockInfo = await this.reportsService.getTmzAveragePrice(
      Number(order.analiticId),
      tmzType,
      enterpriseId,
      storageId,
      stockAsOfDate,
    );
    const costTotal = Number((stockInfo.price * qty).toFixed(2));
    return {
      costTotal,
      costPrice:
        qty > 0
          ? Number(stockInfo.price.toFixed(4))
          : Number(stockInfo.price),
      costSource: stockInfo.price > 0 ? "stock" : "none",
      stockBalance: Number(stockInfo.balance || 0),
      stockAsOfDate,
    };
  }

  async calculateCostBreakdown(orderId: number): Promise<OrderCostBreakdown> {
    const writeoffs = await this.getMaterialWriteoffs(orderId);
    const materialsPosted = writeoffs
      .filter((w) => w.docStatus === DocSTATUS.PROVEDEN)
      .reduce((sum, w) => sum + w.total, 0);
    const materialsOpen = writeoffs
      .filter((w) => w.docStatus !== DocSTATUS.PROVEDEN)
      .reduce((sum, w) => sum + w.total, 0);

    const logs = await this.workLogRepo.findAll({ where: { orderId } });
    const salaryCalculated = logs.reduce(
      (sum, log) => sum + Number(log.calculatedSalary || 0),
      0,
    );

    const entries = await this.entryRepo.findAll({
      where: {
        orderId,
        debet: Schet.S20,
      },
    });
    const totalS20 = entries.reduce((sum, e) => sum + Number(e.total || 0), 0);
    const salaryPosted = entries
      .filter((e) => e.kredit === Schet.S67)
      .reduce((sum, e) => sum + Number(e.total || 0), 0);
    const materialFromEntries = entries
      .filter((e) => e.kredit === Schet.S10)
      .reduce((sum, e) => sum + Number(e.total || 0), 0);
    const halfstuffFromEntries = entries
      .filter((e) => e.kredit === Schet.S21)
      .reduce((sum, e) => sum + Number(e.total || 0), 0);
    const productFromEntries = entries
      .filter((e) => e.kredit === Schet.S28)
      .reduce((sum, e) => sum + Number(e.total || 0), 0);
    const otherPosted = Math.max(
      0,
      totalS20 -
        salaryPosted -
        materialFromEntries -
        halfstuffFromEntries -
        productFromEntries,
    );

    const costTotal = totalS20 > 0 ? totalS20 : materialsPosted;

    return {
      materialsPosted,
      materialsOpen,
      salaryCalculated,
      salaryPosted,
      otherPosted,
      costTotal: Number(costTotal.toFixed(2)),
      hasUnprovedWriteoffs: writeoffs.some((w) => w.docStatus !== DocSTATUS.PROVEDEN),
    };
  }

  private toStoreWorkDocInfo(doc: Document): StoreWorkDocumentInfo | null {
    if (!doc || doc.docStatus === DocSTATUS.DELETED) return null;

    const tableItems = (doc.docTableItems ?? []).filter(
      (i) => i.tableType !== "return" && i.tableType !== "brak",
    );

    let count = Number(doc.docValues?.count || 0);
    if ((!Number.isFinite(count) || count <= WRITEOFF_QTY_EPSILON) && tableItems.length) {
      count = tableItems.reduce((s, i) => s + Number(i.count || 0), 0);
    }

    let costTotal = Number(doc.docValues?.total || 0);
    let total = costTotal;
    if (tableItems.length) {
      costTotal = tableItems.reduce((s, i) => s + Number(i.costTotal || 0), 0);
      total = tableItems.reduce((s, i) => s + Number(i.total || 0), 0);
      if (!costTotal) {
        costTotal = tableItems.reduce((s, i) => s + Number(i.total || 0), 0);
      }
    }

    return {
      documentId: Number(doc.id),
      documentType: doc.documentType,
      docStatus: doc.docStatus,
      count: Math.round(Number(count || 0) * 1000) / 1000,
      total: Number(Number(total || 0).toFixed(2)),
      costTotal: Number(Number(costTotal || 0).toFixed(2)),
      date: doc.date != null ? Number(doc.date) : undefined,
    };
  }

  private async getDocInfo(
    docId?: number | null,
  ): Promise<StoreWorkDocumentInfo | null> {
    if (!docId) return null;
    const doc = await this.documentRepo.findByPk(docId, {
      include: [DocValues, DocTableItems],
    });
    if (!doc) return null;
    return this.toStoreWorkDocInfo(doc);
  }

  async getAdvanceBlockers(order: FurnitureOrder): Promise<string[]> {
    const blockers: string[] = [];
    const pipelineStages =
      order.pipelineStages ??
      (await this.pipelineStageRepo.findAll({ where: { orderId: order.id } }));
    const needsReceipt = await this.orderNeedsReceipt(order.id, pipelineStages);
    const hasMaterials = await this.orderHasMaterials(order.id);

    if (!order.allowReceiptWithoutFullWriteoff) {
      if (hasMaterials) {
        const complete = await this.isMaterialWriteoffComplete(order);
        if (!complete) {
          blockers.push(MSG_MATERIAL_WRITEOFF_INCOMPLETE);
        }
      }

      const hasHalfstuffs = await this.orderHasHalfstuffs(order.id);
      if (hasHalfstuffs) {
        const complete = await this.isHalfstuffWriteoffComplete(order);
        if (!complete) {
          blockers.push(MSG_HALFSTUFF_WRITEOFF_INCOMPLETE);
        }
      }
    }

    if (needsReceipt) {
      const receiptDocuments = await this.getStoreReceiptDocuments(order.id);
      const breakdown = await this.calculateCostBreakdown(order.id);
      const receiptProgress = this.buildReceiptProgress(
        order,
        breakdown.costTotal,
        this.aggregateProvedStoreDocuments(receiptDocuments),
      );
      if (!this.isReceiptProgressComplete(receiptProgress)) {
        blockers.push(MSG_RECEIPT_INCOMPLETE);
      }
      if (receiptDocuments.some((d) => d.docStatus === DocSTATUS.OPEN)) {
        blockers.push("Проводка берилмаган хужжатлар бор");
      }
    }

    if (order.requiresClientSale !== false) {
      const saleDocuments = await this.getStoreSaleDocuments(order.id);
      const saleProgress = this.buildSaleProgress(
        order,
        this.aggregateProvedSales(saleDocuments),
      );
      if (!this.isSaleProgressComplete(saleProgress)) {
        blockers.push(MSG_SALE_INCOMPLETE);
      }
      if (saleDocuments.some((d) => d.docStatus === DocSTATUS.OPEN)) {
        blockers.push("Проводка берилмаган фактура бор");
      }
    }

    const productionBlockers =
      await this.pipelineService.getProductionAdvanceBlockers(order.id);
    blockers.push(...productionBlockers);

    return blockers;
  }

  async validateCanAdvanceFromStore(order: FurnitureOrder): Promise<void> {
    const blockers = await this.getAdvanceBlockers(order);
    if (blockers.length > 0) {
      throw new BadRequestException(blockers.join(". "));
    }
  }

  /**
   * Lightweight store-work payload for the view-only «Омбор ишлари» tab.
   * One writeoffs pass, no sale stock / receipt eligibility / duplicate blockers fan-out.
   */
  async getStoreWorkSummary(orderId: number): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId, {
      include: [OrderPipelineStage],
    });
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    const pipelineStages = order.pipelineStages ?? [];
    const orderCount = Number(order.count || 1);
    const requiresClientSale = order.requiresClientSale !== false;

    const [
      needsReceipt,
      hasMaterials,
      hasHalfstuffs,
      allWriteoffs,
      orphanInfo,
    ] = await Promise.all([
      this.orderNeedsReceipt(orderId, pipelineStages),
      this.orderHasMaterials(orderId),
      this.orderHasHalfstuffs(orderId),
      this.getMaterialWriteoffs(orderId, { skipNames: true }),
      this.pipelineService.getOrphanWorkAdvanceInfo(orderId),
    ]);

    let receiptType: StoreWorkResponse["receiptType"] = null;
    let saleType: StoreWorkResponse["saleType"] = null;
    if (order.analiticId) {
      try {
        const tmz = await this.resolveTmzType(order.analiticId);
        receiptType = this.receiptDocType(tmz);
        saleType = this.saleDocType(tmz);
      } catch {
        // analitic not set or invalid
      }
    }

    const provedMaterialMap = this.aggregateProvedWriteoffs(allWriteoffs, "material");
    const provedHalfstuffMap = this.aggregateProvedWriteoffs(allWriteoffs, "halfstuff");

    const [
      materialWriteoffProgress,
      halfstuffWriteoffProgress,
      materialWriteoffDocuments,
      halfstuffWriteoffDocuments,
      receiptDocuments,
      saleDocuments,
      productionBlockers,
    ] = await Promise.all([
      hasMaterials
        ? this.buildMaterialWriteoffProgress(orderId, orderCount, provedMaterialMap)
        : Promise.resolve([] as WriteoffProgressLine[]),
      hasHalfstuffs
        ? this.buildHalfstuffWriteoffProgress(orderId, orderCount, provedHalfstuffMap)
        : Promise.resolve([] as WriteoffProgressLine[]),
      hasMaterials
        ? this.getStoreWriteoffDocuments(orderId, DocumentType.LeaveMaterial)
        : Promise.resolve([] as StoreWorkDocumentInfo[]),
      hasHalfstuffs
        ? this.getStoreWriteoffDocuments(orderId, DocumentType.LeaveHalfstuff)
        : Promise.resolve([] as StoreWorkDocumentInfo[]),
      needsReceipt
        ? this.getStoreReceiptDocuments(orderId)
        : Promise.resolve([] as StoreWorkDocumentInfo[]),
      requiresClientSale
        ? this.getStoreSaleDocuments(orderId)
        : Promise.resolve([] as StoreWorkDocumentInfo[]),
      this.pipelineService.getProductionAdvanceBlockers(orderId),
    ]);

    const materialWriteoffComplete =
      !hasMaterials || this.isWriteoffProgressComplete(materialWriteoffProgress);
    const halfstuffWriteoffComplete =
      !hasHalfstuffs || this.isWriteoffProgressComplete(halfstuffWriteoffProgress);

    const materialsPosted = allWriteoffs
      .filter((w) => w.docStatus === DocSTATUS.PROVEDEN)
      .reduce((sum, w) => sum + Number(w.total || 0), 0);
    const materialsOpen = allWriteoffs
      .filter((w) => w.docStatus !== DocSTATUS.PROVEDEN)
      .reduce((sum, w) => sum + Number(w.total || 0), 0);
    const costBreakdown: OrderCostBreakdown = {
      materialsPosted: Number(materialsPosted.toFixed(2)),
      materialsOpen: Number(materialsOpen.toFixed(2)),
      salaryCalculated: 0,
      salaryPosted: 0,
      otherPosted: 0,
      costTotal: Number(materialsPosted.toFixed(2)),
      hasUnprovedWriteoffs: allWriteoffs.some(
        (w) => w.docStatus !== DocSTATUS.PROVEDEN,
      ),
    };

    const receiptProgress = needsReceipt
      ? this.buildReceiptProgress(
          order,
          costBreakdown.costTotal,
          this.aggregateProvedStoreDocuments(receiptDocuments),
        )
      : null;
    const saleProgress = requiresClientSale
      ? this.buildSaleProgress(order, this.aggregateProvedSales(saleDocuments))
      : null;
    const receiptComplete =
      receiptProgress != null && this.isReceiptProgressComplete(receiptProgress);
    const saleComplete =
      saleProgress != null && this.isSaleProgressComplete(saleProgress);

    const advanceBlockers: string[] = [];
    if (!order.allowReceiptWithoutFullWriteoff) {
      if (hasMaterials && !materialWriteoffComplete) {
        advanceBlockers.push(MSG_MATERIAL_WRITEOFF_INCOMPLETE);
      }
      if (hasHalfstuffs && !halfstuffWriteoffComplete) {
        advanceBlockers.push(MSG_HALFSTUFF_WRITEOFF_INCOMPLETE);
      }
    }
    if (needsReceipt) {
      if (receiptProgress && !this.isReceiptProgressComplete(receiptProgress)) {
        advanceBlockers.push(MSG_RECEIPT_INCOMPLETE);
      }
      if (receiptDocuments.some((d) => d.docStatus === DocSTATUS.OPEN)) {
        advanceBlockers.push("Проводка берилмаган хужжатлар бор");
      }
    }
    if (requiresClientSale) {
      if (saleProgress && !this.isSaleProgressComplete(saleProgress)) {
        advanceBlockers.push(MSG_SALE_INCOMPLETE);
      }
      if (saleDocuments.some((d) => d.docStatus === DocSTATUS.OPEN)) {
        advanceBlockers.push("Проводка берилмаган фактура бор");
      }
    }
    advanceBlockers.push(...productionBlockers);

    const materialWriteoff =
      materialWriteoffDocuments[materialWriteoffDocuments.length - 1] ?? null;
    const halfstuffWriteoff =
      halfstuffWriteoffDocuments[halfstuffWriteoffDocuments.length - 1] ?? null;
    const receipt =
      receiptDocuments.find((d) => d.docStatus === DocSTATUS.OPEN) ??
      receiptDocuments[receiptDocuments.length - 1] ??
      null;
    const sale =
      saleDocuments.find((d) => d.docStatus === DocSTATUS.OPEN) ??
      saleDocuments[saleDocuments.length - 1] ??
      null;

    return {
      orderId,
      requiresReceipt: needsReceipt,
      requiresClientSale,
      needsMaterialWriteoff: hasMaterials,
      needsHalfstuffWriteoff: hasHalfstuffs,
      receiptType,
      saleType,
      materialWriteoffs: [],
      halfstuffWriteoffs: [],
      materialWriteoff,
      halfstuffWriteoff,
      materialWriteoffComplete,
      halfstuffWriteoffComplete,
      materialWriteoffProgress,
      halfstuffWriteoffProgress,
      materialWriteoffDocuments,
      halfstuffWriteoffDocuments,
      costBreakdown,
      receipt,
      sale,
      receiptDocuments,
      saleDocuments,
      receiptProgress,
      saleProgress,
      receiptComplete,
      saleComplete,
      saleAvailability: null,
      saleCostSource: null,
      stockBalance: null,
      stockCostPrice: null,
      stockCostTotal: null,
      stockAsOfDate: null,
      canAdvanceFromStore: advanceBlockers.length === 0,
      advanceBlockers,
      advanceWarnings: orphanInfo.warnings,
      orphanWorks: orphanInfo.orphanWorks,
      allowReceiptWithoutFullWriteoff: !!order.allowReceiptWithoutFullWriteoff,
      canCreateReceipt: false,
      receiptBlockers: [],
      receiptWarnings: [],
    };
  }

  async getStoreWork(
    orderId: number,
    stockAsOfDateMs?: number | null,
  ): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId, {
      include: [OrderPipelineStage],
    });
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    const pipelineStages = order.pipelineStages ?? [];
    const needsReceipt = await this.orderNeedsReceipt(orderId, pipelineStages);
    let receiptType: StoreWorkResponse["receiptType"] = null;
    let saleType: StoreWorkResponse["saleType"] = null;

    if (order.analiticId) {
      try {
        const tmz = await this.resolveTmzType(order.analiticId);
        receiptType = this.receiptDocType(tmz);
        saleType = this.saleDocType(tmz);
      } catch {
        // analitic not set or invalid
      }
    }

    const blockers = await this.getAdvanceBlockers(order);
    const orphanInfo = await this.pipelineService.getOrphanWorkAdvanceInfo(orderId);
    const receiptEligibility = await this.evaluateReceiptEligibility(
      order,
      pipelineStages,
    );
    const hasMaterials = await this.orderHasMaterials(orderId);
    const hasHalfstuffs = await this.orderHasHalfstuffs(orderId);
    const allWriteoffs = await this.getMaterialWriteoffs(orderId);
    const provedMaterialMap = this.aggregateProvedWriteoffs(allWriteoffs, "material");
    const provedHalfstuffMap = this.aggregateProvedWriteoffs(allWriteoffs, "halfstuff");
    const orderCount = Number(order.count || 1);
    const materialWriteoffProgress = hasMaterials
      ? await this.buildMaterialWriteoffProgress(orderId, orderCount, provedMaterialMap)
      : [];
    const halfstuffWriteoffProgress = hasHalfstuffs
      ? await this.buildHalfstuffWriteoffProgress(orderId, orderCount, provedHalfstuffMap)
      : [];
    const materialWriteoffComplete =
      !hasMaterials || this.isWriteoffProgressComplete(materialWriteoffProgress);
    const halfstuffWriteoffComplete =
      !hasHalfstuffs || this.isWriteoffProgressComplete(halfstuffWriteoffProgress);
    const materialWriteoffDocuments = hasMaterials
      ? await this.getStoreWriteoffDocuments(orderId, DocumentType.LeaveMaterial)
      : [];
    const halfstuffWriteoffDocuments = hasHalfstuffs
      ? await this.getStoreWriteoffDocuments(orderId, DocumentType.LeaveHalfstuff)
      : [];
    const materialWriteoff =
      (await this.getDocInfo(order.materialWriteoffDocId)) ??
      materialWriteoffDocuments[materialWriteoffDocuments.length - 1] ??
      null;
    const halfstuffWriteoff =
      (await this.getDocInfo(order.halfstuffWriteoffDocId)) ??
      halfstuffWriteoffDocuments[halfstuffWriteoffDocuments.length - 1] ??
      null;

    const costBreakdown = await this.calculateCostBreakdown(orderId);
    const receiptDocuments = needsReceipt
      ? await this.getStoreReceiptDocuments(orderId)
      : [];
    const saleDocuments =
      order.requiresClientSale !== false
        ? await this.getStoreSaleDocuments(orderId)
        : [];
    const receiptProgress = needsReceipt
      ? this.buildReceiptProgress(
          order,
          costBreakdown.costTotal,
          this.aggregateProvedStoreDocuments(receiptDocuments),
        )
      : null;
    const saleProgress =
      order.requiresClientSale !== false
        ? this.buildSaleProgress(order, this.aggregateProvedSales(saleDocuments))
        : null;
    const receiptComplete =
      receiptProgress != null && this.isReceiptProgressComplete(receiptProgress);
    const saleComplete =
      saleProgress != null && this.isSaleProgressComplete(saleProgress);
    const openReceipt =
      receiptDocuments.find((d) => d.docStatus === DocSTATUS.OPEN) ?? null;
    const openSale =
      saleDocuments.find((d) => d.docStatus === DocSTATUS.OPEN) ?? null;
    const receipt =
      openReceipt ??
      (await this.getDocInfo(order.receiptDocId)) ??
      receiptDocuments[receiptDocuments.length - 1] ??
      null;
    const sale =
      openSale ??
      (await this.getDocInfo(order.saleDocId)) ??
      saleDocuments[saleDocuments.length - 1] ??
      null;

    let saleCostSource: StoreWorkResponse["saleCostSource"] = null;
    let saleAvailability: SaleAvailability | null = null;
    let stockBalance: number | null = null;
    let stockCostPrice: number | null = null;
    let stockCostTotal: number | null = null;
    let stockAsOfDate: number | null = null;
    const enterpriseId = order.enterpriseId != null ? Number(order.enterpriseId) : null;
    if (order.analiticId && enterpriseId && order.requiresClientSale !== false) {
      try {
        const { receiverId: storageId } = await this.resolveSenderReceiver(
          enterpriseId,
        );
        saleAvailability = await this.resolveSaleAvailability(
          order,
          saleDocuments,
          enterpriseId,
          storageId,
          stockAsOfDateMs,
        );
        stockBalance = saleAvailability.availableQty;
        stockAsOfDate = saleAvailability.stockAsOfDate;

        const previewQty =
          saleProgress != null && saleProgress.remainingQty > WRITEOFF_QTY_EPSILON
            ? saleProgress.remainingQty
            : undefined;
        const costResolved = await this.resolveSaleCost(
          order,
          needsReceipt,
          receiptDocuments,
          saleDocuments,
          enterpriseId,
          storageId,
          stockAsOfDateMs,
          previewQty,
        );
        saleCostSource = costResolved.costSource;
        stockCostPrice = costResolved.costPrice;
        stockCostTotal = costResolved.costTotal;
      } catch {
        // analitic not set or invalid
      }
    }

    return {
      orderId,
      requiresReceipt: needsReceipt,
      requiresClientSale: order.requiresClientSale !== false,
      needsMaterialWriteoff: hasMaterials,
      needsHalfstuffWriteoff: hasHalfstuffs,
      receiptType,
      saleType,
      materialWriteoffs: allWriteoffs.filter(
        (w) => w.documentType !== DocumentType.LeaveHalfstuff,
      ),
      halfstuffWriteoffs: allWriteoffs.filter(
        (w) => w.documentType === DocumentType.LeaveHalfstuff,
      ),
      materialWriteoff,
      halfstuffWriteoff,
      materialWriteoffComplete,
      halfstuffWriteoffComplete,
      materialWriteoffProgress,
      halfstuffWriteoffProgress,
      materialWriteoffDocuments,
      halfstuffWriteoffDocuments,
      costBreakdown,
      receipt,
      sale,
      receiptDocuments,
      saleDocuments,
      receiptProgress,
      saleProgress,
      receiptComplete,
      saleComplete,
      saleAvailability,
      saleCostSource,
      stockBalance,
      stockCostPrice,
      stockCostTotal,
      stockAsOfDate,
      canAdvanceFromStore: blockers.length === 0,
      advanceBlockers: blockers,
      advanceWarnings: orphanInfo.warnings,
      orphanWorks: orphanInfo.orphanWorks,
      allowReceiptWithoutFullWriteoff: !!order.allowReceiptWithoutFullWriteoff,
      canCreateReceipt: receiptEligibility.canCreateReceipt,
      receiptBlockers: receiptEligibility.receiptBlockers,
      receiptWarnings: receiptEligibility.receiptWarnings,
    };
  }

  async getWriteoffStocks(
    orderId: number,
    stockAsOfDateMs?: number | null,
  ): Promise<WriteoffStocksResponse> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    const stockAsOfDate = this.resolveStockAsOfDate(stockAsOfDateMs);
    const enterpriseId =
      order.enterpriseId != null ? Number(order.enterpriseId) : null;

    let materialWarehouseId: number | null = null;
    if (enterpriseId) {
      try {
        materialWarehouseId = await this.resolveMaterialStorageId(enterpriseId);
      } catch {
        materialWarehouseId = null;
      }
    }

    const materials: Record<string, WriteoffStockEntry> = {};
    const halfstuffs: Record<string, WriteoffStockEntry> = {};

    if (!materialWarehouseId || !enterpriseId) {
      return { stockAsOfDate, materialWarehouseId, materials, halfstuffs };
    }

    const orderMaterials = await this.orderMaterialsService.findByOrder(orderId);
    const orderHalfstuffs = await this.orderHalfstuffsService.findByOrder(orderId);

    const materialIds = orderMaterials
      .map((m) => Number(m.materialId))
      .filter((id) => id > 0);
    const halfstuffIds = orderHalfstuffs
      .map((h) => Number(h.halfstuffId))
      .filter((id) => id > 0);

    const fetchStock = async (
      schet: Schet,
      itemId: number,
    ): Promise<WriteoffStockEntry> => {
      try {
        const stock = await this.reportsService.getPriceAndBalance({
          schet,
          endDate: stockAsOfDate,
          firstSubcontoId: materialWarehouseId,
          secondSubcontoId: itemId,
          enterpriseId,
        } as any);
        const balance = Number(stock?.balance || 0);
        const price =
          balance > 0 && Number(stock?.price) > 0 ? Number(stock.price) : 0;
        return { balance, price };
      } catch {
        return { balance: 0, price: 0 };
      }
    };

    const materialResults = await this.mapWithConcurrency(
      materialIds,
      async (id) => ({ id, stock: await fetchStock(Schet.S10, id) }),
      10,
    );
    for (const { id, stock } of materialResults) {
      materials[String(id)] = stock;
    }

    const halfstuffResults = await this.mapWithConcurrency(
      halfstuffIds,
      async (id) => ({ id, stock: await fetchStock(Schet.S21, id) }),
      10,
    );
    for (const { id, stock } of halfstuffResults) {
      halfstuffs[String(id)] = stock;
    }

    return { stockAsOfDate, materialWarehouseId, materials, halfstuffs };
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency = 10,
  ): Promise<R[]> {
    if (!items.length) return [];
    const results: R[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(fn));
      results.push(...chunkResults);
    }
    return results;
  }

  private async resolveSenderReceiver(enterpriseId: number) {
    const productStorage =
      await this.referencesService.findProductStorageByEnterpriseId(enterpriseId);
    if (!productStorage) {
      throw new BadRequestException(
        "Не найден склад готовой продукции (STORAGES/STORAGE или COMMON)",
      );
    }
    const productionStorage =
      await this.referencesService.findProductionStorageByEnterpriseId(
        enterpriseId,
      );
    return {
      senderId: Number(productionStorage?.id ?? productStorage.id),
      receiverId: Number(productStorage.id),
    };
  }

  private async resolveMaterialStorageId(enterpriseId: number): Promise<number> {
    const commonStorage =
      await this.referencesService.findCommonStorageByEnterpriseId(enterpriseId);
    if (!commonStorage) {
      throw new BadRequestException(
        "Не найден склад материалов (STORAGES/COMMON)",
      );
    }
    return Number(commonStorage.id);
  }

  private async validateWriteoffMaterialReference(
    materialId: number,
  ): Promise<Reference> {
    const ref = await this.referencesService.getReferenceById(materialId);
    if (!ref) {
      throw new BadRequestException(
        `Материал ${formatTmzUserLabel(null, materialId)} не найден в справочнике`,
      );
    }
    const typeTMZ = ref.refValues?.typeTMZ as TypeTMZ | undefined;
    if (typeTMZ !== TypeTMZ.MATERIAL) {
      const label = formatTmzUserLabel(ref, materialId);
      throw new BadRequestException(
        `Номенклатура ${label} не является материалом (typeTMZ: ${typeTMZ ?? "не задано"})`,
      );
    }
    return ref;
  }

  private async validateWriteoffHalfstuffReference(
    halfstuffId: number,
  ): Promise<Reference> {
    const ref = await this.referencesService.getReferenceById(halfstuffId);
    if (!ref) {
      throw new BadRequestException(
        `Полуфабрикат ${formatTmzUserLabel(null, halfstuffId)} не найден в справочнике`,
      );
    }
    const typeTMZ = ref.refValues?.typeTMZ as TypeTMZ | undefined;
    if (typeTMZ !== TypeTMZ.HALFSTUFF) {
      const label = formatTmzUserLabel(ref, halfstuffId);
      throw new BadRequestException(
        `Номенклатура ${label} не является полуфабрикатом (typeTMZ: ${typeTMZ ?? "не задано"})`,
      );
    }
    return ref;
  }

  private async buildWriteoffTableItems(
    orderId: number,
    lines: StoreMaterialWriteoffLineDto[],
    senderId: number,
    enterpriseId: number,
    docDate: number,
  ) {
    const allWriteoffs = await this.getMaterialWriteoffs(orderId);
    const materialWriteoffs = allWriteoffs.filter((w) =>
      this.isMaterialWriteoffLine(w),
    );
    const provedMap = this.aggregateProvedWriteoffs(allWriteoffs, "material");

    const docTableItems: Array<{
      analiticId: number;
      balance: number;
      count: number;
      price: number;
      total: number;
      costPrice: number;
      costTotal: number;
    }> = [];

    for (const line of lines) {
      const materialId = Number(line.materialId);
      const count = Number(line.count || 0);
      if (count <= 0) continue;

      const ref = await this.validateWriteoffMaterialReference(materialId);
      const label = formatTmzUserLabel(ref, materialId);

      const stock = await this.reportsService.getPriceAndBalance({
        schet: Schet.S10,
        endDate: docDate,
        firstSubcontoId: senderId,
        secondSubcontoId: materialId,
        enterpriseId,
      } as any);

      const balance = Number(stock?.balance || 0);
      const writtenOffInOrder = provedMap.get(materialId)?.count ?? 0;
      const snapshotBalance = getMaxWriteoffSnapshotBalance(
        materialWriteoffs,
        materialId,
      );
      const effectiveBalance = resolveEffectiveWarehouseBalance(
        balance,
        writtenOffInOrder,
        snapshotBalance,
      );

      if (effectiveBalance <= 0) {
        throw new BadRequestException(
          `Нет остатка на складе для материала ${label}`,
        );
      }
      if (count > effectiveBalance + WRITEOFF_QTY_EPSILON) {
        throw new BadRequestException(
          `Количество (${count}) превышает остаток (${effectiveBalance}) для материала ${label}`,
        );
      }
      const price = Number(stock?.price || 0);
      if (price <= 0) {
        throw new BadRequestException(
          `Не удалось рассчитать цену (AVEKO) для материала ${label}`,
        );
      }
      const total = Number((count * price).toFixed(2));

      docTableItems.push({
        analiticId: materialId,
        balance,
        count,
        price,
        total,
        costPrice: 0,
        costTotal: 0,
      });
    }

    return docTableItems;
  }

  private async buildHalfstuffWriteoffTableItems(
    orderId: number,
    lines: StoreHalfstuffWriteoffLineDto[],
    senderId: number,
    enterpriseId: number,
    docDate: number,
  ) {
    const allWriteoffs = await this.getMaterialWriteoffs(orderId);
    const halfstuffWriteoffs = allWriteoffs.filter((w) =>
      this.isHalfstuffWriteoffLine(w),
    );
    const provedMap = this.aggregateProvedWriteoffs(allWriteoffs, "halfstuff");

    const docTableItems: Array<{
      analiticId: number;
      balance: number;
      count: number;
      price: number;
      total: number;
      costPrice: number;
      costTotal: number;
    }> = [];

    for (const line of lines) {
      const halfstuffId = Number(line.halfstuffId);
      const count = Number(line.count || 0);
      if (count <= 0) continue;

      const ref = await this.validateWriteoffHalfstuffReference(halfstuffId);
      const label = formatTmzUserLabel(ref, halfstuffId);

      const stock = await this.reportsService.getPriceAndBalance({
        schet: Schet.S21,
        endDate: docDate,
        firstSubcontoId: senderId,
        secondSubcontoId: halfstuffId,
        enterpriseId,
      } as any);

      const balance = Number(stock?.balance || 0);
      const writtenOffInOrder = provedMap.get(halfstuffId)?.count ?? 0;
      const snapshotBalance = getMaxWriteoffSnapshotBalance(
        halfstuffWriteoffs,
        halfstuffId,
      );
      const effectiveBalance = resolveEffectiveWarehouseBalance(
        balance,
        writtenOffInOrder,
        snapshotBalance,
      );

      if (effectiveBalance <= 0) {
        throw new BadRequestException(
          `Нет остатка на складе для полуфабриката ${label}`,
        );
      }
      if (count > effectiveBalance + WRITEOFF_QTY_EPSILON) {
        throw new BadRequestException(
          `Количество (${count}) превышает остаток (${effectiveBalance}) для полуфабриката ${label}`,
        );
      }
      const price = Number(stock?.price || 0);
      if (price <= 0) {
        throw new BadRequestException(
          `Не удалось рассчитать цену (AVEKO) для полуфабриката ${label}`,
        );
      }
      const total = Number((count * price).toFixed(2));

      docTableItems.push({
        analiticId: halfstuffId,
        balance,
        count,
        price,
        total,
        costPrice: 0,
        costTotal: 0,
      });
    }

    return docTableItems;
  }

  async createMaterialWriteoff(
    orderId: number,
    userId: number,
    lines: StoreMaterialWriteoffLineDto[],
    docDateMs?: number,
  ): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);
    if (order.currentStage !== OrderStageType.STORE) {
      throw new BadRequestException(
        "Списание материалов доступно только на этапе Омбор",
      );
    }
    if (await this.isMaterialWriteoffComplete(order)) {
      throw new BadRequestException("Списание материалов по заказу уже завершено");
    }

    const user = await this.usersService.getUserById(userId);
    if (!user?.enterpriseId) {
      throw new BadRequestException("У пользователя не указана организация");
    }

    const orderCount = Number(order.count || 1);
    await this.validateMaterialWriteoffLinesRemaining(orderId, orderCount, lines);

    const docDate =
      docDateMs != null && Number(docDateMs) > 0 ? Number(docDateMs) : Date.now();
    const senderId = await this.resolveMaterialStorageId(Number(user.enterpriseId));
    const chargeId = await resolveMaterialWriteoffChargeId(
      this.settingsService,
      Number(user.enterpriseId),
    );
    const productForChargeId = order.analiticId
      ? Number(order.analiticId)
      : 0;

    const docTableItems = await this.buildWriteoffTableItems(
      orderId,
      lines,
      senderId,
      Number(user.enterpriseId),
      docDate,
    );

    if (!docTableItems.length) {
      throw new BadRequestException(
        "Укажите количество хотя бы для одного материала",
      );
    }

    const total = docTableItems.reduce(
      (sum, i) => sum + Number(i.total || 0),
      0,
    );
    const count = docTableItems.reduce(
      (sum, i) => sum + Number(i.count || 0),
      0,
    );
    const comment = `Списание материалов по заказу ${order.orderNumber}`;
    const docValuesBase = {
      senderId,
      receiverId: senderId,
      analiticId: chargeId,
      productForChargeId,
      orderId,
      count,
      total,
      comment,
    };

    const existing = await this.findOpenStoreWriteoffDoc(
      orderId,
      DocumentType.LeaveMaterial,
    );

    if (existing) {
      await existing.update({ date: docDate } as any);
      await this.docValuesRepo.update(
        docValuesBase as any,
        { where: { docId: existing.id } },
      );
      await this.docTableItemsRepo.destroy({ where: { docId: existing.id } });
      for (const item of docTableItems) {
        await this.docTableItemsRepo.create({
          docId: existing.id,
          ...item,
        } as any);
      }
      await order.update({ materialWriteoffDocId: Number(existing.id) });
      return this.getStoreWork(orderId);
    }

    const created = await this.documentsService.createDocument(
      {
        date: docDate as any,
        userId,
        userOldId: "",
        enterpriseId: user.enterpriseId,
        documentType: DocumentType.LeaveMaterial,
        docStatus: DocSTATUS.OPEN,
        docValues: docValuesBase as any,
        docTableItems,
      } as any,
      this.usersService,
      this.referencesService,
    );

    await order.update({ materialWriteoffDocId: Number(created.id) });
    return this.getStoreWork(orderId);
  }

  async proveMaterialWriteoff(
    orderId: number,
    docId?: number,
  ): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    let doc: Document | null = null;
    if (docId != null) {
      doc = await this.documentRepo.findByPk(docId, { include: [DocValues] });
      if (
        !doc ||
        doc.documentType !== DocumentType.LeaveMaterial ||
        Number(doc.docValues?.orderId) !== orderId ||
        (doc.docValues?.workId != null && Number(doc.docValues.workId) > 0)
      ) {
        throw new BadRequestException(
          "Документ списания материалов не найден или не относится к заказу",
        );
      }
    } else {
      doc = await this.findOpenStoreWriteoffDoc(orderId, DocumentType.LeaveMaterial);
      if (!doc && order.materialWriteoffDocId) {
        const fallback = await this.documentRepo.findByPk(
          order.materialWriteoffDocId,
          { include: [DocValues] },
        );
        if (
          fallback &&
          fallback.docStatus === DocSTATUS.OPEN &&
          fallback.documentType === DocumentType.LeaveMaterial &&
          (fallback.docValues?.workId == null ||
            Number(fallback.docValues.workId) === 0)
        ) {
          doc = fallback;
        }
      }
    }

    if (!doc || doc.docStatus === DocSTATUS.DELETED) {
      throw new BadRequestException("Черновик списания материалов не найден");
    }
    if (doc.docStatus !== DocSTATUS.PROVEDEN) {
      await this.documentsService.setProvodka(Number(doc.id));
    }
    return this.getStoreWork(orderId);
  }

  async createHalfstuffWriteoff(
    orderId: number,
    userId: number,
    lines: StoreHalfstuffWriteoffLineDto[],
    docDateMs?: number,
  ): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);
    if (order.currentStage !== OrderStageType.STORE) {
      throw new BadRequestException(
        "Списание полуфабрикатов доступно только на этапе Омбор",
      );
    }
    if (await this.isHalfstuffWriteoffComplete(order)) {
      throw new BadRequestException(
        "Списание полуфабрикатов по заказу уже завершено",
      );
    }

    const user = await this.usersService.getUserById(userId);
    if (!user?.enterpriseId) {
      throw new BadRequestException("У пользователя не указана организация");
    }

    const orderCount = Number(order.count || 1);
    await this.validateHalfstuffWriteoffLinesRemaining(orderId, orderCount, lines);

    const docDate = await this.resolveWriteoffDocDate(order, docDateMs);
    const enterpriseId = Number(user.enterpriseId);
    const senderId = await this.resolveMaterialStorageId(enterpriseId);
    const chargeId = await resolveHalfstuffWriteoffChargeId(
      this.settingsService,
      enterpriseId,
    );
    const productForChargeId = order.analiticId
      ? Number(order.analiticId)
      : 0;

    const docTableItems = await this.buildHalfstuffWriteoffTableItems(
      orderId,
      lines,
      senderId,
      enterpriseId,
      docDate,
    );

    if (!docTableItems.length) {
      throw new BadRequestException(
        "Укажите количество хотя бы для одного полуфабриката",
      );
    }

    const total = docTableItems.reduce(
      (sum, i) => sum + Number(i.total || 0),
      0,
    );
    const count = docTableItems.reduce(
      (sum, i) => sum + Number(i.count || 0),
      0,
    );
    const comment = `Списание полуфабрикатов по заказу ${order.orderNumber}`;
    const docValuesBase = {
      senderId,
      receiverId: chargeId,
      analiticId: null,
      productForChargeId,
      orderId,
      count,
      total,
      comment,
    };

    const existing = await this.findOpenStoreWriteoffDoc(
      orderId,
      DocumentType.LeaveHalfstuff,
    );

    if (existing) {
      await existing.update({ date: docDate } as any);
      await this.docValuesRepo.update(docValuesBase as any, {
        where: { docId: existing.id },
      });
      await this.docTableItemsRepo.destroy({ where: { docId: existing.id } });
      for (const item of docTableItems) {
        await this.docTableItemsRepo.create({
          docId: existing.id,
          ...item,
        } as any);
      }
      await order.update({ halfstuffWriteoffDocId: Number(existing.id) });
      return this.getStoreWork(orderId);
    }

    const created = await this.documentsService.createDocument(
      {
        date: docDate as any,
        userId,
        userOldId: "",
        enterpriseId: user.enterpriseId,
        documentType: DocumentType.LeaveHalfstuff,
        docStatus: DocSTATUS.OPEN,
        docValues: docValuesBase as any,
        docTableItems,
      } as any,
      this.usersService,
      this.referencesService,
    );

    await order.update({ halfstuffWriteoffDocId: Number(created.id) });
    return this.getStoreWork(orderId);
  }

  async proveHalfstuffWriteoff(
    orderId: number,
    docId?: number,
  ): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    let doc: Document | null = null;
    if (docId != null) {
      doc = await this.documentRepo.findByPk(docId, { include: [DocValues] });
      if (
        !doc ||
        doc.documentType !== DocumentType.LeaveHalfstuff ||
        Number(doc.docValues?.orderId) !== orderId ||
        (doc.docValues?.workId != null && Number(doc.docValues.workId) > 0)
      ) {
        throw new BadRequestException(
          "Документ списания полуфабрикатов не найден или не относится к заказу",
        );
      }
    } else {
      doc = await this.findOpenStoreWriteoffDoc(orderId, DocumentType.LeaveHalfstuff);
      if (!doc && order.halfstuffWriteoffDocId) {
        const fallback = await this.documentRepo.findByPk(
          order.halfstuffWriteoffDocId,
          { include: [DocValues] },
        );
        if (
          fallback &&
          fallback.docStatus === DocSTATUS.OPEN &&
          fallback.documentType === DocumentType.LeaveHalfstuff &&
          (fallback.docValues?.workId == null ||
            Number(fallback.docValues.workId) === 0)
        ) {
          doc = fallback;
        }
      }
    }

    if (!doc || doc.docStatus === DocSTATUS.DELETED) {
      throw new BadRequestException(
        "Черновик списания полуфабрикатов не найден",
      );
    }
    if (doc.docStatus !== DocSTATUS.PROVEDEN) {
      await this.documentsService.setProvodka(Number(doc.id));
    }
    return this.getStoreWork(orderId);
  }

  private parseStoreWorkHeaderDate(headerDateMs?: number): number | undefined {
    if (
      headerDateMs == null ||
      !Number.isFinite(Number(headerDateMs)) ||
      Number(headerDateMs) <= 0
    ) {
      return undefined;
    }
    return Number(headerDateMs);
  }

  private async resolveWriteoffDocDate(
    order: FurnitureOrder,
    headerDateMs?: number,
  ): Promise<number> {
    const headerDate = this.parseStoreWorkHeaderDate(headerDateMs);
    if (headerDate != null) {
      return headerDate;
    }
    if (order.materialWriteoffDocId) {
      const writeoffDoc = await this.documentRepo.findByPk(
        order.materialWriteoffDocId,
      );
      if (writeoffDoc?.date) {
        return Number(writeoffDoc.date);
      }
    }
    return Date.now();
  }

  private async resolveReceiptDocDate(
    order: FurnitureOrder,
    headerDateMs?: number,
  ): Promise<number> {
    const headerDate = this.parseStoreWorkHeaderDate(headerDateMs);
    if (headerDate != null) {
      return headerDate;
    }
    if (order.materialWriteoffDocId) {
      return this.resolveWriteoffDocDate(order);
    }
    if (order.halfstuffWriteoffDocId) {
      const writeoffDoc = await this.documentRepo.findByPk(
        order.halfstuffWriteoffDocId,
      );
      if (writeoffDoc?.date) {
        return Number(writeoffDoc.date);
      }
    }
    return this.resolveWriteoffDocDate(order, headerDateMs);
  }

  async createReceipt(
    orderId: number,
    userId: number,
    countOverride?: number,
    costTotalOverride?: number,
    docDateMs?: number,
  ): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId, {
      include: [OrderPipelineStage],
    });
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    const receiptEligibility = await this.evaluateReceiptEligibility(order);
    if (!receiptEligibility.canCreateReceipt) {
      throw new BadRequestException(
        receiptEligibility.receiptBlockers.join(". ") ||
          "Невозможно создать приход по заказу",
      );
    }

    const pipelineStages = order.pipelineStages ?? [];
    if (!(await this.orderNeedsReceipt(orderId, pipelineStages))) {
      throw new BadRequestException(MSG_RECEIPT_NOT_REQUIRED);
    }

    const user = await this.usersService.getUserById(userId);
    if (!user?.enterpriseId) {
      throw new BadRequestException("У пользователя не указана организация");
    }

    const tmzType = await this.resolveTmzType(order.analiticId);
    const documentType = this.receiptDocType(tmzType);
    const breakdown = await this.calculateCostBreakdown(orderId);
    const receiptDocuments = await this.getStoreReceiptDocuments(orderId);
    const receiptProgress = this.buildReceiptProgress(
      order,
      breakdown.costTotal,
      this.aggregateProvedStoreDocuments(receiptDocuments),
    );

    const count = Number(countOverride ?? 0);
    if (!Number.isFinite(count) || count <= 0) {
      throw new BadRequestException("Укажите количество для прихода");
    }
    if (count > receiptProgress.remainingQty + WRITEOFF_QTY_EPSILON) {
      throw new BadRequestException(
        `Количество (${count}) превышает остаток к оприходованию (${receiptProgress.remainingQty})`,
      );
    }

    const defaultCost =
      receiptProgress.remainingQty > WRITEOFF_QTY_EPSILON
        ? Number(
            (
              (receiptProgress.remainingCost / receiptProgress.remainingQty) *
              count
            ).toFixed(2),
          )
        : breakdown.costTotal;
    const costTotal =
      costTotalOverride != null && costTotalOverride >= 0
        ? Number(costTotalOverride)
        : defaultCost;
    if (costTotal > receiptProgress.remainingCost + MONEY_EPSILON) {
      throw new BadRequestException(
        `Себестоимость (${costTotal}) превышает остаток (${receiptProgress.remainingCost})`,
      );
    }

    const enterpriseId = Number(user.enterpriseId);
    const commonStorageId = await this.resolveMaterialStorageId(enterpriseId);
    const { receiverId } = await this.resolveSenderReceiver(enterpriseId);
    const docDate = await this.resolveReceiptDocDate(order, docDateMs);
    const productId = order.analiticId ? Number(order.analiticId) : 0;

    const comment = `Приход по заказу ${order.orderNumber}`;
    const docValuesBase = {
      senderId: commonStorageId,
      receiverId,
      analiticId: productId,
      productForChargeId: productId,
      orderId,
      count,
      total: costTotal,
      comment,
    };

    const existing = await this.findOpenStoreOrderDoc(orderId, documentType);

    if (existing) {
      await existing.update({ date: docDate } as any);
      await this.docValuesRepo.update(docValuesBase as any, {
        where: { docId: existing.id },
      });
      await this.docTableItemsRepo.destroy({ where: { docId: existing.id } });
      await order.update({ receiptDocId: Number(existing.id) });
      return this.getStoreWork(orderId);
    }

    const created = await this.documentsService.createDocument(
      {
        date: docDate as any,
        userId,
        userOldId: "",
        enterpriseId: user.enterpriseId,
        documentType,
        docStatus: DocSTATUS.OPEN,
        docValues: docValuesBase as any,
      } as any,
      this.usersService,
      this.referencesService,
    );

    await order.update({ receiptDocId: Number(created.id) });
    return this.getStoreWork(orderId);
  }

  async proveReceipt(
    orderId: number,
    docId?: number,
  ): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    let doc: Document | null = null;
    if (docId != null) {
      doc = await this.documentRepo.findByPk(docId, { include: [DocValues] });
      if (
        !doc ||
        !STORE_RECEIPT_DOC_TYPES.includes(doc.documentType) ||
        Number(doc.docValues?.orderId) !== orderId
      ) {
        throw new BadRequestException(
          "Документ прихода не найден или не относится к заказу",
        );
      }
    } else {
      const tmzType = await this.resolveTmzType(order.analiticId);
      const documentType = this.receiptDocType(tmzType);
      doc = await this.findOpenStoreOrderDoc(orderId, documentType);
      if (!doc && order.receiptDocId) {
        const fallback = await this.documentRepo.findByPk(order.receiptDocId, {
          include: [DocValues],
        });
        if (
          fallback &&
          fallback.docStatus === DocSTATUS.OPEN &&
          STORE_RECEIPT_DOC_TYPES.includes(fallback.documentType) &&
          Number(fallback.docValues?.orderId) === orderId
        ) {
          doc = fallback;
        }
      }
    }

    if (!doc || doc.docStatus === DocSTATUS.DELETED) {
      throw new BadRequestException("Черновик прихода не найден");
    }
    if (doc.docStatus !== DocSTATUS.PROVEDEN) {
      await this.documentsService.setProvodka(Number(doc.id));
    }
    return this.getStoreWork(orderId);
  }

  async createSale(
    orderId: number,
    userId: number,
    countOverride?: number,
    saleTotalOverride?: number,
    docDateMs?: number,
  ): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    if (order.requiresClientSale === false) {
      throw new BadRequestException("Для заказа не требуется отгрузка клиенту");
    }

    const pipelineStages = await this.pipelineStageRepo.findAll({
      where: { orderId },
    });
    const needsReceipt = await this.orderNeedsReceipt(orderId, pipelineStages);
    const saleDocuments = await this.getStoreSaleDocuments(orderId);
    const saleProgress = this.buildSaleProgress(
      order,
      this.aggregateProvedSales(saleDocuments),
    );
    if (this.isSaleProgressComplete(saleProgress)) {
      throw new BadRequestException(MSG_SALE_COMPLETE);
    }

    const user = await this.usersService.getUserById(userId);
    if (!user?.enterpriseId) {
      throw new BadRequestException("У пользователя не указана организация");
    }

    const tmzType = await this.resolveTmzType(order.analiticId);
    const documentType = this.saleDocType(tmzType);
    const count = Number(countOverride ?? 0);
    if (!Number.isFinite(count) || count <= 0) {
      throw new BadRequestException("Укажите количество для отгрузки");
    }

    const orderCount = Number(order.count || 1);
    const orderTotal = Number(order.total || 0);
    const defaultSaleTotal =
      orderCount > 0
        ? Number(((orderTotal / orderCount) * count).toFixed(2))
        : orderTotal;
    const saleTotal =
      saleTotalOverride != null && saleTotalOverride >= 0
        ? Number(saleTotalOverride)
        : defaultSaleTotal;
    if (saleTotal > saleProgress.remainingTotal + MONEY_EPSILON) {
      throw new BadRequestException(
        `Сумма продажи (${saleTotal}) превышает остаток (${saleProgress.remainingTotal})`,
      );
    }

    const salePrice = count > 0 ? Number((saleTotal / count).toFixed(4)) : saleTotal;
    const { receiverId: storageId } = await this.resolveSenderReceiver(
      Number(user.enterpriseId),
    );

    const comment = `Отгрузка по заказу ${order.orderNumber}`;
    const docDate = this.parseStoreWorkHeaderDate(docDateMs) ?? Date.now();
    const receiptDocuments = await this.getStoreReceiptDocuments(orderId);

    const availability = await this.resolveSaleAvailability(
      order,
      saleDocuments,
      Number(user.enterpriseId),
      storageId,
      docDate,
    );
    if (count > availability.availableQty + WRITEOFF_QTY_EPSILON) {
      throw new BadRequestException(
        `Недостаточно для отгрузки: требуется ${count}, доступно ${availability.availableQty} (склад: ${availability.warehouseBalance}, по заказу: ${availability.orderRemainingQty})`,
      );
    }

    const costResolved = await this.resolveSaleCost(
      order,
      needsReceipt,
      receiptDocuments,
      saleDocuments,
      Number(user.enterpriseId),
      storageId,
      docDate,
      count,
    );
    const { costTotal, costPrice } = costResolved;

    const existing = await this.findOpenStoreOrderDoc(orderId, documentType);

    if (existing) {
      await existing.update({ date: docDate } as any);
      await this.docValuesRepo.update(
        {
          senderId: storageId,
          receiverId: Number(order.clientId),
          analiticId: Number(order.analiticId),
          orderId,
          count,
          total: saleTotal,
          comment,
        } as any,
        { where: { docId: existing.id } },
      );
      await this.docTableItemsRepo.destroy({ where: { docId: existing.id } });
      await this.docTableItemsRepo.create({
        docId: existing.id,
        analiticId: Number(order.analiticId),
        count,
        price: salePrice,
        total: saleTotal,
        costPrice,
        costTotal,
        tableType: "income",
        balance: 0,
      } as any);
      await order.update({ saleDocId: Number(existing.id) });
      return this.getStoreWork(orderId);
    }

    const created = await this.documentsService.createDocument(
      {
        date: docDate as any,
        userId,
        userOldId: "",
        enterpriseId: user.enterpriseId,
        documentType,
        docStatus: DocSTATUS.OPEN,
        docValues: {
          senderId: storageId,
          receiverId: Number(order.clientId),
          analiticId: Number(order.analiticId),
          orderId,
          count,
          total: saleTotal,
          comment,
        } as any,
        docTableItems: [
          {
            analiticId: Number(order.analiticId),
            count,
            price: salePrice,
            total: saleTotal,
            costPrice,
            costTotal,
            tableType: "income",
            balance: 0,
          },
        ],
      } as any,
      this.usersService,
      this.referencesService,
    );

    await order.update({ saleDocId: Number(created.id) });
    return this.getStoreWork(orderId);
  }

  async proveSale(orderId: number, docId?: number): Promise<StoreWorkResponse> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);

    let doc: Document | null = null;
    if (docId != null) {
      doc = await this.documentRepo.findByPk(docId, { include: [DocValues] });
      if (
        !doc ||
        !STORE_SALE_DOC_TYPES.includes(doc.documentType) ||
        Number(doc.docValues?.orderId) !== orderId
      ) {
        throw new BadRequestException(
          "Документ отгрузки не найден или не относится к заказу",
        );
      }
    } else {
      const tmzType = await this.resolveTmzType(order.analiticId);
      const documentType = this.saleDocType(tmzType);
      doc = await this.findOpenStoreOrderDoc(orderId, documentType);
      if (!doc && order.saleDocId) {
        const fallback = await this.documentRepo.findByPk(order.saleDocId, {
          include: [DocValues],
        });
        if (
          fallback &&
          fallback.docStatus === DocSTATUS.OPEN &&
          STORE_SALE_DOC_TYPES.includes(fallback.documentType) &&
          Number(fallback.docValues?.orderId) === orderId
        ) {
          doc = fallback;
        }
      }
    }

    if (!doc || doc.docStatus === DocSTATUS.DELETED) {
      throw new BadRequestException("Черновик накладной не найден");
    }
    if (doc.docStatus !== DocSTATUS.PROVEDEN) {
      await this.documentsService.setProvodka(Number(doc.id));
    }
    return this.getStoreWork(orderId);
  }
}
