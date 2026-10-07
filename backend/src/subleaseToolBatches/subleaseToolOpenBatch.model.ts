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
import { Enterprise } from "src/enterprises/enterprise.model";
import { Reference } from "src/references/reference.model";
import { SubleaseToolBatchConsumption } from "./subleaseToolBatchConsumption.model";

export interface SubleaseToolOpenBatchCreationAttrs {
  enterpriseId: number;
  partnerId: number;
  partnerStorageId: number;
  clientId: number;
  transferDocId: number;
  transferTableItemId?: number | null;
  toolId: number;
  initialQty: number;
  openQty: number;
  settlementDate: number;
  hourlyTariff?: number;
  partnerHourlyTariff?: number;
}

@Table({ tableName: "sublease_tool_open_batches" })
export class SubleaseToolOpenBatch extends Model<
  SubleaseToolOpenBatch,
  SubleaseToolOpenBatchCreationAttrs
> {
  @ApiProperty()
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Enterprise)
  @Column({ type: DataType.INTEGER, allowNull: false })
  enterpriseId: number;

  @BelongsTo(() => Enterprise)
  enterprise: Enterprise;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  partnerId: number;

  @BelongsTo(() => Reference, "partnerId")
  partner: Reference;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  partnerStorageId: number;

  @BelongsTo(() => Reference, "partnerStorageId")
  partnerStorage: Reference;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  clientId: number;

  @BelongsTo(() => Reference, "clientId")
  client: Reference;

  @Column({ type: DataType.BIGINT, allowNull: false })
  transferDocId: number;

  @Column({ type: DataType.BIGINT, allowNull: true })
  transferTableItemId?: number | null;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  toolId: number;

  @BelongsTo(() => Reference, "toolId")
  tool: Reference;

  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  initialQty: number;

  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  openQty: number;

  @Column({ type: DataType.BIGINT, allowNull: false })
  settlementDate: number;

  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  hourlyTariff: number;

  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  partnerHourlyTariff: number;

  @HasMany(() => SubleaseToolBatchConsumption)
  consumptions: SubleaseToolBatchConsumption[];
}
