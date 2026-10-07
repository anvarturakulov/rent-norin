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
import { OrderWork } from "src/orderWorks/orderWork.model";
import { Reference } from "src/references/reference.model";
import { LogStatus } from "src/interfaces/furniture-order.interface";
import { OrderWorkLogMaterial } from "src/orderWorkLogMaterials/orderWorkLogMaterial.model";
import { OrderWorkLogWorker } from "src/orderWorkLogWorkers/orderWorkLogWorker.model";

export interface OrderWorkLogCreationAttrs {
  orderId: number;
  workId: number;
  workerId: number;
  date: number;
  startedAt?: number;
  finishedAt?: number;
  status?: LogStatus;
  countFact?: number;
  calculatedSalary?: number;
  notes?: string;
  withoutMaterials?: boolean;
  hoursSpent?: number;
}

@Table({ tableName: "order_work_logs" })
export class OrderWorkLog extends Model<
  OrderWorkLog,
  OrderWorkLogCreationAttrs
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

  @ForeignKey(() => OrderWork)
  @ApiProperty({ example: 1, description: "ID работы" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  workId: number;

  @BelongsTo(() => OrderWork)
  work: OrderWork;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: 7, description: "ID работника (из справочника)" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  workerId: number;

  @BelongsTo(() => Reference)
  worker: Reference;

  @ApiProperty({ example: 1738368000000, description: "Дата операции (мс)" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  date: number;

  @ApiProperty({
    example: 1738368000000,
    description: "Время начала (мс)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  startedAt?: number;

  @ApiProperty({
    example: 1738396800000,
    description: "Время завершения (мс)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  finishedAt?: number;

  @ApiProperty({ example: "STARTED", description: "Статус операции" })
  @Column({
    type: DataType.ENUM(...Object.values(LogStatus)),
    defaultValue: LogStatus.STARTED,
  })
  status: LogStatus;

  @ApiProperty({
    example: 18,
    description: "Фактическое количество за эту сессию",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  countFact?: number;

  @ApiProperty({
    example: 36000,
    description: "Рассчитанная ЗП = salaryRate × countFact",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  calculatedSalary?: number;

  @ApiProperty({
    example: "Небольшие дефекты на 2 листах",
    description: "Заметки",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  notes?: string;

  @ApiProperty({
    example: false,
    description: "Завершена ли работа без списания материалов",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  withoutMaterials?: boolean;

  @ApiProperty({
    example: 1.5,
    description: "Затраченные часы в сессии",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  hoursSpent?: number;

  @HasMany(() => OrderWorkLogMaterial)
  materials: OrderWorkLogMaterial[];

  @HasMany(() => OrderWorkLogWorker)
  participants: OrderWorkLogWorker[];
}
