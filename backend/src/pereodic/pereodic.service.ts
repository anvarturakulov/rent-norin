import { Injectable } from "@nestjs/common";
import { Pereodic } from "./pereodic.model";
import { InjectConnection } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { InjectModel } from "@nestjs/sequelize";
import { UpdateCreatePereodicDto } from "./dto/updateCreatePereodic.dto";

@Injectable()
export class PereodicService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Pereodic) private pereodicRepository: typeof Pereodic,
  ) {
    this.sequelize = sequelize;
  }

  async getAllPereodicsByValueName(
    referenceId: number,
    valueName: string,
    enterpriseId?: number | null,
  ) {
    const where: any = {
      referenceId,
      name: valueName,
    };

    // Добавляем фильтр по enterpriseId если передан
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    } else {
      // Если enterpriseId не передан, показываем только записи с null enterpriseId (общие)
      where.enterpriseId = null;
    }

    const pereodics = await this.pereodicRepository.findAll({
      where,
    });
    return pereodics;
  }

  private async lookupValueForDate(
    referenceId: number,
    valueName: string,
    date: number,
    enterpriseId: number | null,
  ): Promise<number> {
    const where: any = {
      referenceId,
      name: valueName,
      enterpriseId,
    };

    let pereodics = await this.pereodicRepository.findAll({ where });
    pereodics = pereodics
      .sort((a: Pereodic, b: Pereodic) => Number(a.date) - Number(b.date))
      .filter((pereodic) => pereodic.date <= date);
    if (pereodics.length > 0) {
      return Number(pereodics[pereodics.length - 1].value) || 0;
    }
    return 0;
  }

  async getPeredicValueForDate(
    referenceId: number,
    valueName: string,
    date: number,
    enterpriseId?: number | null,
  ) {
    const scopedEnterpriseId =
      enterpriseId !== undefined && enterpriseId !== null ? enterpriseId : null;

    const value = await this.lookupValueForDate(
      referenceId,
      valueName,
      date,
      scopedEnterpriseId,
    );
    if (value > 0) return value;

    // Общие записи (enterpriseId = null), если по предприятию ничего не нашли
    if (scopedEnterpriseId != null) {
      return this.lookupValueForDate(referenceId, valueName, date, null);
    }

    return 0;
  }

  async deletePereodicById(id: number) {
    const pereodic = await this.pereodicRepository.findByPk(id);
    if (!pereodic) {
      return null;
    }
    await pereodic.destroy();
    return pereodic;
  }

  async getPereodicById(id: number) {
    const pereodic = await this.pereodicRepository.findByPk(id);
    if (!pereodic) {
      return null;
    }
    return pereodic;
  }

  async updatePereodicById(id: number, dto: UpdateCreatePereodicDto) {
    const pereodic = await this.pereodicRepository.findByPk(id);
    if (!pereodic) {
      return null;
    }
    await pereodic.update({ ...dto });
    return pereodic;
  }

  async createPereodic(dto: UpdateCreatePereodicDto) {
    const pereodic = await this.pereodicRepository.create(dto);
    return pereodic;
  }
}
