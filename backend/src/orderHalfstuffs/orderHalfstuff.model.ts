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
import { ProductHalfstuffNorm } from "src/productNorms/productHalfstuffNorm.model";

export interface OrderHalfstuffCreationAttrs {
  orderId: number;

  halfstuffId: number;

  price?: number;

  countPlanned?: number;

  finishedProductQty?: number;

  countInOrder?: number;

  countFact?: number;

  total?: number;
  sourceNormId?: number;
}

@Table({ tableName: "order_halfstuffs" })
export class OrderHalfstuff extends Model<
  OrderHalfstuff,
  OrderHalfstuffCreationAttrs
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

  @ForeignKey(() => ProductHalfstuffNorm)
  @ApiProperty({ required: false, description: "ID строки нормы ТМЗ (снимок)" })
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceNormId?: number;

  @BelongsTo(() => ProductHalfstuffNorm)
  sourceNorm?: ProductHalfstuffNorm;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: 20, description: "ID полуфабриката (из справочника)" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  halfstuffId: number;

  @BelongsTo(() => Reference, "halfstuffId")
  halfstuff: Reference;

  @ApiProperty({
    example: 15000,
    description: "Цена за единицу полуфабриката",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  price?: number;

  @ApiProperty({
    example: 2,
    description: "Плановое количество на 1 ГП",
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
    example: 10,
    description: "Количество полуфабриката в заказе (на весь тираж)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  countInOrder?: number;

  @ApiProperty({
    example: 300000,
    description: "Сумма по строке",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  total?: number;
}
