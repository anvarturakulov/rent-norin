import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { OrderHalfstuff } from "./orderHalfstuff.model";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { CreateOrderHalfstuffDto } from "./dto/create-order-halfstuff.dto";

@Injectable()
export class OrderHalfstuffsService {
  constructor(
    @InjectModel(OrderHalfstuff)
    private readonly halfstuffRepo: typeof OrderHalfstuff,
  ) {}

  async create(dto: CreateOrderHalfstuffDto): Promise<OrderHalfstuff> {
    return this.halfstuffRepo.create(dto as any);
  }

  async bulkCreate(
    rows: CreateOrderHalfstuffDto[],
  ): Promise<OrderHalfstuff[]> {
    return this.halfstuffRepo.bulkCreate(rows as any);
  }

  async findByOrder(orderId: number): Promise<OrderHalfstuff[]> {
    return this.halfstuffRepo.findAll({
      where: { orderId },
      include: [
        {
          model: Reference,
          as: "halfstuff",
          include: [{ model: RefValues, required: false }],
        },
      ],
      order: [["id", "ASC"]],
    });
  }

  async addFactConsumption(
    orderId: number,
    halfstuffId: number,
    qty: number,
  ): Promise<void> {
    const record = await this.halfstuffRepo.findOne({
      where: { orderId, halfstuffId },
    });
    if (record) {
      await record.update({ countFact: (record.countFact || 0) + qty });
    }
  }

  async update(
    id: number,
    data: Partial<CreateOrderHalfstuffDto>,
  ): Promise<OrderHalfstuff> {
    const row = await this.halfstuffRepo.findByPk(id);
    if (!row) throw new NotFoundException(`Полуфабрикат ${id} не найден`);
    await row.update(data as any);
    return row.reload();
  }

  async remove(id: number): Promise<void> {
    const row = await this.halfstuffRepo.findByPk(id);
    if (!row) throw new NotFoundException(`Полуфабрикат ${id} не найден`);
    await row.destroy();
  }
}
