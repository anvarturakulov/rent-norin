import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { SubleaseToolOpenBatch } from "./subleaseToolOpenBatch.model";

export type SubleaseToolBatchConsumptionTableType = "return";

export interface SubleaseToolBatchConsumptionCreationAttrs {
  receiveDocId: number;
  receiveTableItemId?: number | null;
  batchId: number;
  qty: number;
  tableType: SubleaseToolBatchConsumptionTableType;
}

@Table({ tableName: "sublease_tool_batch_consumptions" })
export class SubleaseToolBatchConsumption extends Model<
  SubleaseToolBatchConsumption,
  SubleaseToolBatchConsumptionCreationAttrs
> {
  @ApiProperty()
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @Column({ type: DataType.BIGINT, allowNull: false })
  receiveDocId: number;

  @Column({ type: DataType.BIGINT, allowNull: true })
  receiveTableItemId?: number | null;

  @ForeignKey(() => SubleaseToolOpenBatch)
  @Column({ type: DataType.BIGINT, allowNull: false })
  batchId: number;

  @BelongsTo(() => SubleaseToolOpenBatch)
  batch: SubleaseToolOpenBatch;

  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  qty: number;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: "return" })
  tableType: SubleaseToolBatchConsumptionTableType;
}
