import { IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class IncomeDetailsQueryDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  workshopId: number;

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
  @Min(0)
  @Type(() => Number)
  enterpriseId?: number;
}
