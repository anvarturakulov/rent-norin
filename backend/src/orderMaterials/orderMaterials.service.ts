import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { OrderMaterial } from "./orderMaterial.model";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { CreateOrderMaterialDto } from "./dto/create-order-material.dto";

@Injectable()
export class OrderMaterialsService {
  constructor(
    @InjectModel(OrderMaterial)
    private readonly materialRepo: typeof OrderMaterial,
  ) {}

  async create(dto: CreateOrderMaterialDto): Promise<OrderMaterial> {
    return this.materialRepo.create(dto as any);
  }

  async bulkCreate(
    materials: CreateOrderMaterialDto[],
  ): Promise<OrderMaterial[]> {
    return this.materialRepo.bulkCreate(materials as any);
  }

  async findByOrder(orderId: number): Promise<OrderMaterial[]> {
    return this.materialRepo.findAll({
      where: { orderId },
      include: [
        {
          model: Reference,
          as: "material",
          include: [{ model: RefValues, required: false }],
        },
      ],
      order: [["id", "ASC"]],
    });
  }

  async addFactConsumption(
    orderId: number,
    materialId: number,
    qty: number,
  ): Promise<void> {
    const record = await this.materialRepo.findOne({
      where: { orderId, materialId },
    });
    if (record) {
      await record.update({ countFact: (record.countFact || 0) + qty });
    }
  }

  async update(
    id: number,
    data: Partial<CreateOrderMaterialDto>,
  ): Promise<OrderMaterial> {
    const mat = await this.materialRepo.findByPk(id);
    if (!mat) throw new NotFoundException(`Материал ${id} не найден`);
    await mat.update(data as any);
    return mat.reload();
  }

  async remove(id: number): Promise<void> {
    const mat = await this.materialRepo.findByPk(id);
    if (!mat) throw new NotFoundException(`Материал ${id} не найден`);
    await mat.destroy();
  }
}
