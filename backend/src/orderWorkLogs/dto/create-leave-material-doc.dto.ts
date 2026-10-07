import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateLeaveMaterialDocDto {
  @ApiProperty({ example: 1, description: "ID пользователя системы" })
  @IsInt()
  userId: number;

  @ApiProperty({
    example: 20125,
    required: false,
    description:
      "ID склада-отправителя (если не указан, берется из профиля пользователя)",
  })
  @IsOptional()
  @IsInt()
  senderId?: number;

  @ApiProperty({
    example: 20125,
    required: false,
    description: "ID склада-получателя (если не указан, равен senderId)",
  })
  @IsOptional()
  @IsInt()
  receiverId?: number;

  @ApiProperty({
    example: "writeoff:log:4512",
    required: false,
    description: "Ключ идемпотентности с фронтенда",
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
