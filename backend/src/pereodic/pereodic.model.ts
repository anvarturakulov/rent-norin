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

interface PereodicCreationAttrs {
  referenceId: number;
  enterpriseId?: number | null;
  date: bigint;
  name: string;
  value: number;
}

@Table({ tableName: "pereodic" })
export class Pereodic extends Model<Pereodic, PereodicCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: "12222", description: "Идентификатор справочника" })
  @Column({ type: DataType.INTEGER })
  referenceId: number;

  @BelongsTo(() => Reference, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  reference: Reference;

  @ApiProperty({
    example: "1738368000000",
    description: "Дата документа в миллисекундах",
  })
  @Column({ type: DataType.BIGINT })
  date: bigint;

  @ApiProperty({ example: "Имя реквизита ....", description: "Имя реквизита" })
  @Column({ type: DataType.STRING })
  name: string;

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
