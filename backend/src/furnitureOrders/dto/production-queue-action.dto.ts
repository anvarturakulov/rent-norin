import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

export enum ProductionQueueActionType {
  ACTIVATE = "ACTIVATE",
  COMPLETE = "COMPLETE",
  RESET_PENDING = "RESET_PENDING",
  RECALCULATE = "RECALCULATE",
}

export class ProductionQueueActionDto {
  @ApiProperty({ enum: ProductionQueueActionType })
  @IsEnum(ProductionQueueActionType)
  action: ProductionQueueActionType;

  @ApiProperty({
    required: false,
    description: "ID цеха (обязателен кроме RECALCULATE)",
  })
  @ValidateIf(
    (dto) => dto.action !== ProductionQueueActionType.RECALCULATE,
  )
  @IsInt()
  deptId?: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  userId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
