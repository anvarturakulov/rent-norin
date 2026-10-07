import { ApiProperty } from "@nestjs/swagger";
import {
  Column,
  DataType,
  Model,
  Table,
  HasOne,
  HasMany,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { DocValues } from "src/docValues/docValues.model";
import { Entry } from "src/entries/entry.model";
import { TypeReference } from "src/interfaces/reference.interface";
import { RefValues } from "src/refvalues/refValues.model";
import { User } from "src/users/users.model";
import { Enterprise } from "src/enterprises/enterprise.model";

interface ReferenceCreationAttrs {
  name: string;
  article?: string;
  typeReference: TypeReference;
  parentId?: number;
  enterpriseId?: number | null;
  isFolder?: boolean;
}

@Table({ tableName: "references" })
export class Reference extends Model<Reference, ReferenceCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ApiProperty({ example: "Нон", description: "Название справочника" })
  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @ApiProperty({
    example: "ART0000001",
    description: "Артикул (для TMZ)",
    required: false,
  })
  @Column({ type: DataType.STRING(15), allowNull: true })
  article?: string;

  @ApiProperty({ example: "CHARGES", description: "Тип справочник " })
  @Column({
    type: DataType.ENUM(...Object.values(TypeReference)),
    allowNull: false,
  })
  typeReference: TypeReference;

  @ApiProperty({ example: "1", description: "Идентификатор родителя" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  parentId?: number;

  @ApiProperty({ example: "false", description: "Является папкой?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isFolder?: boolean;

  @ForeignKey(() => Enterprise)
  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия, которому принадлежит справочник",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @ApiProperty({
    description:
      "Составной ключ словаря TMZ_SHORT_NAME (typeTMZ + enterprise + name)",
    required: false,
  })
  @Column({ type: DataType.STRING(512), allowNull: true })
  tmzDictKey?: string | null;

  @BelongsTo(() => Enterprise)
  enterprise?: Enterprise | null;

  @HasOne(() => RefValues)
  refValues: RefValues;

  @HasOne(() => User)
  user: User;

  @HasOne(() => Entry)
  entry: Entry;

  @HasOne(() => DocValues)
  docValue: DocValues;
}
