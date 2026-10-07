import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsEmail, Length } from "class-validator";

export class UserLoginDto {
  @ApiProperty({ example: "user@mail.ru", description: "Почтовый адрес" })
  @IsString({ message: "email - должно быть строкой" })
  @IsEmail({}, { message: "Не корректный email" })
  readonly email: string;

  @ApiProperty({ example: "12345678", description: "Пароль" })
  @IsString({ message: "password - должно быть строкой" })
  @Length(4, 50, { message: "password - не меньше 4 и не больше 16" })
  readonly password: string;
}
