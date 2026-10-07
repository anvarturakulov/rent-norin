import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  Model,
  Table,
  ForeignKey,
} from "sequelize-typescript";
import { Schet } from "src/interfaces/report.interface";
import { Reference } from "src/references/reference.model";
import { Enterprise } from "src/enterprises/enterprise.model";

export interface StockCreationAttrs {
  enterpriseId?: number;
  schet: Schet;
  date: bigint;
  firstSubcontoId: number | null;
  secondSubcontoId: number | null;
  count: number;
  total: number;
  usd: number;
  remainCount: number;
  remainTotal: number;
  remainUsd: number;
  comment: string;
}

@Table({ tableName: "stocks" })
export class Stock extends Model<Stock, StockCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ForeignKey(() => Enterprise)
  @ApiProperty({ example: "1", description: "Идентификатор предприятия" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  enterpriseId: number;

  @BelongsTo(() => Enterprise)
  enterprise: Enterprise;

  @ApiProperty({ example: "6010", description: "Счет дебета" })
  @Column({ type: DataType.ENUM(...Object.values(Schet)) })
  schet: Schet;

  @ApiProperty({
    example: "1735896554455",
    description: "Дата проводки в миллисекундах",
  })
  @Column({ type: DataType.BIGINT })
  date: bigint;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - первого субконто по дебету",
  })
  @Column({ type: DataType.INTEGER })
  firstSubcontoId: number | null;

  @BelongsTo(() => Reference)
  firstSubcontoReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - второго субконто по дебету",
  })
  @Column({ type: DataType.INTEGER })
  secondSubcontoId: number | null;

  @BelongsTo(() => Reference)
  secondSubcontoReference: Reference;

  @ApiProperty({ example: "10", description: "Количество" })
  @Column({ type: DataType.FLOAT })
  count: number;

  @ApiProperty({ example: "150000", description: "Всего" })
  @Column({ type: DataType.FLOAT })
  total: number;

  @ApiProperty({ example: "150", description: "Сумма в USD" })
  @Column({ type: DataType.FLOAT })
  usd: number;

  @Column({ type: DataType.FLOAT })
  remainCount: number;

  @Column({ type: DataType.FLOAT })
  remainTotal: number;

  @Column({ type: DataType.FLOAT })
  remainUsd: number;

  @Column({ type: DataType.STRING })
  comment: string;

  // @Unique({ name: 'stocks_unique_date', msg: 'One stock per date' })
  // static uniqueDateConstraint = ['schet', 'firstSubcontoId', 'secondSubcontoId', 'date'];
}
