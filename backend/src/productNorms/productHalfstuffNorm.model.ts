import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Reference } from "src/references/reference.model";

export interface ProductHalfstuffNormCreationAttrs {
  referenceId: number;
  lineIndex?: number;
  halfstuffId: number;
  price?: number;
  countPlanned?: number;
  total?: number;
}

@Table({ tableName: "product_halfstuff_norms" })
export class ProductHalfstuffNorm extends Model<
  ProductHalfstuffNorm,
  ProductHalfstuffNormCreationAttrs
> {
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  referenceId: number;

  @BelongsTo(() => Reference)
  reference: Reference;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  lineIndex: number;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  halfstuffId: number;

  @BelongsTo(() => Reference, "halfstuffId")
  halfstuff: Reference;

  @Column({ type: DataType.FLOAT, allowNull: true })
  price?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  countPlanned?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  total?: number;
}
