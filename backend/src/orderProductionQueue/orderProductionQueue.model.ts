import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from "sequelize-typescript";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { Reference } from "src/references/reference.model";
import { QueueStatus } from "src/interfaces/furniture-order.interface";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { ProductProductionRoute } from "src/productNorms/productProductionRoute.model";

export interface OrderProductionQueueCreationAttrs {
  orderId: number;
  deptId: number;
  sequence: number;
  status?: QueueStatus;
  startedAt?: number;
  completedAt?: number;
  sourceRouteId?: number;
}

@Table({ tableName: "order_production_queues" })
export class OrderProductionQueue extends Model<
  OrderProductionQueue,
  OrderProductionQueueCreationAttrs
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

  @ForeignKey(() => ProductProductionRoute)
  @ApiProperty({ required: false, description: "ID маршрута ТМЗ (снимок)" })
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceRouteId?: number;

  @BelongsTo(() => ProductProductionRoute)
  sourceRoute?: ProductProductionRoute;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 10,
    description: "ID производственного цеха (из справочника)",
  })
  @Column({ type: DataType.INTEGER, allowNull: false })
  deptId: number;

  @BelongsTo(() => Reference)
  dept: Reference;

  @ApiProperty({ example: 1, description: "Порядковый номер цеха в очереди" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  sequence: number;

  @ApiProperty({ example: "PENDING", description: "Статус цеха в очереди" })
  @Column({
    type: DataType.ENUM(...Object.values(QueueStatus)),
    defaultValue: QueueStatus.PENDING,
  })
  status: QueueStatus;

  @ApiProperty({
    example: 1738368000000,
    description: "Дата начала работы цеха (мс)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  startedAt?: number;

  @ApiProperty({
    example: 1738454400000,
    description: "Дата завершения работы цеха (мс)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  completedAt?: number;

  @HasMany(() => OrderWork, "productionQueueId")
  works: OrderWork[];
}
