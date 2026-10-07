import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class ClientContractOrderLineDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  furnitureOrderId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderPrice: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  count?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  saleDocId?: number | null;
}
