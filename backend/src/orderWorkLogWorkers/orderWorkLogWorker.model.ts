import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import { Reference } from "src/references/reference.model";

export interface OrderWorkLogWorkerCreationAttrs {
  logId: number;
  workerId: number;
  sharePercent: number;
  countFactShare?: number;
  calculatedSalaryShare?: number;
}

@Table({ tableName: "order_work_log_workers" })
export class OrderWorkLogWorker extends Model<
  OrderWorkLogWorker,
  OrderWorkLogWorkerCreationAttrs
> {
  @ApiProperty({ example: 1, description: "Уникальный идентификатор" })
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => OrderWorkLog)
  @ApiProperty({ example: 1, description: "ID work log" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  logId: number;

  @BelongsTo(() => OrderWorkLog)
  log: OrderWorkLog;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: 7, description: "ID работника (из справочника)" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  workerId: number;

  @BelongsTo(() => Reference, "workerId")
  worker: Reference;

  @ApiProperty({ example: 50, description: "Доля сотрудника в процентах" })
  @Column({ type: DataType.FLOAT, allowNull: false })
  sharePercent: number;

  @ApiProperty({
    example: 9,
    required: false,
    description: "Доля фактического количества",
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  countFactShare?: number;

  @ApiProperty({
    example: 18000,
    required: false,
    description: "Начисленная ЗП сотруднику",
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  calculatedSalaryShare?: number;
}
