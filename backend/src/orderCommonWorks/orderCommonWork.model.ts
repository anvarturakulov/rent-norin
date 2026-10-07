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
import { ProductCommonWorkNorm } from "src/productNorms/productCommonWorkNorm.model";

export interface OrderCommonWorkCreationAttrs {
  orderId: number;
  lineIndex?: number;
  commonWorkRefId?: number;
  workName: string;
  unit?: string;
  quantity?: number;
  price?: number;
  amount?: number;
  quantityInOrder?: number;
  amountInOrder?: number;
  selected?: boolean;
  sourceNormId?: number;
}

@Table({ tableName: "order_common_works" })
export class OrderCommonWork extends Model<
  OrderCommonWork,
  OrderCommonWorkCreationAttrs
> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => FurnitureOrder)
  @Column({ type: DataType.BIGINT, allowNull: false })
  orderId: number;

  @BelongsTo(() => FurnitureOrder)
  order: FurnitureOrder;

  @ForeignKey(() => ProductCommonWorkNorm)
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceNormId?: number;

  @BelongsTo(() => ProductCommonWorkNorm)
  sourceNorm?: ProductCommonWorkNorm;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  lineIndex: number;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: true })
  commonWorkRefId?: number;

  @BelongsTo(() => Reference, "commonWorkRefId")
  commonWorkRef?: Reference;

  @Column({ type: DataType.STRING, allowNull: false })
  workName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  unit?: string;

  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  quantity?: number;

  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  price?: number;

  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  amount?: number;

  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  quantityInOrder?: number;

  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  amountInOrder?: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  selected: boolean;
}
