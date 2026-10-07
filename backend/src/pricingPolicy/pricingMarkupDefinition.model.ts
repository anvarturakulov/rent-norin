import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { PricingMarkupGroup } from "src/interfaces/pricing-policy.interface";
import { Enterprise } from "src/enterprises/enterprise.model";

interface PricingMarkupDefinitionCreationAttrs {
  group: PricingMarkupGroup;
  code: string;
  name: string;
  isSystem?: boolean;
  includesInCost?: boolean;
  sortOrder?: number;
  enterpriseId?: number | null;
  markToDeleted?: boolean;
}

@Table({ tableName: "pricing_markup_definitions" })
export class PricingMarkupDefinition extends Model<
  PricingMarkupDefinition,
  PricingMarkupDefinitionCreationAttrs
> {
  @ApiProperty({ example: 1 })
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ApiProperty({ example: PricingMarkupGroup.BEFORE_COST })
  @Column({ type: DataType.ENUM(...Object.values(PricingMarkupGroup)) })
  group: PricingMarkupGroup;

  @ApiProperty({ example: "DEALER" })
  @Column({ type: DataType.STRING(64), allowNull: false })
  code: string;

  @ApiProperty({ example: "Дилерская наценка" })
  @Column({ type: DataType.STRING(255), allowNull: false })
  name: string;

  @ApiProperty({ example: true })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isSystem: boolean;

  @ApiProperty({ example: true, description: "Включается в расчёт себестоимости" })
  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  includesInCost: boolean;

  @ApiProperty({ example: 10 })
  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  sortOrder: number;

  @ForeignKey(() => Enterprise)
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @BelongsTo(() => Enterprise)
  enterprise?: Enterprise | null;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  markToDeleted: boolean;
}
