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

export interface OrderWorkLogMaterialCreationAttrs {
  logId: number;
  materialId: number;
  consumedQty: number;
  consumedTotal?: number;
  leaveMaterialDocId?: number;
  writeOffStatus?: "NOT_CREATED" | "CREATED" | "FAILED";
}

@Table({ tableName: "order_work_log_materials" })
export class OrderWorkLogMaterial extends Model<
  OrderWorkLogMaterial,
  OrderWorkLogMaterialCreationAttrs
> {
  @ApiProperty({ example: 1, description: "Уникальный идентификатор" })
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => OrderWorkLog)
  @ApiProperty({ example: 1, description: "ID лога операции" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  logId: number;

  @BelongsTo(() => OrderWorkLog)
  log: OrderWorkLog;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: 20, description: "ID материала (из справочника)" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  materialId: number;

  @BelongsTo(() => Reference)
  material: Reference;

  @ApiProperty({ example: 18, description: "Израсходованное количество" })
  @Column({ type: DataType.FLOAT, allowNull: false })
  consumedQty: number;

  @ApiProperty({
    example: 270000,
    description: "Сумма расхода",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  consumedTotal?: number;

  @ApiProperty({
    example: 98765,
    description: "ID автоматически созданного документа LeaveMaterial",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  leaveMaterialDocId?: number;

  @ApiProperty({
    example: "NOT_CREATED",
    description: "Статус списания материала",
    required: false,
  })
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: "NOT_CREATED",
  })
  writeOffStatus?: "NOT_CREATED" | "CREATED" | "FAILED";
}
