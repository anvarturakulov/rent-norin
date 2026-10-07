import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import {
  FurnitureOrderType,
  OrderStageType,
} from "src/interfaces/furniture-order.interface";

export class UpdateFurnitureOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;

  @ApiProperty({ required: false, enum: FurnitureOrderType })
  @IsOptional()
  @IsIn(Object.values(FurnitureOrderType))
  orderType?: FurnitureOrderType;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  stages?: OrderStageType[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  orderDate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deadlineDate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  count?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  analiticId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  profitRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  profitValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  filesFromScaling?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  filesFromDrawing?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  filesFromPricing?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  filesFromStore?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  filesFromDelivery?: string;

  @ApiProperty({
    required: false,
    description: "Требуется отгрузка клиенту на этапе Омбор",
  })
  @IsOptional()
  @IsBoolean()
  requiresClientSale?: boolean;

  @ApiProperty({
    required: false,
    description:
      "Разрешить приход ГП/ПФ до полного списания по плану (с предупреждением)",
  })
  @IsOptional()
  @IsBoolean()
  allowReceiptWithoutFullWriteoff?: boolean;

  @ApiProperty({
    required: false,
    type: [String],
    description: "Коды BEFORE_COST наценок, выключенных для колонки Умумий ишлар",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disabledBeforeCostMarkupCodes?: string[] | null;

  @ApiProperty({
    required: false,
    type: [String],
    description: "Коды BEFORE_COST наценок, выключенных для колонки Ишлар",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disabledBeforeCostMarkupCodesWorks?: string[] | null;
}
