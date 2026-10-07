import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsInt,
  ValidateIf,
  ValidateNested,
  IsNotEmpty,
  Length,
} from "class-validator";
import { Type } from "class-transformer";
import { RefValues, TypeReference } from "src/interfaces/reference.interface";
import { CreateReferenceValueDto } from "src/refvalues/dto/createReferenceValues.dto";

export class UpdateCreateReferenceDto {
  @ApiProperty({ example: "Нон", description: "Название справочника" })
  @IsString({ message: "name - должен быть строкой" })
  name: string;

  @ApiProperty({
    example: "ART0000001",
    description:
      "Артикул (обязательно для TMZ и WORKS; опционально для STORAGES — склады/цеха)",
    required: false,
  })
  @ValidateIf((o) => o.typeReference === TypeReference.TMZ)
  @IsString({ message: "article - должен быть строкой" })
  @IsNotEmpty({ message: "article - обязателен для TMZ" })
  @Length(1, 15, { message: "article - длина должна быть от 1 до 15 символов" })
  @ValidateIf((o) => o.typeReference === TypeReference.WORKS)
  @IsString({ message: "article для WORKS должен быть строкой" })
  @IsNotEmpty({ message: "article - обязателен для WORKS" })
  @Length(1, 15, { message: "article - длина от 1 до 15 символов" })
  @ValidateIf(
    (o) =>
      o.typeReference === TypeReference.STORAGES &&
      o.article !== undefined &&
      o.article !== null &&
      String(o.article).trim() !== "",
  )
  @IsString({ message: "article для STORAGES должен быть строкой" })
  @Length(1, 15, {
    message: "article для складов/цехов — от 1 до 15 символов",
  })
  article?: string;

  @ApiProperty({ example: "CHARGES", description: "Тип справочника" })
  @IsEnum(TypeReference, {
    message: "typeReference - должен быть из списка типов справочника",
  })
  typeReference: TypeReference;

  @ApiProperty({ example: "1", description: "Идентификатор родителя" })
  @IsNumber({}, { message: "parentId - должен быть числом" })
  @IsOptional()
  parentId?: number;

  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия",
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.enterpriseId !== null)
  @IsInt({ message: "enterpriseId - должен быть натуральным числом или null" })
  enterpriseId?: number | null;

  @ApiProperty({ example: "false", description: "Является папкой?", required: false })
  @IsOptional()
  @IsBoolean({ message: "isFolder - должен быть булевым значением" })
  isFolder?: boolean;

  @ApiProperty({
    description:
      "Внутренний ключ уникальности TMZ_SHORT_NAME (задаётся на сервере, не обязателен в запросе)",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "tmzDictKey - должен быть строкой" })
  tmzDictKey?: string | null;

  @ApiProperty({
    type: CreateReferenceValueDto,
    description: "Значения справочника",
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateReferenceValueDto)
  refValues?: CreateReferenceValueDto;

  @ApiProperty({
    required: false,
    description: "Объект предприятия; приходит при получении справочника",
  })
  @IsOptional()
  enterprise?: any;

  @ApiProperty({
    example: "2025-11-20T06:40:00.475Z",
    description: "Дата создания reference",
    required: false,
  })
  @IsOptional()
  createdAt?: string | number | null;

  @ApiProperty({
    example: "2025-11-20T06:40:00.475Z",
    description: "Дата обновления reference",
    required: false,
  })
  @IsOptional()
  updatedAt?: string | number | null;
}
