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
import { User } from "src/users/users.model";

export interface OrderCuttingOutputCreationAttrs {
  orderId: number;
  enterpriseId?: number | null;
  materialId: number;
  length: number;
  width: number;
  quantity: number;
  comment?: string;
  createdByUserId?: number;
}

@Table({ tableName: "order_cutting_outputs" })
export class OrderCuttingOutput extends Model<
  OrderCuttingOutput,
  OrderCuttingOutputCreationAttrs
> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => FurnitureOrder)
  @Column({ type: DataType.BIGINT, allowNull: false })
  orderId: number;

  @BelongsTo(() => FurnitureOrder)
  order: FurnitureOrder;

  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  materialId: number;

  @BelongsTo(() => Reference)
  material: Reference;

  @Column({ type: DataType.FLOAT, allowNull: false })
  length: number;

  @Column({ type: DataType.FLOAT, allowNull: false })
  width: number;

  @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 1 })
  quantity: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  comment?: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: true })
  createdByUserId?: number;

  @BelongsTo(() => User)
  createdByUser?: User;
}
