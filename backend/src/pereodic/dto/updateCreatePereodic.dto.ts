import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsInt, IsNumber, IsOptional } from "class-validator";

export class UpdateCreatePereodicDto {
  @ApiProperty({
    example: "1738368000000",
    description: "Дата документа в миллисекундах",
  })
  @IsInt({ message: "date - должен быть натуральным числом" })
  date: bigint;

  @ApiProperty({ example: "12222", description: "Идентификатор справочника" })
  @IsInt({ message: "referenceId - должен быть натуральным числом" })
  referenceId: number;

  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "enterpriseId - должен быть натуральным числом" })
  enterpriseId?: number | null;

  @ApiProperty({ example: "Имя реквизита ....", description: "Имя реквизита" })
  @IsString({ message: "name - должен быть строкой" })
  name: string;

  @ApiProperty({ example: "150000", description: "Значение" })
  @IsNumber({}, { message: "value - должно быть номером" })
  value: number;
}
