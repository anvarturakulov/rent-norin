import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class FinishOrderWorkLogMaterialDto {
  @ApiProperty({ example: 20 })
  @IsInt()
  materialId: number;

  @ApiProperty({ example: 18 })
  @IsNumber()
  consumedQty: number;

  @ApiProperty({ example: 270000, required: false })
  @IsOptional()
  @IsNumber()
  consumedTotal?: number;
}

export class FinishOrderWorkLogDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 18, required: false })
  @IsOptional()
  @IsNumber()
  countFact?: number;

  @ApiProperty({ example: "Небольшие дефекты на 2 листах", required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [FinishOrderWorkLogMaterialDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinishOrderWorkLogMaterialDto)
  materials?: FinishOrderWorkLogMaterialDto[];

  @ApiProperty({
    example: false,
    required: false,
    description: "Разрешить завершение работы без списания материалов",
  })
  @IsOptional()
  @IsBoolean()
  withoutMaterials?: boolean;

  @ApiProperty({
    type: [Number],
    example: [7, 9],
    required: false,
    description: "Участники работы (если не передано, используется автор лога)",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  workerIds?: number[];
}
