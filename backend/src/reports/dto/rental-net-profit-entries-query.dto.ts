import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

export class RentalNetProfitEntriesQueryDto {
  @IsIn(["income", "cogs", "otherIncome93"])
  type: "income" | "cogs" | "otherIncome93";

  @IsInt()
  @Min(0)
  @Type(() => Number)
  startDate: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  endDate: number;

  /** Comma-separated TMZ ids; -1 = without analytics (NULL second subconto) */
  @IsString()
  tmzIds: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  enterpriseId?: number;
}
