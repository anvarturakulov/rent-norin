import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Reference } from "src/references/reference.model";

export interface ProductComponentCreationAttrs {
  parentReferenceId: number;
  componentReferenceId: number;
  qty: number;
}

@Table({ tableName: "product_components" })
export class ProductComponent extends Model<
  ProductComponent,
  ProductComponentCreationAttrs
> {
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  parentReferenceId: number;

  @BelongsTo(() => Reference, "parentReferenceId")
  parent: Reference;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  componentReferenceId: number;

  @BelongsTo(() => Reference, "componentReferenceId")
  component?: Reference;

  @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 1 })
  qty: number;
}
