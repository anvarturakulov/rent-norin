import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateOrderWorkDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  orderId: number;

  @ApiProperty({
    example: 0,
    required: false,
    description: "Порядок строки в заявке",
  })
  @IsOptional()
  @IsInt()
  lineIndex?: number;

  @ApiProperty({ example: "Раскрой МДФ" })
  @IsString()
  workName: string;

  @ApiProperty({ example: "RW-001", required: false })
  @IsOptional()
  @IsString()
  workArticle?: string;

  @ApiProperty({ example: "шт", required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsNumber()
  countInUnit?: number;

  @ApiProperty({ example: 6, required: false })
  @IsOptional()
  @IsNumber()
  countInOrder?: number;

  @ApiProperty({ example: 3, required: false })
  @IsOptional()
  @IsNumber()
  finishedProductQty?: number;

  @ApiProperty({ example: 1.5, required: false })
  @IsOptional()
  @IsNumber()
  timeInUnit?: number;

  @ApiProperty({ example: 4.5, required: false })
  @IsOptional()
  @IsNumber()
  timeInOrder?: number;

  @ApiProperty({ example: 3000, required: false })
  @IsOptional()
  @IsNumber()
  salaryInUnit?: number;

  @ApiProperty({ example: 9000, required: false })
  @IsOptional()
  @IsNumber()
  salaryInOrder?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsInt()
  assignedDeptId?: number;

  @ApiProperty({ example: 5, required: false, description: "ID работы из справочника WORKS" })
  @IsOptional()
  @IsInt()
  workRefId?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  productionQueueId?: number;

  @ApiProperty({ example: 2000, required: false })
  @IsOptional()
  @IsNumber()
  salaryRate?: number;

  @ApiProperty({ example: 10000, required: false })
  @IsOptional()
  @IsNumber()
  hourRate?: number;

}
