import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, Transaction } from "sequelize";
import {
  PricingClassPercents,
  PricingMarkupGroup,
  PricingPolicyForDate,
} from "src/interfaces/pricing-policy.interface";
import { PricingMarkupDefinition } from "./pricingMarkupDefinition.model";
import { PricingPolicySnapshot } from "./pricingPolicySnapshot.model";
import { PricingPolicySnapshotValue } from "./pricingPolicySnapshotValue.model";
import { CreateMarkupDefinitionDto } from "./dto/create-markup-definition.dto";
import { UpdateMarkupDefinitionDto } from "./dto/update-markup-definition.dto";
import { CreatePricingSnapshotDto } from "./dto/create-pricing-snapshot.dto";
import { UpdatePricingSnapshotDto } from "./dto/update-pricing-snapshot.dto";
import { SnapshotValueDto } from "./dto/snapshot-value.dto";

@Injectable()
export class PricingPolicyService {
  constructor(
    @InjectModel(PricingMarkupDefinition)
    private readonly definitionRepo: typeof PricingMarkupDefinition,
    @InjectModel(PricingPolicySnapshot)
    private readonly snapshotRepo: typeof PricingPolicySnapshot,
    @InjectModel(PricingPolicySnapshotValue)
    private readonly snapshotValueRepo: typeof PricingPolicySnapshotValue,
  ) {}

  async getDefinitions(
    enterpriseId?: number | null,
  ): Promise<PricingMarkupDefinition[]> {
    const where: Record<string, unknown> = { markToDeleted: false };
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = { [Op.or]: [enterpriseId, null] };
    } else {
      where.enterpriseId = null;
    }
    return this.definitionRepo.findAll({
      where,
      order: [
        ["sortOrder", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async createDefinition(dto: CreateMarkupDefinitionDto) {
    const existing = await this.definitionRepo.findOne({
      where: { code: dto.code, markToDeleted: false, enterpriseId: null },
    });
    if (existing) {
      throw new BadRequestException(`Код ${dto.code} уже используется`);
    }

    const maxOrder = await this.definitionRepo.max("sortOrder", {
      where: { group: PricingMarkupGroup.BEFORE_COST, enterpriseId: null },
    });

    return this.definitionRepo.create({
      group: PricingMarkupGroup.BEFORE_COST,
      code: dto.code,
      name: dto.name,
      isSystem: false,
      includesInCost: dto.includesInCost ?? true,
      sortOrder: dto.sortOrder ?? Number(maxOrder ?? 0) + 10,
      enterpriseId: null,
      markToDeleted: false,
    });
  }

  async updateDefinition(id: number, dto: UpdateMarkupDefinitionDto) {
    const row = await this.definitionRepo.findByPk(id);
    if (!row || row.markToDeleted) {
      throw new NotFoundException("Строка наценки не найдена");
    }
    if (
      dto.includesInCost !== undefined &&
      (row.isSystem || row.group !== PricingMarkupGroup.BEFORE_COST)
    ) {
      throw new BadRequestException(
        "Флаг «включается в себестоимость» можно менять только у несистемных наценок до себестоимости",
      );
    }
    await row.update({
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.includesInCost !== undefined
        ? { includesInCost: dto.includesInCost }
        : {}),
    });
    return row;
  }

  async deleteDefinition(id: number) {
    const row = await this.definitionRepo.findByPk(id);
    if (!row || row.markToDeleted) {
      throw new NotFoundException("Строка наценки не найдена");
    }
    if (row.group !== PricingMarkupGroup.BEFORE_COST) {
      throw new BadRequestException(
        "Удалять можно только наценки группы «до себестоимости»",
      );
    }
    if (row.isSystem) {
      throw new BadRequestException("Системную строку нельзя удалить");
    }
    await row.update({ markToDeleted: true });
    return { deleted: true };
  }

  async listSnapshots(enterpriseId?: number | null) {
    const where = this.buildEnterpriseWhere(enterpriseId);
    const rows = await this.snapshotRepo.findAll({
      where,
      order: [["effectiveDate", "ASC"]],
    });
    return rows;
  }

  async getSnapshotById(
    id: number | bigint | string,
    transaction?: Transaction,
  ) {
    const snapshot = await this.snapshotRepo.findByPk(id, {
      include: [{ model: PricingPolicySnapshotValue, as: "values" }],
      transaction,
    });
    if (!snapshot) {
      throw new NotFoundException("Снимок ценовой политики не найден");
    }
    return this.formatSnapshotResponse(snapshot);
  }

  async createSnapshot(dto: CreatePricingSnapshotDto) {
    const definitions = await this.getDefinitions(dto.enterpriseId ?? null);
    this.validateSnapshotValues(definitions, dto.values);

    const sequelize = this.snapshotRepo.sequelize!;
    return sequelize.transaction(async (transaction) => {
      const snapshot = await this.snapshotRepo.create(
        {
          effectiveDate: BigInt(dto.effectiveDate),
          enterpriseId: dto.enterpriseId ?? null,
          comment: dto.comment ?? null,
        },
        { transaction },
      );
      await this.replaceSnapshotValues(
        snapshot.id,
        dto.values,
        transaction,
      );
      // Читаем в той же транзакции (до commit), иначе findByPk снаружи не видит строку
      return this.getSnapshotById(snapshot.id, transaction);
    });
  }

  async updateSnapshot(id: number, dto: UpdatePricingSnapshotDto) {
    const snapshot = await this.snapshotRepo.findByPk(id);
    if (!snapshot) {
      throw new NotFoundException("Снимок ценовой политики не найден");
    }

    const definitions = await this.getDefinitions(snapshot.enterpriseId);
    if (dto.values) {
      this.validateSnapshotValues(definitions, dto.values);
    }

    const sequelize = this.snapshotRepo.sequelize!;
    return sequelize.transaction(async (transaction) => {
      await snapshot.update(
        {
          ...(dto.effectiveDate !== undefined
            ? { effectiveDate: BigInt(dto.effectiveDate) }
            : {}),
          ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
        },
        { transaction },
      );
      if (dto.values) {
        await this.snapshotValueRepo.destroy({
          where: { snapshotId: snapshot.id },
          transaction,
        });
        await this.replaceSnapshotValues(snapshot.id, dto.values, transaction);
      }
      return this.getSnapshotById(snapshot.id, transaction);
    });
  }

  async deleteSnapshot(id: number) {
    const snapshot = await this.snapshotRepo.findByPk(id);
    if (!snapshot) {
      throw new NotFoundException("Снимок ценовой политики не найден");
    }
    await snapshot.destroy();
    return { deleted: true };
  }

  async getPolicyForDate(
    date: number,
    enterpriseId?: number | null,
  ): Promise<PricingPolicyForDate> {
    const definitions = await this.getDefinitions(enterpriseId ?? null);
    const snapshot =
      (await this.findSnapshotForDate(date, enterpriseId)) ??
      (enterpriseId != null
        ? await this.findSnapshotForDate(date, null)
        : null);

    const values: Record<string, PricingClassPercents> = {};
    if (snapshot?.values?.length) {
      for (const row of snapshot.values) {
        values[row.markupCode] = {
          classA: Number(row.percentClassA),
          classB: Number(row.percentClassB),
          classC: Number(row.percentClassC),
        };
      }
    }

    return {
      effectiveDate: snapshot ? Number(snapshot.effectiveDate) : 0,
      snapshotId: snapshot ? Number(snapshot.id) : null,
      definitions: definitions.map((d) => ({
        id: d.id,
        group: d.group,
        code: d.code,
        name: d.name,
        isSystem: d.isSystem,
        includesInCost: d.includesInCost ?? true,
        sortOrder: d.sortOrder,
        enterpriseId: d.enterpriseId,
      })),
      values,
    };
  }

  private buildEnterpriseWhere(enterpriseId?: number | null) {
    if (enterpriseId !== undefined && enterpriseId !== null) {
      return { enterpriseId: { [Op.or]: [enterpriseId, null] } };
    }
    return { enterpriseId: null };
  }

  private async findSnapshotForDate(
    date: number,
    enterpriseId?: number | null,
  ): Promise<PricingPolicySnapshot | null> {
    const where: Record<string, unknown> = {
      effectiveDate: { [Op.lte]: date },
    };
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    } else {
      where.enterpriseId = null;
    }

    const rows = await this.snapshotRepo.findAll({
      where,
      include: [{ model: PricingPolicySnapshotValue, as: "values" }],
      order: [["effectiveDate", "DESC"]],
      limit: 1,
    });
    return rows[0] ?? null;
  }

  private validateSnapshotValues(
    definitions: PricingMarkupDefinition[],
    values: SnapshotValueDto[],
  ) {
    const activeCodes = new Set(definitions.map((d) => d.code));
    const provided = new Set(values.map((v) => v.markupCode));

    for (const code of activeCodes) {
      if (!provided.has(code)) {
        throw new BadRequestException(
          `Не указаны проценты для наценки: ${code}`,
        );
      }
    }

    for (const v of values) {
      if (!activeCodes.has(v.markupCode)) {
        throw new BadRequestException(`Неизвестный код наценки: ${v.markupCode}`);
      }
    }
  }

  private async replaceSnapshotValues(
    snapshotId: bigint,
    values: SnapshotValueDto[],
    transaction: Transaction,
  ) {
    await this.snapshotValueRepo.bulkCreate(
      values.map((v) => ({
        snapshotId,
        markupCode: v.markupCode,
        percentClassA: v.percentClassA,
        percentClassB: v.percentClassB,
        percentClassC: v.percentClassC,
      })),
      { transaction },
    );
  }

  private formatSnapshotResponse(snapshot: PricingPolicySnapshot) {
    const values: Record<string, PricingClassPercents> = {};
    for (const row of snapshot.values ?? []) {
      values[row.markupCode] = {
        classA: Number(row.percentClassA),
        classB: Number(row.percentClassB),
        classC: Number(row.percentClassC),
      };
    }
    return {
      id: Number(snapshot.id),
      effectiveDate: Number(snapshot.effectiveDate),
      enterpriseId: snapshot.enterpriseId,
      comment: snapshot.comment,
      values,
      valueRows: (snapshot.values ?? []).map((r) => ({
        id: Number(r.id),
        markupCode: r.markupCode,
        percentClassA: Number(r.percentClassA),
        percentClassB: Number(r.percentClassB),
        percentClassC: Number(r.percentClassC),
      })),
    };
  }
}
