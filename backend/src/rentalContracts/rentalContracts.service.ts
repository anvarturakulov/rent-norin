import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import {
  TypePartners,
  TypeReference,
} from "src/interfaces/reference.interface";
import { RentalContract } from "./rentalContract.model";
import { CreateRentalContractDto } from "./dto/create-rental-contract.dto";
import { UpdateRentalContractDto } from "./dto/update-rental-contract.dto";
import { nextSequentialYearString } from "src/common/numbering/nextSequentialYearNumber";
import { RentalContractStatus } from "src/interfaces/rental-contract.interface";

@Injectable()
export class RentalContractsService {
  constructor(
    @InjectModel(RentalContract)
    private readonly contractModel: typeof RentalContract,
    @InjectModel(Reference)
    private readonly referenceModel: typeof Reference,
  ) {}

  private async assertPartnerClient(clientId: number): Promise<void> {
    const ref = await this.referenceModel.findByPk(clientId, {
      include: [{ model: RefValues, required: false }],
    });
    if (!ref) {
      throw new BadRequestException("Клиент не найден");
    }
    if (ref.typeReference !== TypeReference.PARTNERS) {
      throw new BadRequestException(
        "Клиент договора должен быть из справочника «Партнёры»",
      );
    }
    if (ref.refValues?.typePartners !== TypePartners.CLIENTS) {
      throw new BadRequestException("Выберите партнёра с типом «Клиенты»");
    }
    if (ref.isFolder) {
      throw new BadRequestException("Нельзя выбрать папку справочника");
    }
  }

  private buildWhere(
    enterpriseId?: number,
    clientId?: number,
    dateStart?: number,
    dateEnd?: number,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (enterpriseId != null) {
      where.enterpriseId = enterpriseId;
    }
    if (clientId != null) {
      where.clientId = clientId;
    }
    const ds = dateStart != null ? Number(dateStart) : NaN;
    const de = dateEnd != null ? Number(dateEnd) : NaN;
    if (Number.isFinite(ds) && Number.isFinite(de)) {
      where.contractDate = { [Op.between]: [ds, de] };
    }
    return where;
  }

  async findAll(
    enterpriseId?: number,
    clientId?: number,
    dateStart?: number,
    dateEnd?: number,
  ): Promise<RentalContract[]> {
    return this.contractModel.findAll({
      where: this.buildWhere(enterpriseId, clientId, dateStart, dateEnd),
      include: [{ model: Reference, as: "client" }],
      order: [["contractDate", "DESC"]],
    });
  }

  async findByClient(clientId: number): Promise<RentalContract[]> {
    return this.contractModel.findAll({
      where: { clientId },
      include: [{ model: Reference, as: "client" }],
      order: [["contractDate", "DESC"]],
    });
  }

  /** Start of local calendar day for ms timestamp. */
  private startOfDayMs(ms: number): number {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /** End of local calendar day for ms timestamp. */
  private endOfDayMs(ms: number): number {
    const d = new Date(ms);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  async findActiveByClient(
    clientId: number,
    asOfMs?: number,
  ): Promise<RentalContract | null> {
    const asOf = asOfMs != null && Number.isFinite(asOfMs) ? asOfMs : Date.now();
    // Day-level window: contract from noon still matches morning doc same day.
    const asOfEnd = this.endOfDayMs(asOf);
    const asOfStart = this.startOfDayMs(asOf);
    const rows = await this.contractModel.findAll({
      where: {
        clientId,
        status: RentalContractStatus.APPROVED,
        contractDate: { [Op.lte]: asOfEnd },
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: asOfStart } }],
      },
      order: [["contractDate", "DESC"]],
      include: [{ model: Reference, as: "client" }],
      limit: 1,
    });
    return rows[0] ?? null;
  }

  async findOne(id: number): Promise<RentalContract> {
    const row = await this.contractModel.findByPk(id, {
      include: [{ model: Reference, as: "client" }],
    });
    if (!row) {
      throw new NotFoundException("Договор аренды не найден");
    }
    return row;
  }

  async previewNextNumber(
    enterpriseId: number | null,
    year: number,
  ): Promise<string> {
    return nextSequentialYearString(
      this.contractModel as any,
      "contractNumber",
      enterpriseId,
      year,
    );
  }

  async create(dto: CreateRentalContractDto): Promise<RentalContract> {
    await this.assertPartnerClient(dto.clientId);
    const year = new Date(Number(dto.contractDate)).getFullYear();
    const provided = (dto.contractNumber ?? "").trim();
    const contractNumber = provided
      ? provided
      : await nextSequentialYearString(
          this.contractModel as any,
          "contractNumber",
          dto.enterpriseId ?? null,
          year,
        );

    const enterpriseId = dto.enterpriseId ?? null;
    const existingNum = await this.contractModel.findOne({
      where:
        enterpriseId != null
          ? { enterpriseId, contractNumber }
          : ({
              contractNumber,
              enterpriseId: { [Op.is]: null },
            } as any),
    });
    if (existingNum) {
      throw new BadRequestException(
        `Договор с номером «${contractNumber}» уже существует`,
      );
    }

    const existingForClient = await this.contractModel.findOne({
      where: { clientId: dto.clientId, contractNumber },
    });
    if (existingForClient) {
      throw new BadRequestException(
        `У клиента уже есть договор «${contractNumber}»`,
      );
    }

    const contract = await this.contractModel.create({
      enterpriseId,
      contractNumber,
      clientId: dto.clientId,
      contractDate: dto.contractDate,
      endDate: dto.endDate ?? null,
      status: dto.status ?? RentalContractStatus.DRAFT,
      comment: dto.comment ?? null,
    } as any);
    return this.findOne(contract.id);
  }

  /**
   * Массовое создание договоров: ошибки по строкам не останавливают пакет.
   */
  async createMany(items: CreateRentalContractDto[]): Promise<{
    created: number;
    skipped: number;
    errors: string[];
    items: Array<{
      clientId: number;
      contractNumber?: string;
      id?: number;
      error?: string;
    }>;
  }> {
    const summary = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
      items: [] as Array<{
        clientId: number;
        contractNumber?: string;
        id?: number;
        error?: string;
      }>,
    };

    for (const dto of items) {
      const label = `${dto.contractNumber ?? "?"} / client ${dto.clientId}`;
      try {
        const contract = await this.create(dto);
        summary.created += 1;
        summary.items.push({
          clientId: dto.clientId,
          contractNumber: contract.contractNumber,
          id: contract.id,
        });
      } catch (err: any) {
        const resp =
          typeof err?.getResponse === "function" ? err.getResponse() : null;
        const message =
          (typeof resp === "string"
            ? resp
            : resp?.message) ||
          err?.message ||
          "Ошибка при создании договора";
        const text = Array.isArray(message)
          ? message.join("; ")
          : String(message);
        summary.skipped += 1;
        summary.errors.push(`${label}: ${text}`);
        summary.items.push({
          clientId: dto.clientId,
          contractNumber: dto.contractNumber,
          error: text,
        });
      }
    }

    return summary;
  }

  async update(
    id: number,
    dto: UpdateRentalContractDto,
  ): Promise<RentalContract> {
    const existing = await this.contractModel.findByPk(id);
    if (!existing) {
      throw new NotFoundException("Договор аренды не найден");
    }
    if (dto.clientId != null) {
      await this.assertPartnerClient(dto.clientId);
    }
    await existing.update({
      enterpriseId:
        dto.enterpriseId !== undefined
          ? dto.enterpriseId ?? null
          : existing.enterpriseId,
      contractNumber:
        dto.contractNumber != null
          ? dto.contractNumber.trim()
          : existing.contractNumber,
      clientId: dto.clientId ?? existing.clientId,
      contractDate: dto.contractDate ?? existing.contractDate,
      endDate:
        dto.endDate !== undefined ? dto.endDate ?? null : existing.endDate,
      status: dto.status ?? existing.status,
      comment:
        dto.comment !== undefined ? dto.comment ?? null : existing.comment,
    } as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.contractModel.findByPk(id);
    if (!existing) {
      throw new NotFoundException("Договор аренды не найден");
    }
    await existing.destroy();
  }

  /**
   * Удалить все договоры аренды (опционально по enterpriseId).
   */
  async removeAll(enterpriseId?: number | null): Promise<{ deleted: number }> {
    const where =
      enterpriseId != null && Number.isFinite(enterpriseId)
        ? { enterpriseId }
        : {};
    const deleted = await this.contractModel.destroy({ where });
    return { deleted };
  }
}
