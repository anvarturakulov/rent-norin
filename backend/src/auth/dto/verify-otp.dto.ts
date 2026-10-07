import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, Matches } from "class-validator";

export class VerifyOtpDto {
  @ApiProperty({ example: "user@mail.ru", description: "Почтовый адрес" })
  @IsString({ message: "email - должно быть строкой" })
  @IsEmail({}, { message: "Не корректный email" })
  readonly email: string;

  @ApiProperty({ example: "123456", description: "Код из Telegram" })
  @IsString({ message: "code - должно быть строкой" })
  @Length(6, 6, { message: "code - 6 рақам" })
  @Matches(/^\d{6}$/, { message: "code - 6 рақам" })
  readonly code: string;
}
