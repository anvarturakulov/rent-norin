import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, ValidateNested } from "class-validator";

class ProductionQueueItemDto {
  @ApiProperty({ example: 12, description: "ID цеха (reference)" })
  @Type(() => Number)
  @IsInt()
  deptId: number;

  @ApiProperty({
    example: 1,
    description: "Номер этапа (одинаковый = параллель)",
  })
  @Type(() => Number)
  @IsInt()
  sequence: number;
}

export class UpdateProductionQueueDto {
  @ApiProperty({ type: [ProductionQueueItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionQueueItemDto)
  items: ProductionQueueItemDto[];
}
