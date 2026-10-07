import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from "class-validator";
import { WorkStatus } from "src/interfaces/furniture-order.interface";

export class UpdateOrderWorkDto {
  @ApiProperty({ required: false, description: "Порядок строки в заявке" })
  @IsOptional()
  @IsInt()
  lineIndex?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  workName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  workArticle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  countInUnit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  countInOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  finishedProductQty?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeInUnit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeInOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  salaryInUnit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  salaryInOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  assignedDeptId?: number;

  @ApiProperty({ required: false, description: "ID работы из справочника WORKS" })
  @IsOptional()
  @IsInt()
  workRefId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  productionQueueId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  salaryRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  hourRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  countTotalFact?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  hourTotalFact?: number;

  @ApiProperty({ enum: WorkStatus, required: false })
  @IsOptional()
  @IsEnum(WorkStatus)
  workStatus?: WorkStatus;
}
