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
  OrderStageType,
  PipelineStatus,
} from "src/interfaces/furniture-order.interface";
import { User } from "src/users/users.model";

export interface OrderPipelineStageCreationAttrs {
  orderId: number;
  stageName: OrderStageType;
  sequence: number;
  status?: PipelineStatus;
  startedAt?: number;
  completedAt?: number;
  completedByUserId?: number;
}

@Table({ tableName: "order_pipeline_stages" })
export class OrderPipelineStage extends Model<
  OrderPipelineStage,
  OrderPipelineStageCreationAttrs
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

  @ApiProperty({ example: "DRAWING", description: "Название этапа" })
  @Column({
    type: DataType.ENUM(...OrderPipelineStage.stageEnumValues),
    allowNull: false,
  })
  stageName: OrderStageType;

  @ApiProperty({ example: 1, description: "Порядковый номер этапа в маршруте" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  sequence: number;

  @ApiProperty({ example: "PENDING", description: "Статус этапа" })
  @Column({
    type: DataType.ENUM(...Object.values(PipelineStatus)),
    defaultValue: PipelineStatus.PENDING,
  })
  status: PipelineStatus;

  @ApiProperty({
    example: 1738368000000,
    description: "Дата начала этапа (мс)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  startedAt?: number;

  @ApiProperty({
    example: 1738454400000,
    description: "Дата завершения этапа (мс)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  completedAt?: number;

  @ForeignKey(() => User)
  @ApiProperty({
    example: 5,
    description: "ID пользователя завершившего этап",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  completedByUserId?: number;

  @BelongsTo(() => User)
  completedByUser?: User;
}
