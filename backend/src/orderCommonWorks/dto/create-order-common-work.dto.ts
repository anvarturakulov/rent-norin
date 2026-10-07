import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateOrderCommonWorkDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  orderId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  lineIndex?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  commonWorkRefId?: number;

  @ApiProperty({ example: "Сборка" })
  @IsString()
  workName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantityInOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  amountInOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  selected?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sourceNormId?: number;
}
