import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { PricingPolicySnapshot } from "./pricingPolicySnapshot.model";

interface PricingPolicySnapshotValueCreationAttrs {
  snapshotId: bigint | number;
  markupCode: string;
  percentClassA: number;
  percentClassB: number;
  percentClassC: number;
}

@Table({ tableName: "pricing_policy_snapshot_values" })
export class PricingPolicySnapshotValue extends Model<
  PricingPolicySnapshotValue,
  PricingPolicySnapshotValueCreationAttrs
> {
  @ApiProperty({ example: "1" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ForeignKey(() => PricingPolicySnapshot)
  @Column({ type: DataType.BIGINT, allowNull: false })
  snapshotId: bigint;

  @BelongsTo(() => PricingPolicySnapshot, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  snapshot: PricingPolicySnapshot;

  @ApiProperty({ example: "DEALER" })
  @Column({ type: DataType.STRING(64), allowNull: false })
  markupCode: string;

  @ApiProperty({ example: 15 })
  @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
  percentClassA: number;

  @ApiProperty({ example: 20 })
  @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
  percentClassB: number;

  @ApiProperty({ example: 25 })
  @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
  percentClassC: number;
}
