import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Reference } from "src/references/reference.model";

export interface ProductProductionRouteCreationAttrs {
  referenceId: number;
  sequence: number;
  deptId: number;
}

@Table({ tableName: "product_production_routes" })
export class ProductProductionRoute extends Model<
  ProductProductionRoute,
  ProductProductionRouteCreationAttrs
> {
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  referenceId: number;

  @BelongsTo(() => Reference)
  reference: Reference;

  @Column({ type: DataType.INTEGER, allowNull: false })
  sequence: number;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  deptId: number;

  @BelongsTo(() => Reference, "deptId")
  dept: Reference;
}
