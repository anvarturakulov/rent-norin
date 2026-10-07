import { PartialType } from "@nestjs/mapped-types";
import { CreateEnterpriseDto } from "./create-enterprise.dto";
import { IsOptional, IsInt, IsBoolean, IsDateString } from "class-validator";
import { Exclude } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateEnterpriseDto extends PartialType(CreateEnterpriseDto) {
  @ApiProperty({ example: 1, description: "ID предприятия", required: false })
  @IsOptional()
  @IsInt()
  @Exclude() // Исключаем из валидации, так как id приходит из URL параметра
  id?: number;

  @ApiProperty({
    example: false,
    description: "Помечено на удаление?",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Exclude() // Исключаем из обновления, так как для этого есть отдельный endpoint
  markToDeleted?: boolean;

  @ApiProperty({
    example: "2025-11-21T10:00:00.000Z",
    description: "Дата создания",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  @Exclude() // Исключаем из обновления, так как это поле управляется Sequelize автоматически
  createdAt?: Date;

  @ApiProperty({
    example: "2025-11-21T10:00:00.000Z",
    description: "Дата обновления",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  @Exclude() // Исключаем из обновления, так как это поле управляется Sequelize автоматически
  updatedAt?: Date;
}
