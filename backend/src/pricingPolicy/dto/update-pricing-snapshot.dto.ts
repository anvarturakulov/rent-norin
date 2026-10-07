import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SnapshotValueDto } from "./snapshot-value.dto";

export class UpdatePricingSnapshotDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  effectiveDate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;

  @ApiProperty({ type: [SnapshotValueDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SnapshotValueDto)
  values?: SnapshotValueDto[];
}
