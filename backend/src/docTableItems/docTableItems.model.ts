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
import { Reference } from "src/references/reference.model";

export interface DocTableItemCreationAttrs {
  docId: bigint;
  analiticId: number;
  balance: number;
  count: number;
  price: number;
  total: number;
  costPrice: number;
  costTotal: number;
  countByBox?: number;
  refCountInBox?: number;
  tableType?: "income" | "expense" | "return" | "brak" | "sale" | "tovar";
  plannedCount?: number;
  hourlyTariff?: number;
  dailyRent?: number;
  sourceTransferDocId?: number;
  rentSum?: number;
  partnerHourlyTariff?: number;
  partnerRentSum?: number;
  rentHours?: number;
  settlementDate?: number;
  lineKind?: string | null;
  lineStorageId?: number | null;
}

@Table({ tableName: "doctableitems" })
export class DocTableItems extends Model<
  DocTableItems,
  DocTableItemCreationAttrs
> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ForeignKey(() => Document)
  @ApiProperty({ example: "12222897", description: "Идентификатор документа" })
  @Column({ type: DataType.BIGINT })
  docId: bigint;

  @BelongsTo(() => Document)
  document: Document;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: "12222897", description: "Id - аналитики" })
  @Column({ type: DataType.INTEGER })
  analiticId: number;

  @BelongsTo(() => Reference)
  analiticReference: Reference;

  @ApiProperty({ example: "10", description: "Остаток" })
  @Column({ type: DataType.FLOAT })
  balance: number;

  @ApiProperty({ example: "10", description: "Количество" })
  @Column({ type: DataType.FLOAT })
  count: number;

  @ApiProperty({ example: "15000", description: "Цена" })
  @Column({ type: DataType.FLOAT })
  price: number;

  @ApiProperty({ example: "150000", description: "Всего" })
  @Column({ type: DataType.FLOAT })
  total: number;

  @ApiProperty({
    example: "12000",
    description: "Себестоимость единицы товара",
  })
  @Column({ type: DataType.FLOAT })
  costPrice: number;

  @ApiProperty({ example: "120000", description: "Общая себестоимость" })
  @Column({ type: DataType.FLOAT })
  costTotal: number;

  @ApiProperty({ example: "10", description: "Количество в коробках" })
  @Column({ type: DataType.FLOAT, allowNull: true })
  countByBox?: number;

  @ApiProperty({
    example: "10",
    description: "Количество в коробках для расчета",
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  refCountInBox?: number;

  @ApiProperty({
    example: "income",
    description: "Тип таблицы: income - приход, expense - списание материалов",
  })
  @Column({ type: DataType.STRING, allowNull: true, defaultValue: "income" })
  tableType?: "income" | "expense" | "return" | "brak" | "sale" | "tovar";

  @ApiProperty({
    example: 12.5,
    description: "Плановое количество из заказа (LeaveMaterial fill)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  plannedCount?: number;

  @ApiProperty({
    example: 5000,
    description: "Часовой тариф аренды",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  hourlyTariff?: number;

  @ApiProperty({
    example: 120000,
    description: "Сумма аренды за сутки (тариф × кол-во × 24)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  dailyRent?: number;

  @ApiProperty({
    example: 1001,
    description: "ID документа передачи (партия FIFO)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceTransferDocId?: number;

  @ApiProperty({
    example: 15000,
    description: "Сумма аренды по строке",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  rentSum?: number;

  @ApiProperty({
    example: 4000,
    description: "Часовой тариф партнёра (субаренда)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  partnerHourlyTariff?: number;

  @ApiProperty({
    example: 12000,
    description: "Сумма аренды партнёра по строке (субаренда)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  partnerRentSum?: number;

  @ApiProperty({
    example: 48,
    description: "Часы аренды по строке",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  rentHours?: number;

  @ApiProperty({
    example: 1700000000000,
    description: "Дата начала аренды (из документа передачи)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  settlementDate?: number;

  @ApiProperty({
    example: "expense",
    description: "Тип строки аванса",
    required: false,
  })
  @Column({ type: DataType.STRING(32), allowNull: true })
  lineKind?: string | null;

  @ApiProperty({
    example: 10,
    description: "Отдел или кошелёк учредителя строки аванса",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  lineStorageId?: number | null;
}
