import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  Model,
  Table,
  ForeignKey,
} from "sequelize-typescript";
import { Document } from "src/documents/document.model";
import { DocumentType } from "src/interfaces/document.interface";
import { Schet } from "src/interfaces/report.interface";
import { Reference } from "src/references/reference.model";
import { Enterprise } from "src/enterprises/enterprise.model";

export interface EntryCreationAttrs {
  enterpriseId?: number;
  date: bigint;
  documentType: DocumentType;
  docId: bigint;
  debet: Schet;
  debetFirstSubcontoId: number | null;
  debetSecondSubcontoId: number | null;
  debetThirdSubcontoId?: number | null;
  kredit: Schet;
  kreditFirstSubcontoId: number | null;
  kreditSecondSubcontoId: number | null;
  kreditThirdSubcontoId?: number | null;
  count: number;
  total: number;
  usd: number;
  description?: string;
  fullDescription?: string;
  targetEnterpriseId?: number | null;
  orderId?: number | null;
}

@Table({ tableName: "entries" })
export class Entry extends Model<Entry, EntryCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ForeignKey(() => Enterprise)
  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия проводки",
  })
  @Column({ type: DataType.INTEGER, allowNull: false })
  enterpriseId: number;

  @BelongsTo(() => Enterprise)
  enterprise: Enterprise;

  @ForeignKey(() => Document)
  @ApiProperty({ example: "12222", description: "Идентификатор документа" })
  @Column({ type: DataType.BIGINT })
  docId: bigint;

  @BelongsTo(() => Document)
  document: Document;

  @ApiProperty({
    example: "1735896554455",
    description: "Дата проводки в миллисекундах",
  })
  @Column({ type: DataType.BIGINT })
  date: bigint;

  @ApiProperty({
    example: "ComeMaterial",
    description: "Тип документа - ( из списка документов )",
  })
  @Column({ type: DataType.ENUM(...Object.values(DocumentType)) })
  documentType: DocumentType;

  @ApiProperty({ example: "6010", description: "Счет дебета" })
  @Column({ type: DataType.ENUM(...Object.values(Schet)) })
  debet: Schet;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - первого субконто по дебету",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  debetFirstSubcontoId: number | null;

  @BelongsTo(() => Reference, {
    foreignKey: "debetFirstSubcontoId",
    constraints: false,
  })
  debetFirstSubcontoReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - второго субконто по дебету",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  debetSecondSubcontoId: number | null;

  @BelongsTo(() => Reference, {
    foreignKey: "debetSecondSubcontoId",
    constraints: false,
  })
  debetSecondSubcontoReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - третьего субконто по дебету",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  debetThirdSubcontoId: number | null;

  @BelongsTo(() => Reference, {
    foreignKey: "debetThirdSubcontoId",
    constraints: false,
  })
  debetThirdSubcontoReference: Reference;

  @ApiProperty({ example: "5010", description: "Счет кредита" })
  @Column({ type: DataType.ENUM(...Object.values(Schet)) })
  kredit: Schet;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - первого субконто по кредиту",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  kreditFirstSubcontoId: number | null;

  @BelongsTo(() => Reference, {
    foreignKey: "kreditFirstSubcontoId",
    constraints: false,
  })
  kreditFirstSubcontoReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - второго субконто по кредиту",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  kreditSecondSubcontoId: number | null;

  @BelongsTo(() => Reference, {
    foreignKey: "kreditSecondSubcontoId",
    constraints: false,
  })
  kreditSecondSubcontoReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - третьего субконто по кредиту",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  kreditThirdSubcontoId: number | null;

  @BelongsTo(() => Reference, {
    foreignKey: "kreditThirdSubcontoId",
    constraints: false,
  })
  kreditThirdSubcontoReference: Reference;

  @ApiProperty({ example: "10", description: "Количество" })
  @Column({ type: DataType.FLOAT })
  count: number;

  @ApiProperty({ example: "150000", description: "Всего" })
  @Column({ type: DataType.FLOAT })
  total: number;

  @ApiProperty({ example: "150", description: "Сумма в USD" })
  @Column({ type: DataType.FLOAT })
  usd: number;

  @ApiProperty({
    example: "Поступление материалов от ....",
    description: "Описание проводки",
  })
  @Column({ type: DataType.TEXT })
  description: string;

  @ApiProperty({
    example: "Полное описание проводки (может быть длиннее/детальнее)",
    description: "Полное описание проводки (необязательно)",
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  fullDescription?: string;

  @ApiProperty({
    example: 101,
    description:
      "ID заказа (furniture_orders). NULL = общие/накладные расходы",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  orderId?: number | null;
}
