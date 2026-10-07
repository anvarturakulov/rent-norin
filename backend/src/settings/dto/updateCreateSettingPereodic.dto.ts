import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional } from "class-validator";

export class UpdateCreateSettingPereodicDto {
  @ApiProperty({
    example: "1738368000000",
    description: "Дата в миллисекундах",
  })
  @IsInt({ message: "date - должен быть натуральным числом" })
  date: bigint;

  @ApiProperty({ example: "5", description: "Идентификатор настройки" })
  @IsInt({ message: "settingId - должен быть натуральным числом" })
  settingId: number;

  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "enterpriseId - должен быть натуральным числом" })
  enterpriseId?: number | null;

  @ApiProperty({ example: "150000", description: "Значение" })
  @IsNumber({}, { message: "value - должно быть числом" })
  value: number;
}
