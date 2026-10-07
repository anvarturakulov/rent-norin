import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateWorkLeaveMaterialDocDto {
  @ApiProperty({ example: 1, description: "ID пользователя системы" })
  @IsInt()
  userId: number;

  @ApiProperty({
    example: 20125,
    required: false,
    description: "ID склада-отправителя (по умолчанию из профиля пользователя)",
  })
  @IsOptional()
  @IsInt()
  senderId?: number;

  @ApiProperty({
    example: 20125,
    required: false,
    description: "ID склада-получателя (по умолчанию senderId)",
  })
  @IsOptional()
  @IsInt()
  receiverId?: number;

  @ApiProperty({ example: 20, description: "ID материала заказа" })
  @IsInt()
  materialId: number;

  @ApiProperty({ example: 18, description: "Количество списания" })
  @IsNumber()
  @Min(0.000001)
  count: number;

  @ApiProperty({
    example: 15000,
    description: "Себестоимость на текущий момент",
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 270000,
    description: "Сумма списания (count * price)",
  })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({
    example: 120.5,
    description: "Остаток материала на момент выбора",
  })
  @IsNumber()
  @Min(0)
  remainCount: number;

  @ApiProperty({ example: "work-writeoff:8451", required: false })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
