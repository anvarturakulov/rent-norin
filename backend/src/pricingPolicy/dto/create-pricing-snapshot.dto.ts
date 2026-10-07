import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SnapshotValueDto } from "./snapshot-value.dto";

export class CreatePricingSnapshotDto {
  @ApiProperty({ example: 1738368000000 })
  @IsNumber()
  effectiveDate: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  enterpriseId?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiProperty({ type: [SnapshotValueDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SnapshotValueDto)
  values: SnapshotValueDto[];
}
