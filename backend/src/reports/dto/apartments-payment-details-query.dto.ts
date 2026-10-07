import { IsNumber, IsString, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class ApartmentsPaymentDetailsQueryDto {
  @IsNumber()
  @Type(() => Number)
  clientId: number;

  @IsString()
  monthKey: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  enterpriseId?: number;
}
