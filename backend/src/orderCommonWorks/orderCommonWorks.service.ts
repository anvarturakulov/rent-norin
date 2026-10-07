import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { OrderCommonWork } from "./orderCommonWork.model";
import { CreateOrderCommonWorkDto } from "./dto/create-order-common-work.dto";

@Injectable()
export class OrderCommonWorksService {
  constructor(
    @InjectModel(OrderCommonWork)
    private readonly repo: typeof OrderCommonWork,
  ) {}

  async create(dto: CreateOrderCommonWorkDto): Promise<OrderCommonWork> {
    return this.repo.create(dto as any);
  }

  async findByOrder(orderId: number): Promise<OrderCommonWork[]> {
    return this.repo.findAll({
      where: { orderId },
      order: [
        ["lineIndex", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async update(
    id: number,
    data: Partial<CreateOrderCommonWorkDto>,
  ): Promise<OrderCommonWork> {
    const row = await this.repo.findByPk(id);
    if (!row) throw new NotFoundException(`Общая работа ${id} не найдена`);
    await row.update(data as any);
    return row.reload();
  }

  async remove(id: number): Promise<void> {
    const row = await this.repo.findByPk(id);
    if (!row) throw new NotFoundException(`Общая работа ${id} не найдена`);
    await row.destroy();
  }

  async replaceForOrder(
    orderId: number,
    rows: CreateOrderCommonWorkDto[],
  ): Promise<OrderCommonWork[]> {
    await this.repo.destroy({ where: { orderId } });
    if (!rows.length) return [];
    return this.repo.bulkCreate(
      rows.map((r, i) => ({
        ...r,
        orderId,
        lineIndex: r.lineIndex ?? i,
      })) as any,
    );
  }
}
