import { ApiProperty } from "@nestjs/swagger";

import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";

import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";

import { Reference } from "src/references/reference.model";
import { ProductMaterialNorm } from "src/productNorms/productMaterialNorm.model";

export interface OrderMaterialCreationAttrs {
  orderId: number;

  materialId: number;

  price?: number;

  countPlanned?: number;

  finishedProductQty?: number;

  countInOrder?: number;

  countFact?: number;

  total?: number;
  sourceNormId?: number;
}

@Table({ tableName: "order_materials" })
export class OrderMaterial extends Model<
  OrderMaterial,
  OrderMaterialCreationAttrs
> {
  @ApiProperty({ example: 1, description: "Уникальный идентификатор" })
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => FurnitureOrder)
  @ApiProperty({ example: 1, description: "ID заявки" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  orderId: number;

  @BelongsTo(() => FurnitureOrder)
  order: FurnitureOrder;

  @ForeignKey(() => ProductMaterialNorm)
  @ApiProperty({ required: false, description: "ID строки нормы ТМЗ (снимок)" })
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceNormId?: number;

  @BelongsTo(() => ProductMaterialNorm)
  sourceNorm?: ProductMaterialNorm;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: 20, description: "ID материала (из справочника)" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  materialId: number;

  @BelongsTo(() => Reference)
  material: Reference;

  @ApiProperty({
    example: 15000,
    description: "Цена за единицу материала",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  price?: number;

  @ApiProperty({
    example: 20,
    description: "Плановое количество",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  countPlanned?: number;

  @ApiProperty({
    example: 18,
    description: "Фактически израсходованное количество",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  countFact?: number;

  @ApiProperty({
    example: 5,
    description: "Количество готовой продукции (тираж заказа)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  finishedProductQty?: number;

  @ApiProperty({
    example: 100,
    description: "Количество материала в заказе (на весь тираж)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  countInOrder?: number;

  @ApiProperty({
    example: 300000,
    description: "Сумма по строке материала",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  total?: number;
}
