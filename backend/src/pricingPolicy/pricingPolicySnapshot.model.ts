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
import { PricingPolicySnapshotValue } from "./pricingPolicySnapshotValue.model";

interface PricingPolicySnapshotCreationAttrs {
  effectiveDate: bigint | number;
  enterpriseId?: number | null;
  comment?: string | null;
}

@Table({ tableName: "pricing_policy_snapshots" })
export class PricingPolicySnapshot extends Model<
  PricingPolicySnapshot,
  PricingPolicySnapshotCreationAttrs
> {
  @ApiProperty({ example: "1" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ApiProperty({ example: "1738368000000" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  effectiveDate: bigint;

  @ForeignKey(() => Enterprise)
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @BelongsTo(() => Enterprise)
  enterprise?: Enterprise | null;

  @ApiProperty({ example: "Новая политика с 2026" })
  @Column({ type: DataType.STRING(500), allowNull: true })
  comment?: string | null;

  @HasMany(() => PricingPolicySnapshotValue, {
    foreignKey: "snapshotId",
    as: "values",
  })
  values?: PricingPolicySnapshotValue[];
}
