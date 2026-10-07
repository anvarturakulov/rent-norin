import { IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class ToolsAtClientDetailsQueryDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  toolId: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  endDate: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  enterpriseId?: number;
}
