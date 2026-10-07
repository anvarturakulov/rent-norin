import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class WorkNormItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lineIndex?: number;

  @ApiProperty()
  @IsString()
  workName: string;

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
  @IsNumber()
  assignedDeptId?: number;

  @ApiProperty({ required: false, description: "ID работы из справочника WORKS" })
  @IsOptional()
  @IsNumber()
  workRefId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  salaryRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  hourRate?: number;
}

export class HalfstuffNormItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lineIndex?: number;

  @ApiProperty()
  @IsNumber()
  halfstuffId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  countPlanned?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  total?: number;
}

export class MaterialNormItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lineIndex?: number;

  @ApiProperty()
  @IsNumber()
  materialId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  countPlanned?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  total?: number;
}

export class RouteNormItemDto {
  @ApiProperty()
  @IsNumber()
  sequence: number;

  @ApiProperty()
  @IsNumber()
  deptId: number;
}

export class ComponentNormItemDto {
  @ApiProperty()
  @IsNumber()
  componentReferenceId: number;

  @ApiProperty()
  @IsNumber()
  qty: number;
}

export class CommonWorkNormItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lineIndex?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  commonWorkRefId?: number;

  @ApiProperty()
  @IsString()
  workName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  selected?: boolean;
}

export class ReplaceProductNormsDto {
  @ApiProperty({ type: [WorkNormItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkNormItemDto)
  works?: WorkNormItemDto[];

  @ApiProperty({ type: [CommonWorkNormItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommonWorkNormItemDto)
  commonWorks?: CommonWorkNormItemDto[];

  @ApiProperty({ type: [MaterialNormItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialNormItemDto)
  materials?: MaterialNormItemDto[];

  @ApiProperty({ type: [HalfstuffNormItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HalfstuffNormItemDto)
  halfstuffs?: HalfstuffNormItemDto[];

  @ApiProperty({ type: [RouteNormItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteNormItemDto)
  routes?: RouteNormItemDto[];

  @ApiProperty({ type: [ComponentNormItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentNormItemDto)
  components?: ComponentNormItemDto[];
}
