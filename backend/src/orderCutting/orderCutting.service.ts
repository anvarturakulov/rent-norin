import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { QueryTypes } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { TypeTMZ } from "src/interfaces/reference.interface";
import { OrderCuttingIssue } from "./orderCuttingIssue.model";
import { OrderCuttingOutput } from "./orderCuttingOutput.model";
import { CreateOrderCuttingLineDto } from "./dto/create-order-cutting-line.dto";

export interface CuttingBalanceRow {
  materialId: number;
  length: number;
  width: number;
  remainQty: number;
  material?: {
    id: number;
    name: string;
    article?: string;
  };
}

@Injectable()
export class OrderCuttingService {
  private readonly lineInclude = [
    {
      model: Reference,
      as: "material",
      include: [{ model: RefValues }],
    },
  ];

  constructor(
    @InjectModel(OrderCuttingIssue)
    private readonly issueRepo: typeof OrderCuttingIssue,
    @InjectModel(OrderCuttingOutput)
    private readonly outputRepo: typeof OrderCuttingOutput,
    @InjectModel(FurnitureOrder)
    private readonly orderRepo: typeof FurnitureOrder,
    @InjectModel(Reference)
    private readonly referenceRepo: typeof Reference,
    private readonly sequelize: Sequelize,
  ) {}

  private async resolveOrder(orderId: number): Promise<FurnitureOrder> {
    const order = await this.orderRepo.findByPk(orderId);
    if (!order) throw new NotFoundException(`Заявка ${orderId} не найдена`);
    return order;
  }

  private async assertMaterial(materialId: number): Promise<void> {
    const ref = await this.referenceRepo.findByPk(materialId, {
      include: [{ model: RefValues }],
    });
    if (!ref) {
      throw new BadRequestException(`Материал ${materialId} не найден`);
    }
    const typeTMZ = (ref as any).refValues?.typeTMZ;
    if (typeTMZ && typeTMZ !== TypeTMZ.MATERIAL) {
      throw new BadRequestException("Выбранная позиция не является материалом");
    }
  }

  private buildLinePayload(
    dto: CreateOrderCuttingLineDto,
    enterpriseId?: number | null,
  ) {
    return {
      orderId: dto.orderId,
      enterpriseId: enterpriseId ?? null,
      materialId: dto.materialId,
      length: Number(dto.length),
      width: Number(dto.width),
      quantity: Number(dto.quantity),
      comment: dto.comment,
      createdByUserId: dto.createdByUserId,
    };
  }

  async findIssuesByOrder(orderId: number): Promise<OrderCuttingIssue[]> {
    return this.issueRepo.findAll({
      where: { orderId },
      include: this.lineInclude,
      order: [["id", "ASC"]],
    });
  }

  async findOutputsByOrder(orderId: number): Promise<OrderCuttingOutput[]> {
    return this.outputRepo.findAll({
      where: { orderId },
      include: this.lineInclude,
      order: [["id", "ASC"]],
    });
  }

  async createIssue(dto: CreateOrderCuttingLineDto): Promise<OrderCuttingIssue> {
    const order = await this.resolveOrder(dto.orderId);
    await this.assertMaterial(dto.materialId);
    return this.issueRepo.create(
      this.buildLinePayload(dto, order.enterpriseId) as any,
    );
  }

  async createOutput(
    dto: CreateOrderCuttingLineDto,
  ): Promise<OrderCuttingOutput> {
    const order = await this.resolveOrder(dto.orderId);
    await this.assertMaterial(dto.materialId);
    return this.outputRepo.create(
      this.buildLinePayload(dto, order.enterpriseId) as any,
    );
  }

  async updateIssue(
    id: number,
    dto: Partial<CreateOrderCuttingLineDto>,
  ): Promise<OrderCuttingIssue> {
    const row = await this.issueRepo.findByPk(id);
    if (!row) throw new NotFoundException(`Строка расхода ${id} не найдена`);
    if (dto.materialId != null) await this.assertMaterial(dto.materialId);
    await row.update({
      ...(dto.materialId != null ? { materialId: dto.materialId } : {}),
      ...(dto.length != null ? { length: Number(dto.length) } : {}),
      ...(dto.width != null ? { width: Number(dto.width) } : {}),
      ...(dto.quantity != null ? { quantity: Number(dto.quantity) } : {}),
      ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
    });
    return row.reload({ include: this.lineInclude });
  }

  async updateOutput(
    id: number,
    dto: Partial<CreateOrderCuttingLineDto>,
  ): Promise<OrderCuttingOutput> {
    const row = await this.outputRepo.findByPk(id);
    if (!row) throw new NotFoundException(`Строка прихода ${id} не найдена`);
    if (dto.materialId != null) await this.assertMaterial(dto.materialId);
    await row.update({
      ...(dto.materialId != null ? { materialId: dto.materialId } : {}),
      ...(dto.length != null ? { length: Number(dto.length) } : {}),
      ...(dto.width != null ? { width: Number(dto.width) } : {}),
      ...(dto.quantity != null ? { quantity: Number(dto.quantity) } : {}),
      ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
    });
    return row.reload({ include: this.lineInclude });
  }

  async removeIssue(id: number): Promise<void> {
    const row = await this.issueRepo.findByPk(id);
    if (!row) throw new NotFoundException(`Строка расхода ${id} не найдена`);
    await row.destroy();
  }

  async removeOutput(id: number): Promise<void> {
    const row = await this.outputRepo.findByPk(id);
    if (!row) throw new NotFoundException(`Строка прихода ${id} не найдена`);
    await row.destroy();
  }

  async getBalances(params: {
    enterpriseId: number;
    materialId?: number;
    hideZero?: boolean;
  }): Promise<CuttingBalanceRow[]> {
    const { enterpriseId, materialId, hideZero } = params;
    const materialFilter = materialId
      ? `AND t."materialId" = :materialId`
      : "";
    const havingClause =
      hideZero === false ? "" : `HAVING ABS(SUM(t.delta)) > 0.000001`;

    const rows = await this.sequelize.query<{
      materialId: number;
      length: number;
      width: number;
      remainQty: number;
    }>(
      `
      SELECT
        t."materialId" AS "materialId",
        t.length AS length,
        t.width AS width,
        SUM(t.delta)::float AS "remainQty"
      FROM (
        SELECT "materialId", length, width, quantity AS delta
        FROM order_cutting_outputs
        WHERE "enterpriseId" = :enterpriseId
        UNION ALL
        SELECT "materialId", length, width, -quantity AS delta
        FROM order_cutting_issues
        WHERE "enterpriseId" = :enterpriseId
        UNION ALL
        SELECT
          rv."referenceId" AS "materialId",
          rv.height::float AS length,
          rv.width::float AS width,
          dti.count::float AS delta
        FROM doctableitems dti
        JOIN documents d ON d.id = dti."docId"
        JOIN refvalues rv ON rv."referenceId" = dti."analiticId"
        WHERE d."documentType" = 'ComeMaterial'
          AND d."docStatus" = 'PROVEDEN'
          AND d."enterpriseId" = :enterpriseId
          AND rv."isSheetMaterial" = true
          AND rv.height IS NOT NULL
          AND rv.width IS NOT NULL
      ) t
      WHERE 1=1 ${materialFilter}
      GROUP BY t."materialId", t.length, t.width
      ${havingClause}
      ORDER BY t."materialId", t.length, t.width
      `,
      {
        replacements: { enterpriseId, materialId },
        type: QueryTypes.SELECT,
      },
    );

    const materialIds = [...new Set(rows.map((r) => Number(r.materialId)))];
    const materials =
      materialIds.length > 0
        ? await this.referenceRepo.findAll({
            where: { id: materialIds },
            include: [{ model: RefValues }],
          })
        : [];
    const materialById = new Map(materials.map((m) => [m.id, m]));

    return rows.map((r) => {
      const mat = materialById.get(Number(r.materialId));
      return {
        materialId: Number(r.materialId),
        length: Number(r.length),
        width: Number(r.width),
        remainQty: Number(r.remainQty),
        material: mat
          ? {
              id: mat.id,
              name: (mat as any).name ?? "",
              article: (mat as any).refValues?.article,
            }
          : undefined,
      };
    });
  }
}
