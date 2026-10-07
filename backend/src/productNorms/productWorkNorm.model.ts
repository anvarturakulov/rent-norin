import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Reference } from "src/references/reference.model";

export interface ProductWorkNormCreationAttrs {
  referenceId: number;
  lineIndex?: number;
  workName: string;
  workArticle?: string;
  unit?: string;
  countInUnit?: number;
  countInOrder?: number;
  timeInUnit?: number;
  timeInOrder?: number;
  salaryInUnit?: number;
  salaryInOrder?: number;
  assignedDeptId?: number;
  workRefId?: number;
  salaryRate?: number;
  hourRate?: number;
}

@Table({ tableName: "product_work_norms" })
export class ProductWorkNorm extends Model<
  ProductWorkNorm,
  ProductWorkNormCreationAttrs
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

  @Column({ type: DataType.STRING, allowNull: false })
  workName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  workArticle?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  unit?: string;

  @Column({ type: DataType.FLOAT, allowNull: true })
  countInUnit?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  countInOrder?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  timeInUnit?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  timeInOrder?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  salaryInUnit?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  salaryInOrder?: number;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: true })
  assignedDeptId?: number;

  @BelongsTo(() => Reference, "assignedDeptId")
  assignedDept?: Reference;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.BIGINT, allowNull: true })
  workRefId?: number;

  @BelongsTo(() => Reference, "workRefId")
  workRef?: Reference;

  @Column({ type: DataType.FLOAT, allowNull: true })
  salaryRate?: number;

  @Column({ type: DataType.FLOAT, allowNull: true })
  hourRate?: number;
}
