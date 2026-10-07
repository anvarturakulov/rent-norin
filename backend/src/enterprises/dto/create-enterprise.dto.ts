import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateEnterpriseDto {
  @ApiProperty({
    example: "Главное предприятие",
    description: "Название предприятия",
  })
  @IsString({ message: "name должен быть строкой" })
  name: string;

  @ApiProperty({ example: "MAIN", description: "Уникальный код предприятия" })
  @IsString({ message: "code должен быть строкой" })
  code: string;

  @ApiProperty({
    example: true,
    description: "Активно ли предприятие",
    required: false,
  })
  @IsBoolean({ message: "isActive должен быть булевым значением" })
  @IsOptional()
  isActive?: boolean = true;

  @ApiProperty({
    example: { locale: "ru", currency: "UZS" },
    description: "Произвольные настройки предприятия",
    required: false,
  })
  @IsOptional()
  settings?: Record<string, unknown>;
}
