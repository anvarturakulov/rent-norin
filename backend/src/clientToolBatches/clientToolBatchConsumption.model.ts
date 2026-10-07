import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { ClientToolOpenBatch } from "./clientToolOpenBatch.model";

export type ClientToolBatchConsumptionTableType = "return" | "brak" | "sale";

export interface ClientToolBatchConsumptionCreationAttrs {
  receiveDocId: number;
  receiveTableItemId?: number | null;
  batchId: number;
  qty: number;
  tableType: ClientToolBatchConsumptionTableType;
}

@Table({ tableName: "client_tool_batch_consumptions" })
export class ClientToolBatchConsumption extends Model<
  ClientToolBatchConsumption,
  ClientToolBatchConsumptionCreationAttrs
> {
  @ApiProperty()
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @Column({ type: DataType.BIGINT, allowNull: false })
  receiveDocId: number;

  @Column({ type: DataType.BIGINT, allowNull: true })
  receiveTableItemId?: number | null;

  @ForeignKey(() => ClientToolOpenBatch)
  @Column({ type: DataType.BIGINT, allowNull: false })
  batchId: number;

  @BelongsTo(() => ClientToolOpenBatch)
  batch: ClientToolOpenBatch;

  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  qty: number;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: "return" })
  tableType: ClientToolBatchConsumptionTableType;
}
