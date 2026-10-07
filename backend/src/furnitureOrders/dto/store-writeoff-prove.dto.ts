import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";

export class StoreWriteoffProveDto {
  @ApiProperty({
    required: false,
    description: "ID черновика для проводки; если не указан — последний OPEN store-документ",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  docId?: number;
}
