import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  Model,
  Table,
  ForeignKey,
} from "sequelize-typescript";
import { Settings } from "./settings.model";
import { Enterprise } from "src/enterprises/enterprise.model";

interface SettingPereodicCreationAttrs {
  settingId: number;
  enterpriseId?: number | null;
  date: bigint;
  value: number;
}

@Table({ tableName: "setting_pereodic" })
export class SettingPereodic extends Model<
  SettingPereodic,
  SettingPereodicCreationAttrs
> {
  @ApiProperty({ example: "1", description: "Уникальный идентификатор" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ForeignKey(() => Settings)
  @ApiProperty({ example: "5", description: "Идентификатор настройки" })
  @Column({ type: DataType.INTEGER })
  settingId: number;

  @BelongsTo(() => Settings, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  setting: Settings;

  @ApiProperty({
    example: "1738368000000",
    description: "Дата в миллисекундах",
  })
  @Column({ type: DataType.BIGINT })
  date: bigint;

  @ApiProperty({ example: "150000", description: "Значение" })
  @Column({ type: DataType.FLOAT })
  value: number;

  @ForeignKey(() => Enterprise)
  @ApiProperty({ example: "1", description: "Идентификатор предприятия" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @BelongsTo(() => Enterprise)
  enterprise?: Enterprise | null;
}
