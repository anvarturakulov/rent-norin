import { ApiProperty } from "@nestjs/swagger";
import { Column, DataType, HasMany, Model, Table } from "sequelize-typescript";
import { User } from "src/users/users.model";

@Table({ tableName: "enterprises" })
export class Enterprise extends Model<Enterprise> {
  @ApiProperty({
    example: 1,
    description: "Уникальный идентификатор предприятия",
  })
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id: number;

  @ApiProperty({ example: "Главный офис", description: "Название предприятия" })
  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @ApiProperty({ example: "MAIN", description: "Уникальный код предприятия" })
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  code: string;

  @ApiProperty({ example: true, description: "Активно ли предприятие" })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  isActive: boolean;

  @ApiProperty({
    description: "Дополнительные настройки предприятия в формате JSON",
    example: { locale: "ru", currency: "UZS" },
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  settings: Record<string, unknown> | null;

  @ApiProperty({ example: false, description: "Помечено на удаление?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  markToDeleted?: boolean;

  @HasMany(() => User)
  users: User[];
}
