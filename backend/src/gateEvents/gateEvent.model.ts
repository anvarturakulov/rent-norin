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
import { Document } from "src/documents/document.model";
import { Enterprise } from "src/enterprises/enterprise.model";

export enum GateEventType {
  INCOME = "income",
  OUTCOME = "outcome",
}

export enum GateAction {
  OPENED = "opened",
  DENIED = "denied",
  PENDING = "pending",
}

export interface GateEventCreationAttrs {
  enterpriseId?: number;
  carId?: number;
  plateNumber: string;
  eventType: GateEventType;
  eventTime: bigint;
  cameraIp: string;
  vehicleType?: string;
  vehicleColor?: string;
  imagePath?: string;
  plateImagePath?: string;
  gateAction: GateAction;
  denialReason?: string;
  leaveProdDocId?: bigint;
  processed: boolean;
}

@Table({ tableName: "gate_events" })
export class GateEvent extends Model<GateEvent, GateEventCreationAttrs> {
  @ApiProperty({ example: 1, description: "Уникальный идентификатор" })
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Enterprise)
  @ApiProperty({ example: 1, description: "ID предприятия события" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  enterpriseId: number;

  @BelongsTo(() => Enterprise)
  enterprise: Enterprise;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 123,
    description: "ID автомобиля из справочника CARS",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  carId?: number;

  @BelongsTo(() => Reference)
  carReference: Reference;

  @ApiProperty({
    example: "01A123AA",
    description: "Госномер автомобиля с камеры",
  })
  @Column({ type: DataType.STRING, allowNull: false })
  plateNumber: string;

  @ApiProperty({
    example: "income",
    description: "Тип события - въезд или выезд",
  })
  @Column({ type: DataType.ENUM(...Object.values(GateEventType)) })
  eventType: GateEventType;

  @ApiProperty({
    example: 1738368000000,
    description: "Время события в миллисекундах",
  })
  @Column({ type: DataType.BIGINT })
  eventTime: bigint;

  @ApiProperty({ example: "192.168.1.100", description: "IP адрес камеры" })
  @Column({ type: DataType.STRING })
  cameraIp: string;

  @ApiProperty({ example: "car", description: "Тип транспортного средства" })
  @Column({ type: DataType.STRING, allowNull: true })
  vehicleType?: string;

  @ApiProperty({ example: "white", description: "Цвет автомобиля" })
  @Column({ type: DataType.STRING, allowNull: true })
  vehicleColor?: string;

  @ApiProperty({
    example: "/uploads/gate/2024-01-30/car_123.jpg",
    description: "Путь к изображению автомобиля",
  })
  @Column({ type: DataType.STRING, allowNull: true })
  imagePath?: string;

  @ApiProperty({
    example: "/uploads/gate/2024-01-30/plate_123.jpg",
    description: "Путь к изображению номера автомобиля",
  })
  @Column({ type: DataType.STRING, allowNull: true })
  plateImagePath?: string;

  @ApiProperty({ example: "opened", description: "Действие шлагбаума" })
  @Column({ type: DataType.ENUM(...Object.values(GateAction)) })
  gateAction: GateAction;

  @ApiProperty({
    example: "Нет документа SaleProd",
    description: "Причина отказа в выезде",
  })
  @Column({ type: DataType.STRING, allowNull: true })
  denialReason?: string;

  @ForeignKey(() => Document)
  @ApiProperty({
    example: 456,
    description: "ID документа SaleProd для выезда",
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  leaveProdDocId?: bigint;

  @BelongsTo(() => Document)
  leaveProdDocument: Document;

  @ApiProperty({ example: true, description: "Флаг обработки события" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  processed: boolean;

  @ApiProperty({
    example: "2024-01-30T10:30:00Z",
    description: "Дата создания записи",
  })
  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  createdAt: Date;

  @ApiProperty({
    example: "2024-01-30T10:30:00Z",
    description: "Дата обновления записи",
  })
  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  updatedAt: Date;
}
