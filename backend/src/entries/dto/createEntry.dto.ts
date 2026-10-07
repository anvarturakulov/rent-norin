import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, IsEnum, IsNumber, IsDate } from "class-validator";
import { DocumentType } from "src/interfaces/document.interface";
import { Schet } from "src/interfaces/report.interface";

export class CreateEntryDto {
  @ApiProperty({ example: "12222", description: "Идентификатор документа" })
  @IsInt({ message: "documentId - должен быть натуральным числом" })
  documentId: number;

  @ApiProperty({ example: "12-01-2025", description: "Дата проводки" })
  @IsDate({ message: "date - должен быть датой" })
  date: Date;

  @ApiProperty({
    example: "ComeMaterial",
    description: "Тип документа - ( из списка документов )",
  })
  @IsEnum(DocumentType, {
    message: "documentType - должен быть из списка документов",
  })
  documentType: DocumentType;

  @ApiProperty({ example: "6010", description: "Счет дебета" })
  @IsEnum(Schet, { message: "debet - должен быть из списка счетов" })
  debet: Schet;

  @ApiProperty({
    example: "12222897",
    description: "Id - первого субконто по дебету",
  })
  @IsInt({ message: "debetFirstSubcontoId - должен быть натуральным числом" })
  debetFirstSubcontoId: number;

  @ApiProperty({
    example: "12222897",
    description: "Id - второго субконто по дебету",
  })
  @IsInt({ message: "debetSecondSubcontoId - должен быть натуральным числом" })
  debetSecondSubcontoId: number;

  @ApiProperty({
    example: "12222897",
    description: "Id - третьего субконто по дебету",
  })
  @IsInt({ message: "debetThirdSubcontoId - должен быть натуральным числом" })
  debetThirdSubcontoId?: number;

  @ApiProperty({ example: "DELIVERY", description: "Счет кредита" })
  @IsEnum(Schet, { message: "kredit - должен быть из списка счетов" })
  kredit: Schet;

  @ApiProperty({
    example: "12222897",
    description: "Id - первого субконто по кредиту",
  })
  @IsInt({ message: "kreditFirstSubcontoId - должен быть натуральным числом" })
  kreditFirstSubcontoId: number;

  @ApiProperty({
    example: "12222897",
    description: "Id - второго субконто по кредиту",
  })
  @IsInt({ message: "kreditSecondSubcontoId - должен быть натуральным числом" })
  kreditSecondSubcontoId: number;

  @ApiProperty({
    example: "12222897",
    description: "Id - третьего субконто по кредиту",
  })
  @IsInt({ message: "kreditThirdSubcontoId - должен быть натуральным числом" })
  kreditThirdSubcontoId?: number;

  @ApiProperty({ example: "10", description: "Количество" })
  @IsNumber({}, { message: "count - должен быть номером" })
  count?: number;

  @ApiProperty({ example: "150000", description: "Всего" })
  @IsNumber({}, { message: "total - должен быть номером" })
  total?: number;

  @ApiProperty({
    example: "Поступление материалов",
    description: "Описание проводки",
  })
  @IsString({ message: "description - должен быть строкой" })
  description?: string;

  @ApiProperty({
    example: "Полное описание проводки",
    description: "Полное описание проводки (необязательно)",
  })
  @IsString({ message: "fullDescription - должен быть строкой" })
  fullDescription?: string;
}
