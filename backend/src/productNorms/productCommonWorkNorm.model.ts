import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Reference } from "src/references/reference.model";

export interface ProductCommonWorkNormCreationAttrs {
  referenceId: number;
  lineIndex?: number;
  commonWorkRefId?: number;
  workName: string;
  unit?: string;
  quantity?: number;
  price?: number;
  amount?: number;
  selected?: boolean;
}

@Table({ tableName: "product_common_work_norms" })
export class ProductCommonWorkNorm extends Model<
  ProductCommonWorkNorm,
  ProductCommonWorkNormCreationAttrs
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
  @Column({ type: DataType.INTEGER, allowNull: true })
  commonWorkRefId?: number;

  @BelongsTo(() => Reference, "commonWorkRefId")
  commonWorkRef?: Reference;

  @Column({ type: DataType.STRING, allowNull: false })
  workName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  unit?: string;

  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  quantity?: number;

  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  price?: number;

  @Column({ type: DataType.FLOAT, allowNull: true, defaultValue: 0 })
  amount?: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  selected: boolean;
}
