import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Validate,
} from "class-validator";
import { Type } from "class-transformer";
import { DEBETKREDIT, Schet, TypeQuery } from "src/interfaces/report.interface";

export class GetEntriesQueryDto {
  @IsOptional()
  @IsString()
  reportType?: string;

  @IsOptional()
  @IsEnum(TypeQuery, { message: "typeQuery - is Enum - select from list" })
  typeQuery?: TypeQuery;

  @IsOptional()
  @IsEnum(Schet, { message: "schet - is Enum - select from list" })
  schet?: Schet;

  @IsOptional()
  @IsEnum(DEBETKREDIT, { message: "dk - is Enum - select from list" })
  dk?: DEBETKREDIT;

  @IsOptional()
  @IsInt()
  @Min(-1) // Разрешаем -1 для "Барчаси" (Все) в DEPARTMENTS
  @Type(() => Number)
  sectionId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  tmzId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  workerId?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  startDate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @Validate((value, args) => value >= args.object.startDate, {
    message: "endDate must be greater than or equal to startDate",
  })
  endDate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  firstSubcontoId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  secondSubcontoId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  thirdSubcontoId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  firstPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  secondPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  debetFirstSubcontoId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  debetSecondSubcontoId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  debetThirdSubcontoId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  kreditFirstSubcontoId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  kreditSecondSubcontoId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  kreditThirdSubcontoId?: number;

  @IsOptional()
  @IsString()
  partnerType?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Type(() => Number)
  reportYear?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  enterpriseId?: number;

  @IsOptional()
  @IsString()
  user?: string;
}
