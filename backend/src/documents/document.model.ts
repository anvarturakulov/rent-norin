import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  Model,
  Table,
  HasMany,
  HasOne,
  ForeignKey,
} from "sequelize-typescript";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocValues } from "src/docValues/docValues.model";
import { Entry } from "src/entries/entry.model";
import { DocSTATUS, DocumentType } from "src/interfaces/document.interface";
import { User } from "src/users/users.model";
import { Enterprise } from "src/enterprises/enterprise.model";

export interface DocumentCreationAttrs {
  date: bigint;
  userId?: number;
  documentType: DocumentType;
  docStatus?: DocSTATUS;
  enterpriseId?: number | null;
  isInterEnterprise?: boolean;
  sourceEnterpriseId?: number | null;
  targetEnterpriseId?: number | null;
  documentTypeForSender?: DocumentType | null;
  documentTypeForReceiver?: DocumentType | null;
  isLocked?: boolean;
  rejectionReason?: string | null;
}

@Table({ tableName: "documents" })
export class Document extends Model<Document, DocumentCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ApiProperty({
    example: "1738368000000",
    description: "Дата документа в миллисекундах",
  })
  @Column({ type: DataType.BIGINT })
  date: bigint;

  @ForeignKey(() => User)
  @ApiProperty({ example: "12222", description: "Идентификатор пользователя" })
  @Column({ type: DataType.INTEGER })
  userId?: number;

  @ForeignKey(() => Enterprise)
  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия для внутреннего документа",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @BelongsTo(() => Enterprise)
  enterprise?: Enterprise | null;

  @ApiProperty({
    example: "ComeMaterial",
    description: "Тип документа - ( из списка документов )",
  })
  @Column({ type: DataType.ENUM(...Object.values(DocumentType)) })
  documentType: DocumentType;

  @ApiProperty({
    example: "OPEN",
    description: "Статус документа - ( OPEN || DELETED || PROVEDEN )",
  })
  @Column({
    type: DataType.ENUM(...Object.values(DocSTATUS)),
    defaultValue: DocSTATUS.OPEN,
  })
  docStatus: DocSTATUS;

  @ApiProperty({
    example: false,
    description: "Является ли документ межпредприятием",
  })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  isInterEnterprise: boolean;

  @ForeignKey(() => Enterprise)
  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия-отправителя",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  sourceEnterpriseId?: number | null;

  @BelongsTo(() => Enterprise, "sourceEnterpriseId")
  sourceEnterprise?: Enterprise | null;

  @ForeignKey(() => Enterprise)
  @ApiProperty({
    example: "2",
    description: "Идентификатор предприятия-получателя",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  targetEnterpriseId?: number | null;

  @BelongsTo(() => Enterprise, "targetEnterpriseId")
  targetEnterprise?: Enterprise | null;

  @ApiProperty({
    example: "SaleProd",
    description: "Тип документа для отправителя",
  })
  @Column({
    type: DataType.ENUM(...Object.values(DocumentType)),
    allowNull: true,
  })
  documentTypeForSender?: DocumentType | null;

  @ApiProperty({
    example: "ComeMaterial",
    description: "Тип документа для получателя",
  })
  @Column({
    type: DataType.ENUM(...Object.values(DocumentType)),
    allowNull: true,
  })
  documentTypeForReceiver?: DocumentType | null;

  @ApiProperty({
    example: false,
    description: "Заблокирован ли документ для изменений",
  })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  isLocked: boolean;

  @ApiProperty({
    example: "Несоответствие цены",
    description: "Причина отклонения",
  })
  @Column({ type: DataType.STRING, allowNull: true })
  rejectionReason?: string | null;

  @BelongsTo(() => User)
  user!: User;

  @HasOne(() => DocValues)
  docValues!: DocValues;

  @HasMany(() => DocTableItems)
  docTableItems!: DocTableItems[];

  @HasMany(() => Entry)
  entries!: Entry[];

  @ApiProperty({
    example: "2024-01-30T10:30:00Z",
    description: "Дата создания записи",
  })
  @Column({ type: DataType.DATE })
  createdAt: Date;

  @ApiProperty({
    example: "2024-01-30T10:30:00Z",
    description: "Дата обновления записи",
  })
  @Column({ type: DataType.DATE })
  updatedAt: Date;
}
