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
import {
  LEGACY_ORDER_STAGE_VALUES,
  OrderHistoryEventType,
  OrderStageType,
} from "src/interfaces/furniture-order.interface";
import { Reference } from "src/references/reference.model";
import { User } from "src/users/users.model";

export interface OrderStageHistoryCreationAttrs {
  orderId: number;
  eventType: OrderHistoryEventType;
  fromStage?: OrderStageType | null;
  toStage?: OrderStageType | null;
  fromDeptId?: number | null;
  toDeptId?: number | null;
  changedByUserId: number;
  changedAt: number;
  comment?: string;
}

@Table({ tableName: "order_stage_history" })
export class OrderStageHistory extends Model<
  OrderStageHistory,
  OrderStageHistoryCreationAttrs
> {
  private static readonly stageEnumValues = [
    ...Object.values(OrderStageType),
    ...LEGACY_ORDER_STAGE_VALUES,
  ];
  @ApiProperty({ example: 1, description: "Уникальный идентификатор" })
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => FurnitureOrder)
  @ApiProperty({ example: 1, description: "ID заявки" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  orderId: number;

  @BelongsTo(() => FurnitureOrder)
  order: FurnitureOrder;

  @ApiProperty({
    example: "STAGE",
    description: "Тип события истории (STAGE/DEPT)",
  })
  @Column({
    type: DataType.ENUM(...Object.values(OrderHistoryEventType)),
    allowNull: false,
    defaultValue: OrderHistoryEventType.STAGE,
  })
  eventType: OrderHistoryEventType;

  @ApiProperty({
    example: "DRAWING",
    description: "Этап ДО перехода",
    required: false,
  })
  @Column({
    type: DataType.ENUM(...OrderStageHistory.stageEnumValues),
    allowNull: true,
  })
  fromStage?: OrderStageType;

  @ApiProperty({
    example: "TEXNOLOG",
    description: "Этап ПОСЛЕ перехода",
    required: false,
  })
  @Column({
    type: DataType.ENUM(...OrderStageHistory.stageEnumValues),
    allowNull: true,
  })
  toStage?: OrderStageType;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 10,
    description: "ID цеха ДО перехода",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  fromDeptId?: number | null;

  @BelongsTo(() => Reference, "fromDeptId")
  fromDept?: Reference | null;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 12,
    description: "ID цеха ПОСЛЕ перехода",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  toDeptId?: number | null;

  @BelongsTo(() => Reference, "toDeptId")
  toDept?: Reference | null;

  @ForeignKey(() => User)
  @ApiProperty({
    example: 5,
    description: "ID пользователя выполнившего переход",
  })
  @Column({ type: DataType.INTEGER, allowNull: false })
  changedByUserId: number;

  @BelongsTo(() => User)
  changedByUser: User;

  @ApiProperty({ example: 1738368000000, description: "Время перехода (мс)" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  changedAt: number;

  @ApiProperty({
    example: "Клиент одобрил чертежи",
    description: "Комментарий к переходу",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  comment?: string;
}
