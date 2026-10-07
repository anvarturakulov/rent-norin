import { ApiProperty } from "@nestjs/swagger";
import {
  Column,
  DataType,
  HasMany,
  Model,
  Table,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { SettingType } from "src/interfaces/settings.interface";
import { UserRoles } from "src/interfaces/user.interface";
import { Enterprise } from "src/enterprises/enterprise.model";
import { SettingPereodic } from "./settingPereodic.model";

type SettingValue = string | number | boolean | object | any[] | Date;

interface SettingsCreationAttrs {
  key: string;
  type: SettingType;
  value: SettingValue;
  description: string;
  markToDeleted?: boolean;
  allowedRoles?: UserRoles[];
  enterpriseId?: number | null;
  isPereodic?: boolean;
}

@Table({ tableName: "settings" })
export class Settings extends Model<Settings, SettingsCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ApiProperty({ example: "key.key", description: "Ключ" })
  @Column({ type: DataType.STRING, allowNull: false })
  key: string;

  @ApiProperty({ example: "За хулиганство", description: "Причина блокировки" })
  @Column({ type: DataType.ENUM(...Object.values(SettingType)) })
  type: SettingType;

  @ApiProperty({
    example: "example_value",
    description:
      "Значение настройки (тип зависит от поля type: STRING, NUMBER, BOOLEAN, JSON, ARRAY, DATE)",
  })
  @Column({ type: DataType.JSON })
  value: SettingValue;

  @ApiProperty({ example: "Анвар", description: "Имя пользователя" })
  @Column({ type: DataType.STRING })
  description: string;

  @ApiProperty({ example: "false", description: "Помечан на удаление?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  markToDeleted?: boolean;

  @ApiProperty({
    example: ["ADMIN", "HEADCOMPANY"],
    description: "Роли, которым видна эта настройка",
  })
  @Column({ type: DataType.JSON, allowNull: true })
  allowedRoles: UserRoles[];

  @ForeignKey(() => Enterprise)
  @ApiProperty({
    example: 1,
    description: "ID предприятия (null для глобальных настроек)",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @BelongsTo(() => Enterprise)
  enterprise?: Enterprise | null;

  @ApiProperty({
    example: false,
    description: "Периодическая настройка (значения зависят от даты)",
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  isPereodic?: boolean;

  @HasMany(() => SettingPereodic)
  pereodicValues?: SettingPereodic[];
}
