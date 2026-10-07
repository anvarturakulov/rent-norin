import { IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class RentalNetProfitQueryDto {
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
