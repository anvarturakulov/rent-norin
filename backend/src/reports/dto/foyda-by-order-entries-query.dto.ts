import { IsEnum, IsInt, IsOptional, Min, ValidateIf } from "class-validator";
import { Type } from "class-transformer";
import { Schet } from "src/interfaces/report.interface";

export enum FoydaByOrderEntryType {
  INCOME = "income",
  EXPENSE = "expense",
}

export class FoydaByOrderEntriesQueryDto {
  @IsEnum(FoydaByOrderEntryType)
  type: FoydaByOrderEntryType;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  startDate: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  endDate: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  orderId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  saleDocId?: number;

  @ValidateIf((o) => o.type === FoydaByOrderEntryType.EXPENSE)
  @IsEnum(Schet)
  debet?: Schet;

  @ValidateIf((o) => o.type === FoydaByOrderEntryType.EXPENSE)
  @IsEnum(Schet)
  kredit?: Schet;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  enterpriseId?: number;
}
