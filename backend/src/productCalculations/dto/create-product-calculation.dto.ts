import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsPositive, Min, IsInt } from "class-validator";

export class CreateProductCalculationDto {
  @ApiProperty({ example: 1, description: "ID готовой продукции" })
  @IsNumber({}, { message: "ID продукта должен быть числом" })
  productId: number;

  @ApiProperty({ example: 2, description: "ID материала" })
  @IsNumber({}, { message: "ID материала должен быть числом" })
  materialId: number;

  @ApiProperty({ example: 1, description: "ID предприятия" })
  @IsInt({ message: "ID предприятия должен быть целым числом" })
  enterpriseId: number;

  @ApiProperty({
    example: 0.5,
    description: "Норма расхода материала на единицу готовой продукции",
  })
  @IsNumber({}, { message: "Количество должно быть числом" })
  @IsPositive({ message: "Количество должно быть положительным" })
  @Min(0.001, { message: "Минимальное количество: 0.001" })
  quantityPerUnit: number;
}
