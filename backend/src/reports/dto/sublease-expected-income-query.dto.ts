import { IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class SubleaseExpectedIncomeQueryDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  asOf: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  clientId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  enterpriseId?: number;
}
