import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Enterprise } from "./enterprise.model";
import { CreateEnterpriseDto } from "./dto/create-enterprise.dto";
import { UpdateEnterpriseDto } from "./dto/update-enterprise.dto";

@Injectable()
export class EnterprisesService {
  constructor(
    @InjectModel(Enterprise)
    private readonly enterpriseRepository: typeof Enterprise,
  ) {}

  async create(dto: CreateEnterpriseDto): Promise<Enterprise> {
    const exists = await this.enterpriseRepository.findOne({
      where: { code: dto.code },
    });
    if (exists) {
      throw new BadRequestException(
        `Предприятие с кодом ${dto.code} уже существует`,
      );
    }
    return this.enterpriseRepository.create(dto as any);
  }

  async findAll(): Promise<Enterprise[]> {
    return this.enterpriseRepository.findAll({
      where: { markToDeleted: false },
      order: [["id", "ASC"]],
    });
  }

  async findById(id: number): Promise<Enterprise> {
    const enterprise = await this.enterpriseRepository.findByPk(id);
    if (!enterprise) {
      throw new NotFoundException(`Предприятие с id ${id} не найдено`);
    }
    return enterprise;
  }

  async update(id: number, dto: UpdateEnterpriseDto): Promise<Enterprise> {
    const enterprise = await this.findById(id);

    if (dto.code && dto.code !== enterprise.code) {
      const exists = await this.enterpriseRepository.findOne({
        where: { code: dto.code },
      });
      if (exists) {
        throw new BadRequestException(
          `Предприятие с кодом ${dto.code} уже существует`,
        );
      }
    }

    await enterprise.update(dto);
    return enterprise;
  }

  async markToDelete(id: number): Promise<Enterprise> {
    const enterprise = await this.findById(id);
    await enterprise.update({ markToDeleted: true });
    return enterprise.reload();
  }
}
