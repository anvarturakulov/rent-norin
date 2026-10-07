import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  Model,
  Table,
  ForeignKey,
} from "sequelize-typescript";
import { Reference } from "src/references/reference.model";
import { Enterprise } from "src/enterprises/enterprise.model";

export interface ProductCalculationCreationAttrs {
  enterpriseId?: number;
  productId: number;
  materialId: number;
  quantityPerUnit: number;
}

@Table({ tableName: "product_calculations" })
export class ProductCalculation extends Model<
  ProductCalculation,
  ProductCalculationCreationAttrs
> {
  @ApiProperty({ example: 1, description: "Уникальный идентификатор" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Enterprise)
  @ApiProperty({ example: 1, description: "ID предприятия" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  enterpriseId: number;

  @BelongsTo(() => Enterprise)
  enterprise: Enterprise;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: 1, description: "ID готовой продукции" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  productId: number;

  @BelongsTo(() => Reference, "productId")
  product: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: 2, description: "ID материала" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  materialId: number;

  @BelongsTo(() => Reference, "materialId")
  material: Reference;

  @ApiProperty({
    example: 0.5,
    description: "Норма расхода материала на единицу готовой продукции",
  })
  @Column({ type: DataType.FLOAT, allowNull: false })
  quantityPerUnit: number;

  @ApiProperty({
    example: "2024-01-28T10:00:00Z",
    description: "Дата создания",
  })
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  createdAt: Date;

  @ApiProperty({
    example: "2024-01-28T10:00:00Z",
    description: "Дата обновления",
  })
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  updatedAt: Date;
}
