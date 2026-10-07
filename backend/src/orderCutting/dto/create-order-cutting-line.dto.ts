import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateOrderCuttingLineDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  orderId: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  materialId: number;

  @ApiProperty({ example: 2800 })
  @IsNumber()
  @Min(0.001)
  length: number;

  @ApiProperty({ example: 2070 })
  @IsNumber()
  @Min(0.001)
  width: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  createdByUserId?: number;
}
