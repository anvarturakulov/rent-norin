import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ArrayNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";
import {
  FurnitureOrderType,
  OrderStageType,
} from "src/interfaces/furniture-order.interface";

export class CreateFurnitureOrderDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  enterpriseId?: number;

  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  clientId: number;

  @ApiProperty({
    example: 101,
    required: false,
    description: "ID готовой продукции (аналитика)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  analiticId?: number;

  @ApiProperty({
    example: "001-2026",
    required: false,
    description:
      "При создании можно не передавать — номер задаётся сервером (001-YYYY).",
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiProperty({ example: 1738368000000 })
  @Type(() => Number)
  @IsNumber()
  createdDate: number;

  @ApiProperty({
    example: 1738368000000,
    required: false,
    description: "Ручная дата заявки",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  orderDate?: number;

  @ApiProperty({ example: 1740000000000, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deadlineDate?: number;

  @ApiProperty({ example: 3, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  count?: number;

  @ApiProperty({ example: 1200000, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @ApiProperty({ example: 3600000, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total?: number;

  @ApiProperty({ example: "Кухня для Иванова", required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    example: FurnitureOrderType.INDIVIDUAL_PRICE,
    description: "Тип заказа: readyPrice | individualPrice",
    enum: FurnitureOrderType,
  })
  @IsIn(Object.values(FurnitureOrderType))
  orderType: FurnitureOrderType;

  @ApiProperty({
    description: "Этапы pipeline в порядке следования",
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  stages: OrderStageType[];

  @ApiProperty({
    description: "Очередь производственных цехов (ID)",
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  productionDeptIds?: number[];
}
