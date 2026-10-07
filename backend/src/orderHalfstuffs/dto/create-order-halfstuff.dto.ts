import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional } from "class-validator";

export class CreateOrderHalfstuffDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  orderId: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  halfstuffId: number;

  @ApiProperty({ example: 15000, required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsNumber()
  countPlanned?: number;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  finishedProductQty?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  countInOrder?: number;

  @ApiProperty({ example: 300000, required: false })
  @IsOptional()
  @IsNumber()
  total?: number;
}
