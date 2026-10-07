import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";

export class BanUserDto {
  @ApiProperty({ example: 1, description: "Id пользователя" })
  @IsNumber({}, { message: "id - должен быть числом" })
  readonly id: number;

  @ApiProperty({
    example: "Нарушение правил",
    description: "Причина бана/разбана",
  })
  @IsString({ message: "reason - должно быть строкой" })
  readonly reason: string;
}
