import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional } from "class-validator";

export class CreateOrderMaterialDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  orderId: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  materialId: number;

  @ApiProperty({ example: 15000, required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ example: 20, required: false })
  @IsOptional()
  @IsNumber()
  countPlanned?: number;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  finishedProductQty?: number;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @IsNumber()
  countInOrder?: number;

  @ApiProperty({ example: 300000, required: false })
  @IsOptional()
  @IsNumber()
  total?: number;
}
