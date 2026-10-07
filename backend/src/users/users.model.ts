import { ApiProperty } from "@nestjs/swagger";
import {
  Column,
  DataType,
  Model,
  Table,
  HasMany,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
} from "sequelize-typescript";
import { Document } from "src/documents/document.model";
import { UserRoles } from "src/interfaces/user.interface";
import { Reference } from "src/references/reference.model";
import { Enterprise } from "src/enterprises/enterprise.model";

interface UserCreationAttrs {
  email: string;
  password: string;
  enterpriseId?: number;
  isSuperUser?: boolean;
  superKassir?: boolean;
}

@Table({ tableName: "users" })
export class User extends Model<User, UserCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ApiProperty({ example: "user@mail.ru", description: "Почтовый адрес" })
  @Column({ type: DataType.STRING, unique: true, allowNull: false })
  email: string;

  @ApiProperty({ example: "12345678", description: "Пароль" })
  @Column({ type: DataType.STRING, allowNull: false })
  password: string;

  @ApiProperty({ example: "true", description: "Забанен или нет" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  banned: boolean;

  @ApiProperty({ example: "За хулиганство", description: "Причина блокировки" })
  @Column({ type: DataType.STRING })
  banReason?: string;

  @ApiProperty({ example: "Анвар", description: "Имя пользователя" })
  @Column({ type: DataType.STRING })
  name: string;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: "12222897", description: "Id - подразделения" })
  @Column({ type: DataType.INTEGER })
  sectionId: number;

  @ApiProperty({ example: "Телеграм ID", description: "Телеграм Id" })
  @Column({ type: DataType.STRING })
  telegramId: string;

  @ApiProperty({
    example: "CLIENTS",
    description: "Тип партнера - ( CLIENTS || SUPPLIERS )",
  })
  @Column({ type: DataType.ENUM(...Object.values(UserRoles)) })
  role: UserRoles;

  @BelongsTo(() => Reference)
  referenceForSection: Reference;

  @ForeignKey(() => Enterprise)
  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия пользователя",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId: number | null;

  @BelongsTo(() => Enterprise)
  enterprise?: Enterprise;

  @ApiProperty({
    example: false,
    description: "Имеет ли пользователь доступ ко всем предприятиям",
  })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  isSuperUser: boolean;

  @ApiProperty({
    example: "[1,2,3]",
    description:
      "Массив идентификаторов storages, которые пользователь может принимать для межпредприятийных документов",
    required: false,
  })
  @Column({ type: DataType.JSON, allowNull: true })
  allowedStorageIds?: number[] | null;

  @ApiProperty({
    example: false,
    description:
      "Суперкасса - позволяет вводить справочники (партнеры, сотрудники) от имени других организаций",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  superKassir?: boolean;

  @ApiProperty({
    example: '{"TMZ":{"canView":true,"canCreate":true}}',
    description: "Права доступа по справочникам (JSON)",
    required: false,
  })
  @Column({ type: DataType.JSON, allowNull: true })
  referencePermissions?: Record<string, unknown> | null;

  @HasMany(() => Document)
  documents: Document[];
}
