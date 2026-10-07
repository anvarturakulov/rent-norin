import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  ValidateNested,
} from "class-validator";

export class StoreHalfstuffWriteoffLineDto {
  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsInt()
  halfstuffId: number;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  count: number;

  @ApiProperty({ example: 1200 })
  @Type(() => Number)
  @IsNumber()
  price: number;

  @ApiProperty({ example: 6000 })
  @Type(() => Number)
  @IsNumber()
  total: number;
}

export class StoreHalfstuffWriteoffDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({ required: false, description: "Дата документа (ms)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  date?: number;

  @ApiProperty({ type: [StoreHalfstuffWriteoffLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StoreHalfstuffWriteoffLineDto)
  lines: StoreHalfstuffWriteoffLineDto[];
}
