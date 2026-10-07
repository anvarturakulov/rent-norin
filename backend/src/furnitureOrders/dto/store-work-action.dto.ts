import { ApiProperty } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { IsInt, IsNumber, IsOptional } from "class-validator";

export class StoreWorkActionDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({
    required: false,
    description: "Переопределение себестоимости прихода",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costTotal?: number;

  @ApiProperty({
    required: false,
    description: "Количество части (приход или накладная)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  count?: number;

  @ApiProperty({
    required: false,
    description: "Сумма продажи части (накладная)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  saleTotal?: number;

  @ApiProperty({
    required: false,
    description: "Дата документа прихода или накладной",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === "") return undefined;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  })
  @Type(() => Number)
  @IsNumber()
  date?: number;
}
