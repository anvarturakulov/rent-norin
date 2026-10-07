import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, ValidateIf } from "class-validator";

export class CreateSaleFromContractDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({
    required: false,
    description: "ID строк ТМЦ/услуг. Если не задано — все непривязанные.",
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  itemLineIds?: number[];
}

export class AttachSaleToContractLineDto {
  @ApiProperty({ enum: ["item", "order"] })
  @IsIn(["item", "order"])
  lineType: "item" | "order";

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  lineId: number;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== "")
  @Type(() => Number)
  @IsInt()
  saleDocId?: number | null;
}
