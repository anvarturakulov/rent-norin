import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Reference } from "src/references/reference.model";

export interface ProductMaterialNormCreationAttrs {
  referenceId: number;
  lineIndex?: number;
  materialId: number;
  price?: number;
  countPlanned?: number;
  total?: number;
}

@Table({ tableName: "product_material_norms" })
export class ProductMaterialNorm extends Model<
  ProductMaterialNorm,
  ProductMaterialNormCreationAttrs
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
  materialId: number;

  @BelongsTo(() => Reference, "materialId")
  material: Reference;

  @Column({ type: DataType.FLOAT, allowNull: true })
  price?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  countPlanned?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  total?: number;
}
