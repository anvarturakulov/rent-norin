import { IsNumber, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class ClientTotalPaidDetailsQueryDto {
  @IsNumber()
  @Type(() => Number)
  clientId: number;

  @IsNumber()
  @Type(() => Number)
  startDate: number;

  @IsNumber()
  @Type(() => Number)
  endDate: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  enterpriseId?: number;
}
