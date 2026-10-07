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
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { Reference } from "src/references/reference.model";
import { WorkStatus } from "src/interfaces/furniture-order.interface";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import { ProductWorkNorm } from "src/productNorms/productWorkNorm.model";

export interface OrderWorkCreationAttrs {
  orderId: number;
  /** Порядок строк в заявке (0, 1, 2, …) */
  lineIndex?: number;
  workName: string;
  workArticle?: string;
  unit?: string;
  countInUnit?: number;
  finishedProductQty?: number;
  countInOrder?: number;
  timeInUnit?: number;
  timeInOrder?: number;
  salaryInUnit?: number;
  salaryInOrder?: number;
  assignedDeptId?: number;
  productionQueueId?: number;
  salaryRate?: number;
  hourRate?: number;
  countTotalFact?: number;
  hourTotalFact?: number;
  workStatus?: WorkStatus;
  sourceNormId?: number;
  workRefId?: number;
}

@Table({ tableName: "order_works" })
export class OrderWork extends Model<OrderWork, OrderWorkCreationAttrs> {
  @ApiProperty({ example: 1, description: "Уникальный идентификатор" })
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => FurnitureOrder)
  @ApiProperty({ example: 1, description: "ID заявки" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  orderId: number;

  @BelongsTo(() => FurnitureOrder)
  order: FurnitureOrder;

  @ForeignKey(() => ProductWorkNorm)
  @ApiProperty({ required: false, description: "ID строки нормы ТМЗ (снимок)" })
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceNormId?: number;

  @BelongsTo(() => ProductWorkNorm)
  sourceNorm?: ProductWorkNorm;

  @ApiProperty({
    example: 0,
    description: "Порядок строки в списке работ заявки",
  })
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  lineIndex: number;

  @ApiProperty({ example: "Раскрой МДФ", description: "Название работы" })
  @Column({ type: DataType.STRING, allowNull: false })
  workName: string;

  @ApiProperty({
    example: "RW-001",
    description: "Артикул работы",
    required: false,
  })
  @Column({ type: DataType.STRING, allowNull: true })
  workArticle?: string;

  @ApiProperty({
    example: "шт",
    description: "Единица измерения",
    required: false,
  })
  @Column({ type: DataType.STRING, allowNull: true })
  unit?: string;

  @ApiProperty({ example: 2, description: "Объем в изделии", required: false })
  @Column({ type: DataType.FLOAT, allowNull: true })
  countInUnit?: number;

  @ApiProperty({ example: 6, description: "Объем в заказе", required: false })
  @Column({ type: DataType.FLOAT, allowNull: true })
  countInOrder?: number;

  @ApiProperty({
    example: 3,
    description: "Количество готовой продукции (Микдор)",
    required: false,
  })

  @Column({ type: DataType.FLOAT, allowNull: true })
  finishedProductQty?: number;

  @ApiProperty({
    example: 1.5,
    description: "Трудоемкость в изделии",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  timeInUnit?: number;

  @ApiProperty({
    example: 4.5,
    description: "Трудоемкость в заказе",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  timeInOrder?: number;

  @ApiProperty({
    example: 3000,
    description: "Стоимость в изделии",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  salaryInUnit?: number;

  @ApiProperty({
    example: 9000,
    description: "Стоимость в заказе",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  salaryInOrder?: number;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 10,
    description: "ID назначенного производственного цеха",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  assignedDeptId?: number;

  @BelongsTo(() => Reference, "assignedDeptId")
  assignedDept?: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 5,
    description: "ID работы из справочника WORKS",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  workRefId?: number;

  @BelongsTo(() => Reference, "workRefId")
  workRef?: Reference;

  @ForeignKey(() => OrderProductionQueue)
  @ApiProperty({
    example: 1,
    description: "ID позиции в очереди производства",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  productionQueueId?: number;

  @BelongsTo(() => OrderProductionQueue)
  productionQueue?: OrderProductionQueue;

  //Стоимость нормо-часа
  @ApiProperty({
    example: 2000,
    description: "Ставка ЗП за единицу",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  salaryRate?: number;

  //Норма выработки
  @ApiProperty({
    example: 10000,
    description: "Почасовая ставка",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  hourRate?: number;

  // можеть потом убирем ???? - это неясно
  @ApiProperty({
    example: 18,
    description: "Фактическое количество единиц",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  countTotalFact?: number;

  // будем использовать для фактического учета времени
  @ApiProperty({
    example: 7.5,
    description: "Фактические часы (суммируется из логов)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  hourTotalFact?: number;

  @ApiProperty({ example: "PENDING", description: "Статус работы" })
  @Column({
    type: DataType.ENUM(...Object.values(WorkStatus)),
    defaultValue: WorkStatus.OPEN,
  })
  workStatus: WorkStatus;

  @HasMany(() => OrderWorkLog)
  logs: OrderWorkLog[];

  // Служебные поля ответа для UI (не хранятся в БД)
  canStartByQueue?: boolean;
  queueViewStatus?: "READY" | "WAITING_QUEUE";
  hasMaterialWriteoff?: boolean;
  writeoffDocStatus?:
    | "OPEN"
    | "PENDING"
    | "PROVEDEN"
    | "DELETED"
    | "REJECTED"
    | null;
  materialWriteoffs?: Array<{
    materialId: number;
    materialName?: string;
    count: number;
    total?: number;
    unit?: string;
  }>;
}
